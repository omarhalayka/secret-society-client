import Phaser from "phaser";
import BootScene from "./scenes/BootScene";
import LobbyScene from "./scenes/LobbyScene";
import GameScene from "./scenes/GameScene";
import MafiaNightScene from "./scenes/MafiaNightScene";
import DoctorNightScene from "./scenes/DoctorNightScene";
import DetectiveNightScene from "./scenes/DetectiveNightScene";

// ── الحجم الأساسي للتصميم (Desktop) ──
const BASE_W = 1280;
const BASE_H = 720;

// ── نحسب أصغر نسبة تناسب الشاشة ──
const scaleX = window.innerWidth  / BASE_W;
const scaleY = window.innerHeight / BASE_H;
const zoom   = Math.min(scaleX, scaleY); // zoom out ليناسب الشاشة

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width:  BASE_W,
    height: BASE_H,
    backgroundColor: "#0a0d13",
    parent: "game",
    zoom: zoom,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: BASE_W,
        height: BASE_H,
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