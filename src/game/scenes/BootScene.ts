import Phaser from "phaser";

export default class BootScene extends Phaser.Scene {

    constructor() {
        super("BootScene");
    }

    preload(): void {
        // سنستخدم هذا لاحقاً لتحميل الصور
    }

    create(): void {
        this.scene.start("LobbyScene");
    }

}
