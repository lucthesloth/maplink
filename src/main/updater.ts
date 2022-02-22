import { autoUpdater } from "electron-updater"

export default () => {
    const log = require("electron-log")
    log.transports.file.level = "debug"
    autoUpdater.logger = log
    autoUpdater.checkForUpdates().then(k => {
        console.log("checkForUpdates", k)
    })
}