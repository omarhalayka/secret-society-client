import Phaser from "phaser";

export default class BootScene extends Phaser.Scene {

    constructor() {
        super("BootScene");
    }

    preload(): void {
        this.load.image("welcome", "/welcome.jpg");
    }

    create(): void {
        this.scene.start("LobbyScene");
    }

}