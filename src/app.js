const { app, BrowserWindow, screen, ipcMain } = require("electron");
const ioHook = require("iohook");
const OBSWebSocket = require("obs-websocket-js");
const obs = new OBSWebSocket();
const _ = require("lodash");
let keyCodes = require("./keycodes.js");
let config = require("./config.js");
require("dotenv").config();
const appconfig = new config({
  configName: "usrcfg",
  defaults: {
    ip: process.env.TARGET_IP ?? "127.0.0.1",
    port: 4444,
    password: process.env.TARGET_PASSWORD ?? "password",
    triggerKeys: [[34], [59]],
    removerKeys: [[42, 17]],
    targetItem: process.env.TARGET_NAME ?? "item",
    width:1000,
    height:800
  },
});
//ELECTRON
let splash, mainWindow;
function createWindow(height = 1280, width = 720) {
  splash = new BrowserWindow({
    width: 320,
    height: 180,
    transparent: true,
    frame: false,
  });
  splash.loadFile("./src/splash.html");
  splash.setIgnoreMouseEvents(true);

  mainWindow = new BrowserWindow({
    width: appconfig.get('width') ?? width,
    height: appconfig.get('height') ?? height,
    show: false,
    resizable: true,
    webPreferences: {
      backgroundThrottling: false,
      nodeIntegration: true,
      contextIsolation: false,
    },
    icon: "map_icon_rust.png",
  });
  mainWindow.loadFile("./src/index.html");
  // mainWindow.webContents.openDevTools();
  mainWindow.on('resized', storeWindowSize)
  mainWindow.setMenu(null);
  splash.setMenu(null);
}
app.whenReady().then(() => {
  ioHook.removeAllListeners('mousemove')
  setTimeout(() => {
    createWindow(
      screen.getPrimaryDisplay().size.height * 0.8,
      screen.getPrimaryDisplay().size.width * 0.8
    );
  }, 10);
});
app.on("window-all-closed", function () {
  app.quit();
});

//IPC
ipcMain.handle("quit-app", () => {
  app.quit();
});
ipcMain.handle("app-ready", () => {
  splash.destroy();
  mainWindow.show();
  mainWindow.focus();
});
ipcMain.handle("startup", () => {
  sendData();
  connectToObs();
});
//Configuration
ipcMain.handle("updateSceneItem", (event, item) => {
  appconfig.set("targetItem", item);
  addToLog(`🎬 Target Item Updated to ${item}`);
});
ipcMain.handle("updateConfig", (event, arg) => {
  disconnectFromObs();
  appconfig.set("ip", arg.ip);
  appconfig.set("port", arg.port);
  appconfig.set("password", arg.password);
  addToLog(`⚙️ Config updated. Please click reconnect.`);
});
ipcMain.handle("obsSettings", () => {
  mainWindow.webContents.send("obsSettings", {
    ip: appconfig.get("ip"),
    port: appconfig.get("port"),
    password: appconfig.get("password"),
  });
});
function refreshKeybinds(){
  mainWindow.webContents.send("refreshBinds", {
    triggerKeys: appconfig.get("triggerKeys"),
    removerKeys: appconfig.get("removerKeys"),
  });
}
ipcMain.handle("removeRemoverKeys", (event, arg) => {
  let removerKeys = appconfig.get("removerKeys") ?? []
  appconfig.set(
    "removerKeys",
    removerKeys.filter((k) => {
      return !ArrayEquals(k, arg);
    })
  );
  addToLog(`🔑 Remover Keys Updated, removed "${keyArrayToString(arg)}"`);
  refreshKeybinds()
});
ipcMain.handle("removeTriggerKeys", (event, arg) => {
  let triggerKeys = appconfig.get("triggerKeys") ?? []
  appconfig.set(
    "triggerKeys",
    triggerKeys.filter((k) => !ArrayEquals(k, arg))
  );
  addToLog(`🔑 Trigger Keys Updated, removed "${keyArrayToString(arg)}"`);
  refreshKeybinds()
});
ipcMain.handle("addTriggerKeys", (event, arg) => {
  let triggerKeys = appconfig.get("triggerKeys") ?? []
  triggerKeys.push(arg)
  appconfig.set("triggerKeys", triggerKeys);
  addToLog(`🔑 Trigger Keys Updated, added "${keyArrayToString(arg)}"`);
  refreshKeybinds()
});
ipcMain.handle("addRemoverKeys", (event, arg) => {
  let removerKeys = appconfig.get("removerKeys") ?? []
  removerKeys.push(arg)
  appconfig.set("removerKeys", removerKeys);
  addToLog(`🔑 Remover Keys Updated, added "${keyArrayToString(arg)}"`);
  refreshKeybinds()
});
function sendData() {
  let data = {
    password: appconfig.get("password"),
    ip: appconfig.get("ip"),
    port: appconfig.get("port"),
    targetItem: appconfig.get("targetItem"),
    removerKeys: appconfig.get("removerKeys"),
    triggerKeys: appconfig.get("triggerKeys"),
    obsSceneItems: [],
  };
  mainWindow.webContents.send("data", data);
}
//UI Updates
function sendStatus(status) {
  mainWindow.webContents.send("status", status);
}
function addToLog(message) {
  mainWindow.webContents.send("log", message);
}
async function refreshSceneItems(name = undefined) {
  try {
    name = name ?? (await obs.send("GetCurrentScene"));
    const { sceneItems } = await obs.send("GetSceneItemList", {
      sceneName: name,
    });
    let mappedScene = sceneItems.map((t) => t.sourceName);
    mainWindow.webContents.send("sceneRefresh", mappedScene);
    return Promise.resolve();
  } catch (e) {
    return Promise.reject(e);
  }
}

//OBS
let reconnectTimer;
let manualDisconnect = false,
  authenticationError = false,
  manualReconnect = false;
ipcMain.handle("sceneRefresh", () => {
  refreshSceneItems()
    .then(() => {
      addToLog("🔄 Scene Items Refreshed");
    })
    .catch((e) => {
      addToLog(
        "⚠️ Error communicating with OBS. Please check your connection."
      );
    });
});
ipcMain.handle("pauseConnection", () => {
  disconnectFromObs();
});
ipcMain.handle("reconnect", () => {
  manualReconnect = true;
  connectToObs();
});
function obsConnectionError() {
  addToLog("⚠️ OBS Connection Error");
  mainWindow.webContents.send("obsError");
}
function obsAuthError() {
  addToLog("⚠️ OBS Authentication Error");
}
function obsDisconnected() {
  addToLog(`🟠 OBS Disconnected, reconnecting.`);
}
function obsConnected() {
  addToLog(`🟢 OBS Connected`);
}
function connectToObs() {
  addToLog(`🟡 Connecting to OBS`);
  obs
    .connect({
      address: `${appconfig.get("ip")}:${appconfig.get("port")}`,
      password: appconfig.get("password"),
    })
    .then(() => {})
    .catch((e) => {
      if (!/authentication/i.test(e.error)) obsConnectionError();
    });
}
function disconnectFromObs() {
  manualDisconnect = true;
  obs.disconnect();
  sendStatus(0);
  addToLog(`🔴 OBS Connection STOPPED.`);
  clearTimeout(reconnectTimer);
}

obs.on("error", (err) => {
  obsConnectionError();
});

obs.on("AuthenticationSuccess", () => {
  ioHook.start(false)
  sendStatus(1);
  obsConnected();
  refreshSceneItems();
  authenticationError = false;
  manualDisconnect = false;
  manualReconnect = false;
});
obs.on("AuthenticationFailure", () => {
  obsAuthError();
  mainWindow.webContents.send("obsAuthError");
  authenticationError = true;
});
obs.on("Exiting", () => {});
obs.on("ConnectionClosed", () => {
  ioHook.stop()
  mainWindow.webContents.send("sceneRefresh", []);
  if (manualDisconnect || authenticationError || manualReconnect) return;
  sendStatus(2);
  obsDisconnected();
  reconnectTimer = setTimeout(() => {
    connectToObs();
  }, 5000);
});
obs.on("SwitchScenes", (data) => {
  refreshSceneItems(data["scene-name"]);
});
obs.on("SourceCreated", (data) => {
  refreshSceneItems();
});
obs.on("SourceDestroyed", (data) => {
  refreshSceneItems();
});
//Keys Handling
let currentKeys = {};
let lastInstance = 0;
let lastTime = Date.now();
ioHook.on('keydown', (event) => {
  detectKeybindState(event)
})

ioHook.on('keyup', (event) => {
  detectKeybindState(event)
})

let detectKeybindState = _.debounce(async function ({keycode, type}){
  if (type == "keydown") {
    currentKeys[keycode] = true;
  } else if (type == "keyup") {
    delete currentKeys[keycode];
  }

  if (checkTrigger()) {
    let currentTime = Date.now();
    if (lastInstance == 0 && currentTime - lastTime < 50) return
    obs.send('SetSceneItemRender', {render: true, source: appconfig.get("targetItem")}).then(() => {
      addToLog(`Shown "${appconfig.get("targetItem")}"`);
      lastTime = Date.now()
      lastInstance = 0;
    }).catch(e => {
      addToLog(`⚠️ Error showing "${appconfig.get("targetItem")}"`);
    })
  } else if (checkRemover()){
    let currentTime = Date.now();
    if (lastInstance == 1 && currentTime - lastTime < 50 || lastInstance == 0 && currentTime - lastTime < 125) return
    obs.send('SetSceneItemRender', {render: false, source: appconfig.get("targetItem")}).then(() => {
      addToLog(`Hidden "${appconfig.get("targetItem")}"`);
      lastTime = Date.now()
      lastInstance = 1;
    }).catch(e => {
      addToLog(`⚠️ Error hiding "${appconfig.get("targetItem")}"`);
    })
  }
})

function checkTrigger() {
  for (const keys of appconfig.get('triggerKeys')) {
    let score = 0;
    for (const key of keys) {
      if (currentKeys[key]) {
        score++;
      }
    }
    if (score == keys.length) {
      return true;
    }
  }
  return false;
}
function checkRemover() {
  for (const keys of appconfig.get('removerKeys')) {
    let score = 0;
    for (const key of keys) {
      if (currentKeys[key]) {
        score++;
      }
    }
    if (score == keys.length) {
      return true;
    }
  }
  return false;
}

//Random Util

const ArrayEquals = (a, b) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

function keyArrayToString(keyArray) {
  let string = "";
  for (let i = 0; i < keyArray.length; i++) {
    string += keyArray[i];
    if (i < keyArray.length - 1) string += ' + '
  }
  return string;
}

let storeWindowSize = _.debounce(function () {
  let {width, height} = mainWindow.getBounds();
    appconfig.set('width', width);
    appconfig.set('height', height);
})