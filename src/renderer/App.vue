<template>
   <v-app>
      <v-main>
        <div class="appBody d-flex flex-column align-center">
          <v-dialog v-model="bindDialog" persistent max-width="600">
            <template v-slot:default="dialog">
              <v-card elevation="2">
                <v-card-title>
                  Add {{isTrigger ? 'trigger' : 'remover'}} bind.
                </v-card-title>
                <v-card-text>
                  <v-form ref="bindForm" v-model="validBinds">
                    <v-select v-model="select" :items="keys" label="Keys" multiple
                      hint="Select the keys to trigger this action" persistent-hint :rules="[rules.keys]">

                    </v-select>
                  </v-form>
                </v-card-text>
                <v-card-actions class="d-flex flex-row justify-evenly align-center">
                  <v-btn @click="addKey">
                    <v-icon class="mr-1">mdi-content-save</v-icon>Confirm
                  </v-btn>
                  <v-btn text @click="dialog.value = false">
                    <v-icon class="mr-1">mdi-close-thick</v-icon>Cancel
                  </v-btn>
                </v-card-actions>

              </v-card>

            </template>
          </v-dialog>

          <div class="obs-wrapper">
            <v-form class="w-100 pt-5" v-model="validObsSettings" ref="obsForm">
              <v-container fluid class="ml-5 mr-5" style="width: auto !important;">
                <v-row>
                  <span class="ml-5 mb-5 mr-auto">OBS Config</span>
                </v-row>
                <v-row class="d-flex flex-row align-center justify-evenly">
                  <v-text-field v-model="ip" :append-icon="showIP ? 'mdi-eye' : 'mdi-eye-off'" persistent-hint outlined
                    :type="showIP ? 'text' : 'password'" name="target-ip-input" :rules="[rules.required, rules.ip]"
                    label="Target IP" hint="Local IP or Public IP of second computer" counter
                    @click:append="showIP = !showIP">
                  </v-text-field>
                  <v-text-field v-model="port" :append-icon="showPort ? 'mdi-eye' : 'mdi-eye-off'" persistent-hint
                    outlined :type="showPort ? 'text' : 'password'" name="target-port-input"
                    :rules="[rules.required, rules.port]" label="Port" hint="Port for OBS (Default 4444)" counter
                    @click:append="showPort = !showPort" class="ml-2 mr-2"></v-text-field>
                  <v-text-field v-model="password" :append-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
                    persistent-hint outlined :type="showPassword ? 'text' : 'password'" name="target-password-input"
                    :rules="[rules.required, rules.password]" label="Password" hint="OBS Password" counter
                    @click:append="showPassword = !showPassword">
                  </v-text-field>
                </v-row>
                <v-row class="d-flex flex-row justify-evenly align-center mb-5 mt-5">
                  <v-btn color="error" @click="resetObsSettings">
                    <v-icon class="mr-1">mdi-restore</v-icon> Reset
                  </v-btn>
                  <v-btn color="success" :disabled="!validObsSettings" @click="saveObsSettings">
                    <v-icon class="mr-1">mdi-content-save</v-icon> Save
                  </v-btn>
                </v-row>
              </v-container>
            </v-form>
            <v-divider width="99%"></v-divider>
            <div class="w-100 pt-5 pb-5">
              <v-row>
                <v-col cols="12" md="6">
                  <v-container fluid class="ml-5 mr-5" style="width: auto !important;">
                    <v-row>
                      <span class="ml-5 mb-5 mr-auto">OBS Controls</span>
                    </v-row>
                    <v-row class="d-flex flex-row justify-evenly align-center">
                      <v-btn elevation="3" @click="pauseReconnection" color="pink darken-4">
                        <v-icon class="mr-1">mdi-pause</v-icon>Disconnect
                      </v-btn>
                      <v-btn elevation="3" @click="reconnectOBS" color="indigo darken-3">
                        <v-icon class="mr-1">mdi-reload</v-icon>Reconnect
                      </v-btn>
                    </v-row>
                </v-col>
                <v-divider vertical></v-divider>
                <v-col cols="12" md="6">
                  <v-container fluid class="ml-5 mr-5" style="width: auto !important;">
                    <v-row>
                      <span class="ml-5 mb-5 mr-auto">OBS Item Selector</span>
                    </v-row>
                    <v-row class="d-flex flex-row justify-center align-center">
                      <v-select append-outer-icon="mdi-restore" @click:append-outer="sceneRefresh"
                        :items="obsSceneItems" label="Target Item" hint="Only available when OBS is connected"
                        persistent-hint outlined v-model="targetItem" @change="updateTargetItem">
                      </v-select>
                    </v-row>
                  </v-container>
                </v-col>
              </v-row>
            </div>
            <v-divider width="99%"></v-divider>
            <div class="w-100 pt-5 pb-5">
              <v-row>
                <span class="ml-5 mb-5 mr-auto">MapHider Options</span>
              </v-row>
              <v-row>
                <v-col cols="12" md="6">
                  <v-slider label="Cooldown" hint="Cooldown between actions" max="250" min="25" @change="changeActionCooldown" thumb-label persistent-hint v-model="actionCooldown"></v-slider>
                </v-col>
                <v-divider vertical></v-divider>
                <v-col cols="12" md="6">

                </v-col>
              </v-row>
            </div>
          </div>

          <div class="bind-wrapper">
            <div class="w-100 pt-5 pb-5">
              <v-row>
                <v-col cols="12" md="6">
                  <v-container fluid class="ml-5 mr-5" style="width: auto !important;">
                    <v-row>
                      <span class="ml-5 mb-5 mr-auto">Remover Binds</span>
                      <v-btn fab small top right class="ml-auto" v-on:click="openBindDialog(false)">
                        <v-icon>mdi-plus</v-icon>
                      </v-btn>
                    </v-row>
                    <v-row>
                      <v-chip label v-for="(value, key, index) in removerKeys" :key="index" class="ma-2"
                        @click="removeRemoverKey(value)">
                        <span class="add-plus" v-for="(svalue, skey, sindex) in value" :key="sindex">{{getDisplay(svalue)}}</span>
                        <v-icon class="ml-1">mdi-delete</v-icon>
                      </v-chip>
                    </v-row>
                  </v-container>
                </v-col>
                <v-divider vertical></v-divider>
                <v-col cols="12" md="6">
                  <v-container fluid class="ml-5 mr-5" style="width: auto !important;">
                    <v-row>
                      <span class="ml-5 mb-5 mr-auto">Trigger Binds</span>
                      <v-btn fab small top right class="ml-auto" v-on:click="openBindDialog(true)">
                        <v-icon>mdi-plus</v-icon>
                      </v-btn>
                    </v-row>
                    <v-row>
                      <v-chip label v-for="(value, key, index) in triggerKeys" :key="index" class="ma-2"
                        @click="removeTriggerKey(value)">
                        <span class="add-plus" v-for="(svalue, skey, sindex) in value" :key="sindex">{{getDisplay(svalue)}}</span>
                        <v-icon class="ml-1">mdi-delete</v-icon>
                      </v-chip>
                    </v-row>
                  </v-container>
                </v-col>

              </v-row>
            </div>
          </div>

          <div class="history-wrapper pt-3 pb-3 mt-3 mb-3">
            <span class="history-title">Log</span>
            <div class="d-flex flex-column history">
              <span v-for="(value, key, index) in logs" :key="index" class="historyItem pa-1">
                {{ value }}
              </span>
            </div>
          </div>
        </div>
      </v-main>
      <span class="footer-status">{{statusDisplay}}</span>
      <v-footer app dark padless height="20">
        <div class="d-flex flex-row align-center justify-center footer-container">
          {{ new Date().getFullYear() }} — <strong> LucTheSloth</strong>
        </div>
      </v-footer>
      <span class="footer-coffee">
        <a title="Support me on ko-fi.com" class="kofi-button" @click="openKofiLink" target="_blank">
          <span class="kofitext">
            Support Me on
            Ko-fi <img src="https://storage.ko-fi.com/cdn/cup-border.png" alt="Ko-fi donations"
              class="kofiimg"></span></a>
      </span>
    </v-app>
</template>

<script lang="ts">
import keyboardMap from '../main/keycodes'
const ipRegex =
  /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

import { ipcRenderer } from "electron";
import "sweetalert2/dist/sweetalert2.min.css";
import "@sweetalert2/theme-dark/dark.css";
import "typeface-roboto";

export type VForm = Vue & { validate: () => boolean }

export default {
  name: "App",
  data() {
    return {
      select: Array<Array<string>>(),
      isTrigger: false,
      bindDialog: false,
      keys: Array<{[key: string]: string}>(),
      logs: Array<string>(),
      status: 0,
      ip: "",
      password: "",
      port: 0,
      triggerKeys: Array<Array<string>>(),
      removerKeys: Array<Array<string>>(),
      obsSceneItems: Array<string>(),
      targetItem: "",
      showIP: false,
      showPort: false,
      showPassword: false,
      validObsSettings: false,
      validBinds: false,
      lastLog: '',
      actionCooldown: 0,
      rules: {
        ip: (v: string) => ipRegex.test(v) || "Invalid IP",
        required: (v: any) => !!v || "Required.",
        port: (v: number) => (v > 0 && v < 65536) || "Invalid Port",
        password: (v: string) => v.length > 0 || "Required.",
        keys: (v: []) => v.length > 0 || "Select at least one key."
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
    fireSwalError(title: string, text: string, timer = 2000){
      this.$swal.fire({
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
      if ((this.$refs.obsForm as VForm).validate()) {
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
    removeRemoverKey(value: []){
      ipcRenderer.invoke("removeRemoverKeys", value);
    },
    removeTriggerKey(value: []){
      ipcRenderer.invoke("removeTriggerKeys", value);
    },
    addKey(){
      if ((this.$refs.bindForm as VForm).validate()) {

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
        this.$swal.fire({
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
};
</script>

<style lang="scss">
.swal2-popup {
  font-family: "Roboto", sans-serif;
}
</style>
