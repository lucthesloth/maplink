import program from "./program";

export default class SLOBS extends program {
    refreshScenes(): Promise<{ [key: string]: string; }> {
        throw new Error("Method not implemented.");
    }
    refreshSceneItems(scene: string): Promise<{ [key: string]: string; }> {
        throw new Error("Method not implemented.");
    }
    connect(): Promise<Boolean> {
        throw new Error("Method not implemented.");
    }
    disconnect(): Promise<Boolean> {
        throw new Error("Method not implemented.");
    }
    reconnect(): Promise<Boolean> {
        throw new Error("Method not implemented.");
    }
    changeScene(scene: string): Promise<Boolean> {
        throw new Error("Method not implemented.");
    }
    toggleSceneItem(item: string, state: boolean): Promise<Boolean> {
        throw new Error("Method not implemented.");
    }
    
}