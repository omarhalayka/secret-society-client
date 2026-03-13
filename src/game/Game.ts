import Phaser from "phaser";
import BootScene from "./scenes/BootScene";
import LobbyScene from "./scenes/LobbyScene";
import GameScene from "./scenes/GameScene";
import MafiaNightScene from "./scenes/MafiaNightScene";
import DoctorNightScene from "./scenes/DoctorNightScene";
import DetectiveNightScene from "./scenes/DetectiveNightScene";

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    backgroundColor: "transparent",
    transparent: true,
    parent: "game",
    scale: {
        mode: Phaser.Scale.RESIZE,       // يأخذ حجم الشاشة الفعلي دائماً
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [
        BootScene,
        LobbyScene,
        GameScene,
        MafiaNightScene,
        DoctorNightScene,
        DetectiveNightScene
    ]
};

const game = new Phaser.Game(config);
export default game;