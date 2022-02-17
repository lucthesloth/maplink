const { app, BrowserWindow, screen, ipcMain } = require("electron");
const ioHook = require("iohook");
const OBSWebSocket = require("obs-websocket-js");
const obs = new OBSWebSocket();

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
  },
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
ipcMain.handle("sceneRefresh", () => {
  refreshSceneItems().then(() => {
    addToLog("🔄 Scene Items Refreshed");
  }).catch(e => {
    addToLog("⚠️ Error communicating with OBS. Please check your connection.");
  })
})
ipcMain.handle("updateSceneItem", (event, item) => {
  appconfig.set("targetItem", item);
  addToLog(`🎬 Target Item Updated to ${item}`);
})
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
ipcMain.handle("pauseConnection", () => {
  disconnectFromObs();
  addToLog(`🔴 OBS Disconnected.`);
  clearTimeout(reconnectTimer);
});
ipcMain.handle("reconnect", () => {
  disconnectFromObs();
  addToLog(`🟠 OBS Disconnected`);
  connectToObs();
});
function sendStatus(status) {
  mainWindow.webContents.send("status", status);
}
function addToLog(message) {
  mainWindow.webContents.send("log", message);
}

function obsConnectionError() {
  addToLog("⚠️ OBS Connection Error");
}
function obsDisconnected() {
  addToLog(`🟠 OBS Disconnected, reconnecting.`);
}
function obsConnected() {
  addToLog(`🟢 OBS Connected`);
}
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
async function refreshSceneItems(name = undefined) {
  try {
    name = name ?? await obs.send("GetCurrentScene");
    const { sceneItems } = await obs.send("GetSceneItemList", {
      sceneName: name,
    });
    let mappedScene = sceneItems.map(t => t.sourceName);
    mainWindow.webContents.send("sceneRefresh", mappedScene);
    return Promise.resolve()
  } catch (e) {
    return Promise.reject(e);
  }
}
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
    width: 1000,
    height: 750,
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
  mainWindow.webContents.openDevTools();

  mainWindow.setMenu(null);
  splash.setMenu(null);
}

app.whenReady().then(() => {
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

//OBS
function connectToObs() {
  obs
    .connect({
      address: `${appconfig.get("ip")}:${appconfig.get("port")}`,
      password: appconfig.get("password"),
    })
    .then(() => {})
    .catch((e) => {
      mainWindow.webContents.send("obsError");
      obsConnectionError();
    })
    .finally(() => {
      manualDisconnect = false;
    });
}
function disconnectFromObs() {
  obs.disconnect();
  manualDisconnect = true;
  sendStatus(0);
}

obs.on("error", (err) => {
  obsConnectionError();
});
let reconnectTimer;
let manualDisconnect = false;
obs.on('AuthenticationSuccess', () => {
  sendStatus(1);
  obsConnected();
  refreshSceneItems();
})
obs.on("ConnectionClosed", () => {
  mainWindow.webContents.send('sceneRefresh', [])
  if (manualDisconnect) return;
  sendStatus(2);
  obsDisconnected();
  reconnectTimer = setTimeout(() => {
    connectToObs();
  }, 5000);
});
obs.on('SwitchScenes', (data) => {
  refreshSceneItems(data["scene-name"])
})
obs.on('SourceCreated', (data) => {
  refreshSceneItems()
})
obs.on('SourceDestroyed', (data) => {
  refreshSceneItems()
})
//Keys Handling
let currentKeys = {};

function checkTrigger() {
  for (const keys of appconfig.triggerKeys) {
    let score = 0;
    for (const key of keys) {
      if (currentKeys[key] && currentKeys[key].active) {
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
  for (const keys of appconfig.removerKeys) {
    let score = 0;
    for (const key of keys) {
      if (currentKeys[key] && currentKeys[key].active) {
        score++;
      }
    }
    if (score == keys.length) {
      return true;
    }
  }
  return false;
}
