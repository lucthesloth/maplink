"use strict";
import { app, BrowserWindow, ipcMain, screen } from "electron";
import * as path from "path";
import { format as formatUrl } from "url";
import _ from 'lodash'
import OBSWebSocket from "obs-websocket-js";
const obs = new OBSWebSocket();
import ioHook from "iohook";
import Config, { ConfigDefaults } from "./config";
import {ArrayEquals, keyArrayToString} from './utils'
const trelloLink = "https://trello.com/b/CTgN1mf5/maphider-v2"
const appconfig = new Config({
  configName: "usrcfg",
  defaults: ConfigDefaults,
});

const isDevelopment = process.env.NODE_ENV !== "production";

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;

async function createSplash() {
  const window = new BrowserWindow({
    width: 320,
    height: 180,
    transparent: true,
    frame: false,
    resizable: false
  });
  
  window.setIgnoreMouseEvents(true);

  if (isDevelopment)
    await window.loadURL(
      `http://localhost:${process.env.ELECTRON_WEBPACK_WDS_PORT}/splash.html`
    );
  else {
    await window.loadURL(
      formatUrl({
        pathname: path.join(__dirname, "splash.html"),
        protocol: "file",
        slashes: true,
      })
    );
    window.setMenu(null);
  }
  return window
}

async function createMainWindow() {
  const window = new BrowserWindow({
    webPreferences: { backgroundThrottling: false,nodeIntegration: true, contextIsolation: false },
  });

  if (isDevelopment) {
    await window.loadURL(
      `http://localhost:${process.env.ELECTRON_WEBPACK_WDS_PORT}`
    );
  } else {
    await window.loadURL(
      formatUrl({
        pathname: path.join(__dirname, "index.html"),
        protocol: "file",
        slashes: true,
      })
    );
    window.setMenu(null);
  }
  if (isDevelopment) {
    window.webContents.openDevTools();
  }

  window.on('resized', storeWindowSize)

  return window;
}

app.on("window-all-closed", () => {
  app.quit();
});

app.on("ready", async () => {
  splashWindow = await createSplash();
  mainWindow = await createMainWindow();
});


//Old code from here --
//ELECTRON

app.on("window-all-closed", function () {
  app.quit();
});

//IPC
ipcMain.handle("quit-app", () => {
  app.quit();
});
ipcMain.handle("app-ready", () => {
  splashWindow?.destroy();
  mainWindow?.webContents.send('agreement', appconfig.get('acceptedTerms', false))
  mainWindow?.show();
  mainWindow?.focus();
});
ipcMain.handle("startup", () => {
  appconfig.set('acceptedTerms', true)
  sendData();
  connectToObs();
});
//Configuration
ipcMain.handle("actionCooldown", (event, arg) => {
  appconfig.set("actionCooldown", arg);
  addToLog(`🔄 Action Cooldown set to ${arg}ms`);
})
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
  mainWindow?.webContents.send("obsSettings", {
    ip: appconfig.get("ip"),
    port: appconfig.get("port"),
    password: appconfig.get("password"),
  });
});
function refreshKeybinds(){
  mainWindow?.webContents.send("refreshBinds", {
    triggerKeys: appconfig.get("triggerKeys"),
    removerKeys: appconfig.get("removerKeys"),
  });
}
ipcMain.handle("removeRemoverKeys", (event, arg) => {
  let removerKeys: [[string]] = appconfig.get("removerKeys") ?? []
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
  let triggerKeys: [[string]] = appconfig.get("triggerKeys") ?? []
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
    actionCooldown: appconfig.get("actionCooldown", 50),
  };
  mainWindow?.webContents.send("data", data);
  addToLog(`📡 You are currently running MapHiderV2 v${app.getVersion()} - ${trelloLink}`);
}
//UI Updates
function sendStatus(status: number) {
  mainWindow?.webContents.send("status", status);
}
function addToLog(message: string) {
  mainWindow?.webContents.send("log", message);
}
let gSceneList: string[] = Array<string>();
async function refreshSceneItems(name: any = undefined) {
  try {
    name = name ?? (await obs.send("GetCurrentScene"));
    const { sceneItems } = await obs.send("GetSceneItemList", {
      sceneName: name,
    });
    let mappedScene = sceneItems.map((t) => t.sourceName);
    mainWindow?.webContents.send("sceneRefresh", mappedScene);
    gSceneList = mappedScene;
    return Promise.resolve();
  } catch (e) {
    return Promise.reject(e);
  }
}

//OBS
let failedConnections = 0;
let maxFailedConnetions = 3;
let reconnectTimer: NodeJS.Timeout;
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
  appconfig.set('firstOpen', false)
  connectToObs();
});
function obsConnectionError() {
  addToLog("⚠️ OBS Connection Error");
  mainWindow?.webContents.send("obsError");
}
function obsAuthError() {
  addToLog("⚠️ OBS Authentication Error");
}
function obsDisconnected() {
  addToLog(`🟠 OBS Disconnected, reconnecting. ${failedConnections}/${maxFailedConnetions}`);
}
function obsConnected() {
  addToLog(`🟢 OBS Connected`);
}
function connectToObs() {
  if (appconfig.get('firstOpen', true)) return;
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
  failedConnections = 0;
});
obs.on("AuthenticationFailure", () => {
  obsAuthError();
  mainWindow?.webContents.send("obsAuthError");
  authenticationError = true;
});
obs.on("Exiting", () => {});
obs.on("ConnectionClosed", () => {
  ioHook.stop()
  mainWindow?.webContents.send("sceneRefresh", []);
  if (manualDisconnect || authenticationError || manualReconnect) return;
  sendStatus(2);
  obsDisconnected();
  reconnectTimer = setTimeout(() => {
    failedConnections++;
    if (failedConnections >= maxFailedConnetions) {
      addToLog(`⚠️ Connection failured reached max. Please check your credentials and make sure obs is running!`);
      obsConnectionError()
      sendStatus(0)
      return;
    }
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
let currentKeys: {[key: string]: boolean} = {};
let lastInstance = 0;
let lastTime = Date.now();
ioHook.on('keydown', (event) => {
  detectKeybindState(event)
})

ioHook.on('keyup', (event) => {
  detectKeybindState(event)
})

let detectKeybindState = _.debounce(async function ({keycode, type}){
  if (!gSceneList.includes(appconfig.get("targetItem"))) return
  if (type == "keydown") {
    currentKeys[keycode] = true;
  } else if (type == "keyup") {
    delete currentKeys[keycode];
  }

  doLoop();  
})

function doLoop(){
  if (checkTrigger()) {
    let currentTime = Date.now();
    if (lastInstance == 0 && currentTime - lastTime < appconfig.get("actionCooldown", 50)) return
    obs.send('SetSceneItemRender', {render: true, source: appconfig.get("targetItem")}).then(() => {
      addToLog(`Shown "${appconfig.get("targetItem")}"`);
      lastTime = Date.now()
      lastInstance = 0;
    }).catch(e => {
      addToLog(`⚠️ Error showing "${appconfig.get("targetItem")}"`);
    })
  } else if (checkRemover()){
    let currentTime = Date.now();
    if (lastInstance == 1 && currentTime - lastTime < appconfig.get("actionCooldown", 50) || lastInstance == 0 && currentTime - lastTime < appconfig.get("actionCooldown", 50)) return
    obs.send('SetSceneItemRender', {render: false, source: appconfig.get("targetItem")}).then(() => {
      addToLog(`Hidden "${appconfig.get("targetItem")}"`);
      lastTime = Date.now()
      lastInstance = 1;
    }).catch(e => {
      addToLog(`⚠️ Error hiding "${appconfig.get("targetItem")}"`);
    })
  }
}

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

let storeWindowSize = _.debounce(function () {
  const bounds = mainWindow?.getBounds();
    appconfig.set('width', bounds?.width);
    appconfig.set('height', bounds?.height);
})
