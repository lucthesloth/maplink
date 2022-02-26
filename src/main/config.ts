import electron from "electron";
import path from "path";
import fs from "fs";

export interface ConfigItems {
    [key: string]: any
    ip: string
    port: number
    password: string
    triggerKeys: Array<Array<number>>
    removerKeys: Array<Array<number>>
    targetItem: string
    width: number
    height: number
    acceptedTerms: boolean
    firstOpen: boolean
    actionCooldown: number
}
export const ConfigDefaults : ConfigItems = {
    ip: "localhost",
    port: 4444,
    password: "password",
    triggerKeys: [[]],
    removerKeys: [[]],
    targetItem: "Target",
    width: 800,
    height: 600,
    acceptedTerms: false,
    firstOpen: true,
    actionCooldown: 50
}
export interface ConfigOptions {
  configName: string;
  defaults: ConfigItems;
}

export default class Config {
  declare path: string;
  declare data: ConfigItems;
  constructor(opts: ConfigOptions) {
    const userDataPath = (electron.app || electron.remote.app).getPath(
      "userData"
    );
    this.path = path.join(userDataPath, opts.configName + ".json");

    this.data = parseDataFile(this.path, opts.defaults);
  }

  get(key: string, dft : any = undefined) {
    return this.data[key] !== undefined ? this.data[key] : dft;
  }

  set(key: string, val: any) {
    this.data[key] = val;
    fs.writeFileSync(this.path, JSON.stringify(this.data));
  }
}

function parseDataFile(filePath: string, defaults: ConfigItems): ConfigItems {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (error) {
    return defaults;
  }
}
