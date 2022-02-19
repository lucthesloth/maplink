const isSquirrelStartup = require("electron-squirrel-startup");
const updateElectron = require("update-electron-app");
const log = require("electron-log");
const {app} = require("electron");
module.exports = function () {
  if (isSquirrelStartup) app.quit();

  // Setup update checks
  updateElectron({
    repo: "lucthesloth/maplinkv2", // GitHub repo to check
    updateInterval: "10 minutes",
    logger: log,
    notifyUser: true,
  });
};
