import Phaser from "phaser";
import BootScene from "./scenes/BootScene";
import LobbyScene from "./scenes/LobbyScene";
import GameScene from "./scenes/GameScene";
import MafiaNightScene from "./scenes/MafiaNightScene";
import DoctorNightScene from "./scenes/DoctorNightScene";
import DetectiveNightScene from "./scenes/DetectiveNightScene";

console.log("📦 Loading Game.ts");
console.log("  - BootScene:", BootScene ? "✅" : "❌");
console.log("  - LobbyScene:", LobbyScene ? "✅" : "❌");
console.log("  - GameScene:", GameScene ? "✅" : "❌");
console.log("  - MafiaNightScene:", MafiaNightScene ? "✅" : "❌");
console.log("  - DoctorNightScene:", DoctorNightScene ? "✅" : "❌");
console.log("  - DetectiveNightScene:", DetectiveNightScene ? "✅" : "❌");

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: "#0f0f1a",
    parent: "game",
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
console.log("🎮 Game created");
export default game;