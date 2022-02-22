export default abstract class {
    declare host : string;
    declare port : number;
    declare secret : string;

    declare currentScene : string;
    declare previousSecne : string;
    declare scenes : { [key : string] : string };
    declare sceneItems : { [key: string]: string };
    
    constructor(host: string, port: number, secret: string) {
        this.host = host;
        this.port = port;
        this.secret = secret;
    }

    abstract refreshScenes() : Promise<{[key : string] : string }>;
    abstract refreshSceneItems(scene: string) : Promise<{[key : string] : string }>;

    abstract connect() : Promise<Boolean>;
    abstract disconnect() : Promise<Boolean>;
    abstract reconnect() : Promise<Boolean>;

    abstract changeScene(scene: string) : Promise<Boolean>;
    abstract toggleSceneItem(item: string, state : boolean) : Promise<Boolean>;

}