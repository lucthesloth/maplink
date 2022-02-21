const keyboardMap = require("./keycodes.js");
const { ipcRenderer, ipcMain } = require("electron");
import Swal from "../node_modules/sweetalert2/src/sweetalert2.js";
// import Vue from '../node_modules/vue/dist/vue.js'
const ipRegex =
  /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
let vueApp = new Vue({
  el: "#app",
  data() {
    return {
      select: [],
      isTrigger: false,
      bindDialog: false,
      keys: [],
      logs: [],
      status: 0,
      ip: "",
      password: "",
      port: 0,
      triggerKeys: [],
      removerKeys: [],
      obsSceneItems: [],
      targetItem: "",
      showIP: false,
      showPort: false,
      showPassword: false,
      validObsSettings: false,
      validBinds: false,
      lastLog: '',
      actionCooldown: 0,
      rules: {
        ip: (v) => ipRegex.test(v) || "Invalid IP",
        required: (v) => !!v || "Required.",
        port: (v) => (v > 0 && v < 65536) || "Invalid Port",
        password: (v) => v.length > 0 || "Required.",
        keys: (v) => v.length > 0 || "Select at least one key."
      },
    };
  },
  computed: {
    statusDisplay() {
      switch (this.status) {
        case 0:
          return "Stopped";
        case 1:
          return "Connected";
        case 2:
          return "Connecting";
        default:
          return "Unknown";
      }
    },
  },
  methods: {
    changeActionCooldown () {
      console.log(this.actionCooldown)
      ipcRenderer.invoke('actionCooldown', this.actionCooldown)
    },
    openKofiLink(){
      const link = "https://ko-fi.com/B0B4ANQGE"
      const { shell } = require('electron')
      shell.openExternal(link)
    },
    openBindDialog(val = false){
      console.log(val)
      this.select = []
      this.isTrigger = val
      this.bindDialog = true
    },
    getDisplay(k = 0){
      return keyboardMap[k]
    },
    fireSwalError(title, text, timer = 2000){
      Swal.fire({
        title: title,
        html: `<div style="display:flex;flex-direction:column;align-items:center"><span>${text}</span></div>`,
        icon: "error",
        showCancelButton: false,
        confirmButtonColor: "#3085d6",
        showConfirmButton: false,
        allowOutsideClick: true,
        showCloseButton: true,
        timer: timer,
        timerProgressBar: true,
      });
    },
    pauseReconnection() {
      ipcRenderer.invoke("pauseConnection");
    },
    reconnectOBS() {
      ipcRenderer.invoke("reconnect");
    },
    resetObsSettings() {
      ipcRenderer.invoke("obsSettings");
    },
    saveObsSettings() {
      if (this.$refs.obsForm.validate()) {
        ipcRenderer.invoke("updateConfig", {
          ip: this.ip,
          port: this.port,
          password: this.password,
        });
      }
    },
    updateTargetItem() {
      ipcRenderer.invoke("updateSceneItem", this.targetItem);
    },
    sceneRefresh(){
      ipcRenderer.invoke("sceneRefresh");
    },
    removeRemoverKey(value){
      ipcRenderer.invoke("removeRemoverKeys", value);
    },
    removeTriggerKey(value){
      ipcRenderer.invoke("removeTriggerKeys", value);
    },
    addKey(){
      if (this.$refs.bindForm.validate()) {

        this.bindDialog = false;
        if (this.isTrigger) ipcRenderer.invoke("addTriggerKeys", this.select);
        else ipcRenderer.invoke("addRemoverKeys", this.select);
      }
    },
  },
  watch: {
    
  },
  mounted() {
    for (const kIt in keyboardMap) {
      this.keys.push({ value: kIt, text: keyboardMap[kIt] });
    }
    ipcRenderer.on("log", (event, arg) => {
      if (this.lastLog.normalize() == arg.normalize()) return;
      this.lastLog = arg;
      this.logs.unshift(
        `> ${new Date().toLocaleTimeString().split(` `)[0]} - ${arg}`
      );
      if (this.logs.length > 50) this.logs.pop();
    });
    ipcRenderer.on('agreement', (event, arg) => {
      if (arg) {
        ipcRenderer.invoke("startup");
      } else {
        Swal.fire({
          title: "MapHider Agreement",
          html: `<div style="display:flex;flex-direction:column;align-items:center"><span>By using this software you agree to the following:</span>
          <span>1. You will not redistribute this software.</span>
          <span>2. You agree that for all intents and purpose the input of your keyboard will be captured even when the application is not active.</span></div>`,
          icon: "warning",
          showCancelButton: true,
          confirmButtonColor: "#3085d6",
          cancelButtonColor: "#d33",
          confirmButtonText: "I Agree",
          allowOutsideClick: false,
          showCloseButton: false,
          allowEscapeKey: false,
        }).then((result) => {
          if (!result.isConfirmed) {
            ipcRenderer.invoke("quit-app");
          } else {
            ipcRenderer.invoke("startup");
          }
        });
      }
    })
    ipcRenderer.on("status", (event, arg) => {
      this.status = arg;
    });
    ipcRenderer.on("obsError", (event, arg) => {
      this.fireSwalError('Connection Error', 'OBS is unreachable. Please assure that obs is running and the connection is working properly.')
    });
    ipcRenderer.on('obsAuthError', () => {
      this.fireSwalError('OBS Auth Error', 'OBS Authentication error. Check your credentials.', 10000);
    })
    setTimeout(() => {
      ipcRenderer.invoke("app-ready");
    }, 2500);

    ipcRenderer.on("data", (event, arg) => {

      this.ip = arg.ip;
      this.password = arg.password;
      this.port = arg.port;
      this.triggerKeys = arg.triggerKeys;
      this.removerKeys = arg.removerKeys;
      this.targetItem = arg.targetItem;
      this.obsSceneItems = arg.obsSceneItems;
      this.actionCooldown = arg.actionCooldown;
    });
    ipcRenderer.on('refreshBinds', (event, arg) => {
      this.triggerKeys = arg.triggerKeys;
      this.removerKeys = arg.removerKeys;
    })
    ipcRenderer.on("sceneRefresh", (event, arg) => {
      this.obsSceneItems = arg;
      if (!this.obsSceneItems.includes(this.targetItem))
        this.obsSceneItems.push(this.targetItem);
    });
    ipcRenderer.on("obsSettings", (event, arg) => {
      this.ip = arg.ip;
      this.password = arg.password;
      this.port = arg.port;
    });    
  },
  vuetify: new Vuetify({
    theme: { dark: true },
  }),
});
