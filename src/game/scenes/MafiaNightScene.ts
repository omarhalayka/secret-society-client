import Phaser from "phaser";
import { socketService } from "../../socket";

// ════════════════════════════════════════════════════════
//  MafiaNightScene — Desktop: Phaser cards | Mobile: HTML overlay
// ════════════════════════════════════════════════════════
export default class MafiaNightScene extends Phaser.Scene {

    private players: any[] = [];
    private roomId!: string;
    private actionUsed: boolean = false;
    private playerCards: Phaser.GameObjects.Container[] = [];
    private killedPlayerId: string | null = null;
    private isMobile: boolean = false;

    // جسيمات الجمر
    private embers: Array<{
        gfx: Phaser.GameObjects.Graphics;
        x: number; y: number; vx: number; vy: number;
        life: number; maxLife: number; size: number;
    }> = [];

    private readonly C = {
        bg: 0x080810, surface: 0x0f0f18, card: 0x130a0a,
        cardHover: 0x1f0f0f, borderDim: 0x2a1515, borderBright: 0xcc2222,
        accent: 0xcc2222, accentGlow: 0xff4444,
    };

    constructor() { super("MafiaNightScene"); }

    init(data: any) {
        this.roomId = data.roomId;
        this.players = data.players || [];
        this.actionUsed = false;
        this.killedPlayerId = null;
        this.embers = [];
        socketService.socket.off("phase_changed");
        socketService.socket.off("player_killed");
        socketService.socket.off("back_to_lobby");
    }

    create() {
        // نشيل أي HTML من GameScene
        document.getElementById("mobile-game-ui")?.remove();
        document.getElementById("mobile-voting-overlay")?.remove();
        document.getElementById("mobile-admin-bar")?.remove();

        const W = this.scale.width;
        const H = this.scale.height;
        this.isMobile = W < 700;

        this.cameras.main.setBackgroundColor("#080810");
        this.cameras.main.fadeIn(700, 8, 8, 16);

        this.drawBackground(W, H);
        this.drawTopBar(W);

        if (this.isMobile) {
            this.createMobileUI(W, H);
        } else {
            this.drawTitle(W);
            this.drawPlayerCards(W, H);
        }

        this.setupSocketListeners();
    }

    update(_time: number, delta: number) {
        const W = this.scale.width;
        const H = this.scale.height;
        if (Math.random() < 0.18) {
            this.embers.push({
                gfx: this.add.graphics().setDepth(0),
                x: Math.random() * W, y: H + 10,
                vx: (Math.random() - 0.5) * 0.8,
                vy: -(0.5 + Math.random() * 1.2),
                life: 0, maxLife: 120 + Math.random() * 80,
                size: 1 + Math.random() * 2.5,
            });
        }
        this.embers = this.embers.filter(e => {
            e.x += e.vx; e.y += e.vy; e.life++;
            const p = e.life / e.maxLife;
            const alpha = p < 0.3 ? p / 0.3 : 1 - (p - 0.3) / 0.7;
            e.gfx.clear();
            e.gfx.fillStyle(p < 0.5 ? 0xff8800 : 0xff4400, Math.max(0, alpha * 0.9));
            e.gfx.fillCircle(e.x, e.y, e.size);
            if (e.life >= e.maxLife) { e.gfx.destroy(); return false; }
            return true;
        });
    }

    // ══════════════════════════════
    //  خلفية
    // ══════════════════════════════
    private drawBackground(W: number, H: number) {
        this.add.rectangle(0, 0, W, H, this.C.bg).setOrigin(0).setDepth(0);
        const grid = this.add.graphics().setDepth(0);
        grid.lineStyle(1, 0x1a0808, 1);
        for (let x = 0; x < W; x += 56) { grid.moveTo(x, 0); grid.lineTo(x, H); }
        for (let y = 0; y < H; y += 56) { grid.moveTo(0, y); grid.lineTo(W, y); }
        grid.strokePath();
        const glow = this.add.graphics().setDepth(0);
        glow.fillGradientStyle(0x000000, 0x000000, 0x330000, 0x330000, 0, 0, 0.6, 0.6);
        glow.fillRect(0, H * 0.55, W, H * 0.45);
    }

    // ══════════════════════════════
    //  Topbar
    // ══════════════════════════════
    private drawTopBar(W: number) {
        this.add.rectangle(0, 0, W, 56, this.C.surface).setOrigin(0).setDepth(2);
        const line = this.add.graphics().setDepth(3);
        line.lineStyle(2, this.C.accent, 0.8);
        line.moveTo(0, 56); line.lineTo(W, 56); line.strokePath();
        this.add.text(20, 28, "🔪  MAFIA", {
            fontSize: "14px", color: "#cc2222",
            fontFamily: "'Courier New', monospace", fontStyle: "bold", letterSpacing: 3
        }).setOrigin(0, 0.5).setDepth(3);
        this.add.text(W / 2, 28, `ROOM  ${this.roomId?.substring(0, 8).toUpperCase()}`, {
            fontSize: "11px", color: "#664444",
            fontFamily: "'Courier New', monospace", letterSpacing: 2
        }).setOrigin(0.5, 0.5).setDepth(3);
        this.add.text(W - 20, 28, "◉  NIGHT PHASE", {
            fontSize: "11px", color: "#664444",
            fontFamily: "'Courier New', monospace", letterSpacing: 2
        }).setOrigin(1, 0.5).setDepth(3);
    }

    // ══════════════════════════════
    //  Desktop: عنوان
    // ══════════════════════════════
    private drawTitle(W: number) {
        const titleY = 110;
        const title = this.add.text(W / 2, titleY, "CHOOSE YOUR TARGET", {
            fontSize: "32px", color: "#f1e8e8",
            fontFamily: "'Georgia', serif", fontStyle: "bold", letterSpacing: 6,
        }).setOrigin(0.5).setDepth(2).setAlpha(0);
        this.tweens.add({ targets: title, alpha: 1, y: titleY - 5, duration: 700, ease: "Cubic.easeOut", delay: 300 });
        const sub = this.add.text(W / 2, titleY + 38, "Select one player to eliminate tonight", {
            fontSize: "13px", color: "#664444",
            fontFamily: "'Courier New', monospace", letterSpacing: 2
        }).setOrigin(0.5).setDepth(2).setAlpha(0);
        this.tweens.add({ targets: sub, alpha: 1, duration: 600, delay: 500 });
        const divider = this.add.graphics().setDepth(2).setAlpha(0);
        divider.lineStyle(1, this.C.accent, 0.4);
        divider.moveTo(W / 2 - 120, titleY + 58); divider.lineTo(W / 2 + 120, titleY + 58); divider.strokePath();
        this.tweens.add({ targets: divider, alpha: 1, duration: 500, delay: 600 });
    }

    // ══════════════════════════════
    //  Desktop: بطاقات
    // ══════════════════════════════
    private drawPlayerCards(W: number, H: number) {
        const targets = this.players.filter(p => p.alive && p.id !== socketService.socket.id);
        if (!targets.length) return;

        let cardW = 140, cardH = 180, gap = 24;
        const naturalW = targets.length * cardW + (targets.length - 1) * gap;
        if (naturalW > W - 40) {
            const s = (W - 40) / naturalW;
            cardW = Math.floor(cardW * s);
            cardH = Math.floor(cardH * s);
            gap = Math.floor(gap * s);
        }
        const totalW = targets.length * cardW + (targets.length - 1) * gap;
        const startX = W / 2 - totalW / 2 + cardW / 2;
        const cardY = H / 2 + 30;

        targets.forEach((player, i) => {
            const x = startX + i * (cardW + gap);
            const container = this.add.container(x, cardY).setDepth(5).setAlpha(0);
            const shadow = this.add.rectangle(4, 6, cardW, cardH, 0x000000, 0.5).setOrigin(0.5);
            const bg = this.add.rectangle(0, 0, cardW, cardH, this.C.card); bg.setStrokeStyle(1, this.C.borderDim); bg.setOrigin(0.5);
            const topAccent = this.add.rectangle(0, -cardH / 2 + 2, cardW - 2, 3, this.C.accent, 0); topAccent.setOrigin(0.5, 0);
            const avatarBg = this.add.circle(0, -cardH * 0.23, Math.floor(cardW * 0.21), 0x1a0a0a); avatarBg.setStrokeStyle(1, this.C.borderDim);
            const avatarIcon = this.add.text(0, -cardH * 0.23, "👤", { fontSize: `${Math.floor(cardW * 0.2)}px` }).setOrigin(0.5);
            const pulse = this.add.circle(0, -cardH * 0.23, Math.floor(cardW * 0.24), this.C.accent, 0);
            this.tweens.add({ targets: pulse, alpha: 0.15, scaleX: 1.3, scaleY: 1.3, duration: 1200, yoyo: true, repeat: -1, delay: i * 200 });
            const name = this.add.text(0, cardH * 0.07, player.username.toUpperCase(), {
                fontSize: `${Math.max(10, Math.floor(cardW * 0.086))}px`,
                color: "#c8b8b8", fontFamily: "'Courier New', monospace", fontStyle: "bold", letterSpacing: 1
            }).setOrigin(0.5);
            const btnBg = this.add.rectangle(0, cardH * 0.38, cardW * 0.71, 28, this.C.accent, 0); btnBg.setStrokeStyle(1, this.C.accent); btnBg.setOrigin(0.5);
            const btnLabel = this.add.text(0, cardH * 0.38, "ELIMINATE", { fontSize: "10px", color: "#cc2222", fontFamily: "'Courier New', monospace", letterSpacing: 2 }).setOrigin(0.5);
            container.add([shadow, bg, topAccent, pulse, avatarBg, avatarIcon, name, btnBg, btnLabel]);
            container.setInteractive(new Phaser.Geom.Rectangle(-cardW / 2, -cardH / 2, cardW, cardH), Phaser.Geom.Rectangle.Contains);
            container.on("pointerover", () => { if (this.actionUsed) return; bg.setFillStyle(this.C.cardHover); bg.setStrokeStyle(1, this.C.accent); topAccent.setAlpha(1); this.tweens.add({ targets: container, scaleX: 1.05, scaleY: 1.05, duration: 150 }); });
            container.on("pointerout", () => { bg.setFillStyle(this.C.card); bg.setStrokeStyle(1, this.C.borderDim); topAccent.setAlpha(0); this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 150 }); });
            container.on("pointerdown", () => { if (this.actionUsed) return; this.handleTarget(player, container, bg); });
            this.playerCards.push(container);
            this.tweens.add({ targets: container, alpha: 1, y: cardY, duration: 500, delay: 200 + i * 120, ease: "Back.easeOut", onStart: () => container.setY(cardY + 40) });
        });
    }

    private handleTarget(player: any, selected: Phaser.GameObjects.Container, bg: Phaser.GameObjects.Rectangle) {
        this.actionUsed = true;
        this.killedPlayerId = player.id;
        this.cameras.main.flash(400, 120, 0, 0);
        this.cameras.main.shake(300, 0.008);
        this.playerCards.forEach(card => {
            if (card !== selected) { card.disableInteractive(); this.tweens.add({ targets: card, alpha: 0.2, scaleX: 0.92, scaleY: 0.92, duration: 300 }); }
        });
        this.tweens.add({ targets: selected, scaleX: 1.1, scaleY: 1.1, duration: 250, ease: "Back.easeOut" });
        bg.setFillStyle(0x2a0a0a); bg.setStrokeStyle(2, this.C.accentGlow);
        const mark = this.add.text(selected.x, selected.y - 20, "✕", { fontSize: "52px", color: "#ff2222", fontStyle: "bold", fontFamily: "'Georgia', serif" }).setOrigin(0.5).setAlpha(0).setDepth(10);
        this.tweens.add({ targets: mark, alpha: 1, scaleX: 1.2, scaleY: 1.2, duration: 200, yoyo: true, repeat: 1, onComplete: () => this.tweens.add({ targets: mark, alpha: 0, duration: 400, onComplete: () => mark.destroy() }) });
        socketService.socket.emit("mafia_kill", player.id);
        this.showToast(`Target locked: ${player.username}`, "danger");
    }

    // ══════════════════════════════
    //  Mobile UI
    // ══════════════════════════════
    private createMobileUI(W: number, H: number) {
        const ui = document.createElement("div");
        ui.id = "mobile-night-ui";
        Object.assign(ui.style, {
            position: "fixed", top: "56px", left: "0", right: "0", bottom: "0",
            zIndex: "100", backgroundColor: "rgba(8,8,16,0.97)",
            display: "flex", flexDirection: "column",
            fontFamily: "'Courier New', monospace",
        });

        // Header
        const header = document.createElement("div");
        Object.assign(header.style, {
            padding: "16px 20px", borderBottom: "1px solid #2a1515",
            backgroundColor: "rgba(0,0,0,0.4)",
        });
        header.innerHTML = `
            <div style="color:#cc2222;font-size:12px;letter-spacing:3px;font-weight:bold;margin-bottom:6px">🔪 MAFIA</div>
            <div style="color:#f1e8e8;font-size:18px;font-weight:bold;letter-spacing:2px">CHOOSE YOUR TARGET</div>
            <div style="color:#664444;font-size:11px;margin-top:4px">Select one player to eliminate tonight</div>
        `;
        ui.appendChild(header);

        // List
        const list = document.createElement("div");
        Object.assign(list.style, {
            flex: "1", overflowY: "auto", padding: "12px",
            display: "flex", flexDirection: "column", gap: "10px",
        });

        const targets = this.players.filter(p => p.alive && p.id !== socketService.socket.id);

        if (targets.length === 0) {
            const empty = document.createElement("div");
            empty.textContent = "No targets available";
            Object.assign(empty.style, { color: "#664444", textAlign: "center", marginTop: "40px", fontSize: "14px" });
            list.appendChild(empty);
        } else {
            targets.forEach(player => {
                const row = document.createElement("div");
                Object.assign(row.style, {
                    display: "flex", alignItems: "center", gap: "14px",
                    padding: "14px 16px", borderRadius: "8px",
                    backgroundColor: "rgba(19,10,10,0.9)",
                    border: "1px solid #2a1515", cursor: "pointer",
                    transition: "border-color 0.2s, background 0.2s",
                });

                const avatar = document.createElement("div");
                avatar.textContent = "👤";
                avatar.style.fontSize = "28px";

                const name = document.createElement("div");
                name.textContent = player.username;
                Object.assign(name.style, {
                    flex: "1", color: "#f1e8e8", fontSize: "15px", fontWeight: "bold",
                });

                const btn = document.createElement("button");
                btn.textContent = "ELIMINATE";
                Object.assign(btn.style, {
                    padding: "10px 18px", fontSize: "11px", fontWeight: "bold",
                    letterSpacing: "2px", border: "1px solid #cc2222",
                    borderRadius: "4px", backgroundColor: "transparent",
                    color: "#cc2222", cursor: "pointer",
                    fontFamily: "'Courier New', monospace",
                    touchAction: "manipulation",
                });

                btn.addEventListener("click", () => {
                    if (this.actionUsed) return;
                    this.actionUsed = true;
                    // Visual feedback
                    btn.textContent = "✓ LOCKED";
                    btn.style.backgroundColor = "#cc2222";
                    btn.style.color = "#fff";
                    row.style.borderColor = "#cc2222";
                    row.style.backgroundColor = "rgba(42,10,10,0.9)";
                    // Disable others
                    list.querySelectorAll<HTMLButtonElement>("button").forEach(b => {
                        if (b !== btn) { b.style.opacity = "0.3"; b.style.pointerEvents = "none"; }
                    });
                    // Flash
                    this.cameras.main.flash(400, 120, 0, 0);
                    this.cameras.main.shake(300, 0.008);
                    socketService.socket.emit("mafia_kill", player.id);
                    this.killedPlayerId = player.id;
                    this.showToast(`Target locked: ${player.username}`, "danger");
                });

                row.appendChild(avatar);
                row.appendChild(name);
                row.appendChild(btn);
                list.appendChild(row);
            });
        }

        ui.appendChild(list);
        document.body.appendChild(ui);
    }

    // ══════════════════════════════
    //  Toast
    // ══════════════════════════════
    private showToast(message: string, type: "danger" | "success" | "info") {
        const colorMap = {
            danger:  { bg: 0x1a0505, border: 0xcc2222, text: "#ff4444" },
            success: { bg: 0x051a05, border: 0x22cc22, text: "#44ff44" },
            info:    { bg: 0x05051a, border: 0x2244cc, text: "#4488ff" },
        };
        const c = colorMap[type];
        const W = this.scale.width;
        const H = this.scale.height;
        const toast = this.add.container(W / 2, H - 40).setDepth(20);
        const msgW = Math.min(message.length * 9 + 48, Math.min(420, W - 20));
        const bg = this.add.rectangle(0, 0, msgW, 40, c.bg); bg.setStrokeStyle(1, c.border);
        const text = this.add.text(0, 0, message, { fontSize: "13px", color: c.text, fontFamily: "'Courier New', monospace" }).setOrigin(0.5);
        toast.add([bg, text]);
        toast.setAlpha(0).setY(H - 10);
        this.tweens.add({ targets: toast, alpha: 1, y: H - 60, duration: 300, ease: "Cubic.easeOut" });
        this.time.delayedCall(2800, () => this.tweens.add({ targets: toast, alpha: 0, y: H - 40, duration: 300, onComplete: () => toast.destroy() }));
    }

    // ══════════════════════════════
    //  Socket Listeners
    // ══════════════════════════════
    private setupSocketListeners() {
        socketService.socket.on("phase_changed", (data: any) => {
            if (data.phase === "NIGHT" || data.phase === "NIGHT_REVIEW") return;
            this.cameras.main.fadeOut(500, 8, 8, 16);
            this.time.delayedCall(500, () => {
                this.scene.start("GameScene", { role: "MAFIA", roomId: this.roomId, userType: "PLAYER" });
            });
        });
        socketService.socket.on("back_to_lobby", () => {
            this.cameras.main.fadeOut(300, 8, 8, 16);
            this.time.delayedCall(300, () => {
                this.scene.start("GameScene", { role: "MAFIA", roomId: this.roomId, userType: "PLAYER" });
            });
        });
        socketService.socket.on("player_killed", (data: any) => {
            if (data.id === this.killedPlayerId) this.showToast(`${data.username} has been eliminated`, "danger");
        });
    }

    shutdown() {
        document.getElementById("mobile-night-ui")?.remove();
        this.embers.forEach(e => e.gfx.destroy());
        this.embers = [];
        socketService.socket.off("phase_changed");
        socketService.socket.off("player_killed");
        socketService.socket.off("back_to_lobby");
    }
}