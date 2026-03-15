import Phaser from "phaser";
import { socketService } from "../../socket";

export default class DoctorNightScene extends Phaser.Scene {

    private players: any[] = [];
    private roomId!: string;
    private actionUsed: boolean = false;
    private playerCards: Phaser.GameObjects.Container[] = [];
    private savedPlayerId: string | null = null;
    private healParticles: Array<{ gfx: Phaser.GameObjects.Graphics; x: number; y: number; vy: number; alpha: number; size: number }> = [];
    private isMobile: boolean = false;

    private readonly C = {
        bg: 0x08100a, surface: 0x0d1a0f, card: 0x0a1a0c,
        cardHover: 0x0f2a14, borderDim: 0x1a3d20, borderBright: 0x22c55e,
        accent: 0x22c55e, accentGlow: 0x4ade80,
    };

    constructor() { super("DoctorNightScene"); }

    init(data: any) {
        this.roomId = data.roomId;
        this.players = data.players || [];
        this.actionUsed = false;
        this.savedPlayerId = null;
        this.healParticles = [];
        socketService.socket.off("phase_changed");
        socketService.socket.off("player_killed");
        socketService.socket.off("back_to_lobby");
    }

    create() {
        document.getElementById("mobile-game-ui")?.remove();
        document.getElementById("mobile-voting-overlay")?.remove();
        document.getElementById("mobile-admin-bar")?.remove();

        const W = this.scale.width;
        const H = this.scale.height;
        this.isMobile = W < 700;

        this.cameras.main.setBackgroundColor("#08100a");
        this.cameras.main.fadeIn(700, 8, 16, 10);

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
        if (Math.random() < 0.12) {
            this.healParticles.push({
                gfx: this.add.graphics().setDepth(0),
                x: Math.random() * W, y: H + 10,
                vy: -(0.4 + Math.random() * 0.9),
                alpha: 0.6 + Math.random() * 0.4,
                size: 1 + Math.random() * 2,
            });
        }
        this.healParticles = this.healParticles.filter(p => {
            p.y += p.vy; p.alpha -= 0.003;
            if (p.alpha <= 0) { p.gfx.destroy(); return false; }
            p.gfx.clear();
            p.gfx.fillStyle(0x22c55e, p.alpha * 0.7);
            p.gfx.fillCircle(p.x, p.y, p.size);
            return true;
        });
    }

    private drawBackground(W: number, H: number) {
        this.add.rectangle(0, 0, W, H, this.C.bg).setOrigin(0).setDepth(0);
        const grid = this.add.graphics().setDepth(0);
        grid.lineStyle(1, 0x0d1a0a, 1);
        for (let x = 0; x < W; x += 56) { grid.moveTo(x, 0); grid.lineTo(x, H); }
        for (let y = 0; y < H; y += 56) { grid.moveTo(0, y); grid.lineTo(W, y); }
        grid.strokePath();
        const glow = this.add.graphics().setDepth(0);
        glow.fillGradientStyle(0x000000, 0x000000, 0x003300, 0x003300, 0, 0, 0.4, 0.4);
        glow.fillRect(0, H * 0.6, W, H * 0.4);
    }

    private drawTopBar(W: number) {
        this.add.rectangle(0, 0, W, 56, this.C.surface).setOrigin(0).setDepth(2);
        const line = this.add.graphics().setDepth(3);
        line.lineStyle(2, this.C.accent, 0.8);
        line.moveTo(0, 56); line.lineTo(W, 56); line.strokePath();
        this.add.text(20, 28, "✚  DOCTOR", {
            fontSize: "14px", color: "#22c55e",
            fontFamily: "'Courier New', monospace", fontStyle: "bold", letterSpacing: 3
        }).setOrigin(0, 0.5).setDepth(3);
        this.add.text(W / 2, 28, `ROOM  ${this.roomId?.substring(0, 8).toUpperCase()}`, {
            fontSize: "11px", color: "#2d6640",
            fontFamily: "'Courier New', monospace", letterSpacing: 2
        }).setOrigin(0.5, 0.5).setDepth(3);
        this.add.text(W - 20, 28, "◉  NIGHT PHASE", {
            fontSize: "11px", color: "#2d6640",
            fontFamily: "'Courier New', monospace", letterSpacing: 2
        }).setOrigin(1, 0.5).setDepth(3);
    }

    private drawTitle(W: number) {
        const titleY = 110;
        const title = this.add.text(W / 2, titleY, "CHOOSE WHO TO SAVE", {
            fontSize: "32px", color: "#e8f1e8",
            fontFamily: "'Georgia', serif", fontStyle: "bold", letterSpacing: 6,
        }).setOrigin(0.5).setDepth(2).setAlpha(0);
        this.tweens.add({ targets: title, alpha: 1, y: titleY - 5, duration: 700, ease: "Cubic.easeOut", delay: 300 });
        const sub = this.add.text(W / 2, titleY + 38, "Protect one player from the Mafia tonight", {
            fontSize: "13px", color: "#2d6640",
            fontFamily: "'Courier New', monospace", letterSpacing: 2
        }).setOrigin(0.5).setDepth(2).setAlpha(0);
        this.tweens.add({ targets: sub, alpha: 1, duration: 600, delay: 500 });
        const divider = this.add.graphics().setDepth(2).setAlpha(0);
        divider.lineStyle(1, this.C.accent, 0.4);
        divider.moveTo(W / 2 - 120, titleY + 58); divider.lineTo(W / 2 + 120, titleY + 58); divider.strokePath();
        this.tweens.add({ targets: divider, alpha: 1, duration: 500, delay: 600 });
    }

    private drawPlayerCards(W: number, H: number) {
        const targets = this.players.filter(p => p.alive);
        if (!targets.length) return;

        let cardW = 140, cardH = 190, gap = 24;
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
            const isMe = player.id === socketService.socket.id;
            const x = startX + i * (cardW + gap);
            const container = this.add.container(x, cardY).setDepth(5).setAlpha(0);
            const shadow = this.add.rectangle(4, 6, cardW, cardH, 0x000000, 0.5).setOrigin(0.5);
            const bg = this.add.rectangle(0, 0, cardW, cardH, this.C.card); bg.setStrokeStyle(1, this.C.borderDim); bg.setOrigin(0.5);
            const topAccent = this.add.rectangle(0, -cardH / 2 + 2, cardW - 2, 3, this.C.accent, 0); topAccent.setOrigin(0.5, 0);
            const avatarBg = this.add.circle(0, -cardH * 0.23, Math.floor(cardW * 0.21), 0x051a05); avatarBg.setStrokeStyle(1, this.C.borderDim);
            const avatarIcon = this.add.text(0, -cardH * 0.23, isMe ? "🧑" : "👤", { fontSize: `${Math.floor(cardW * 0.2)}px` }).setOrigin(0.5);
            const pulse = this.add.circle(0, -cardH * 0.23, Math.floor(cardW * 0.24), this.C.accent, 0);
            this.tweens.add({ targets: pulse, alpha: 0.15, scaleX: 1.3, scaleY: 1.3, duration: 1200, yoyo: true, repeat: -1, delay: i * 200 });
            const name = this.add.text(0, cardH * 0.07, player.username.toUpperCase(), {
                fontSize: `${Math.max(10, Math.floor(cardW * 0.086))}px`,
                color: isMe ? "#a3e6b4" : "#b8c8b8",
                fontFamily: "'Courier New', monospace", fontStyle: isMe ? "bold" : "normal", letterSpacing: 1
            }).setOrigin(0.5);
            const meLabel = isMe ? this.add.text(0, cardH * 0.16, "[ YOU ]", { fontSize: "9px", color: "#2d6640", fontFamily: "'Courier New', monospace", letterSpacing: 2 }).setOrigin(0.5) : null;
            const btnBg = this.add.rectangle(0, cardH * 0.38, cardW * 0.71, 28, this.C.accent, 0); btnBg.setStrokeStyle(1, this.C.accent); btnBg.setOrigin(0.5);
            const btnLabel = this.add.text(0, cardH * 0.38, "PROTECT", { fontSize: "10px", color: "#22c55e", fontFamily: "'Courier New', monospace", letterSpacing: 2 }).setOrigin(0.5);
            const items: Phaser.GameObjects.GameObject[] = [shadow, bg, topAccent, pulse, avatarBg, avatarIcon, name, btnBg, btnLabel];
            if (meLabel) items.push(meLabel);
            container.add(items);
            container.setInteractive(new Phaser.Geom.Rectangle(-cardW / 2, -cardH / 2, cardW, cardH), Phaser.Geom.Rectangle.Contains);
            container.on("pointerover", () => { if (this.actionUsed) return; bg.setFillStyle(this.C.cardHover); bg.setStrokeStyle(1, this.C.accent); topAccent.setAlpha(1); btnBg.setFillStyle(this.C.accent, 0.15); btnLabel.setColor("#4ade80"); this.tweens.add({ targets: container, scaleX: 1.05, scaleY: 1.05, duration: 150 }); });
            container.on("pointerout", () => { bg.setFillStyle(this.C.card); bg.setStrokeStyle(1, this.C.borderDim); topAccent.setAlpha(0); btnBg.setFillStyle(this.C.accent, 0); btnLabel.setColor("#22c55e"); this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 150 }); });
            container.on("pointerdown", () => { if (this.actionUsed) return; this.handleSave(player, container, bg, btnLabel); });
            this.playerCards.push(container);
            this.tweens.add({ targets: container, alpha: 1, y: cardY, duration: 500, delay: 200 + i * 120, ease: "Back.easeOut", onStart: () => container.setY(cardY + 40) });
        });
    }

    private handleSave(player: any, selected: Phaser.GameObjects.Container, bg: Phaser.GameObjects.Rectangle, btnLabel: Phaser.GameObjects.Text) {
        this.actionUsed = true;
        this.savedPlayerId = player.id;
        this.cameras.main.flash(400, 0, 100, 0);
        this.cameras.main.shake(200, 0.005);
        this.playerCards.forEach(card => {
            if (card !== selected) { card.disableInteractive(); this.tweens.add({ targets: card, alpha: 0.2, scaleX: 0.92, scaleY: 0.92, duration: 300 }); }
        });
        this.tweens.add({ targets: selected, scaleX: 1.1, scaleY: 1.1, duration: 250, ease: "Back.easeOut" });
        bg.setFillStyle(0x051a05); bg.setStrokeStyle(2, this.C.accentGlow);
        btnLabel.setText("SAVED ✓").setColor("#4ade80");
        const mark = this.add.text(selected.x, selected.y - 20, "✚", { fontSize: "52px", color: "#22c55e", fontStyle: "bold", fontFamily: "'Georgia', serif" }).setOrigin(0.5).setAlpha(0).setDepth(10);
        this.tweens.add({ targets: mark, alpha: 1, scaleX: 1.2, scaleY: 1.2, duration: 200, yoyo: true, repeat: 1, onComplete: () => this.tweens.add({ targets: mark, alpha: 0, duration: 400, onComplete: () => mark.destroy() }) });
        socketService.socket.emit("doctor_save", player.id);
        this.showToast(`Protecting: ${player.username}`, "success");
    }

    // ══════════════════════════════
    //  Mobile UI
    // ══════════════════════════════
    private createMobileUI(W: number, H: number) {
        const ui = document.createElement("div");
        ui.id = "mobile-night-ui";
        Object.assign(ui.style, {
            position: "fixed", top: "56px", left: "0", right: "0", bottom: "0",
            zIndex: "100", backgroundColor: "rgba(8,16,10,0.97)",
            display: "flex", flexDirection: "column",
            fontFamily: "'Courier New', monospace",
        });

        const header = document.createElement("div");
        Object.assign(header.style, {
            padding: "16px 20px", borderBottom: "1px solid #1a3d20",
            backgroundColor: "rgba(0,0,0,0.4)",
        });
        header.innerHTML = `
            <div style="color:#22c55e;font-size:12px;letter-spacing:3px;font-weight:bold;margin-bottom:6px">✚ DOCTOR</div>
            <div style="color:#e8f1e8;font-size:18px;font-weight:bold;letter-spacing:2px">CHOOSE WHO TO SAVE</div>
            <div style="color:#2d6640;font-size:11px;margin-top:4px">Protect one player from the Mafia tonight</div>
        `;
        ui.appendChild(header);

        const list = document.createElement("div");
        Object.assign(list.style, {
            flex: "1", overflowY: "auto", padding: "12px",
            display: "flex", flexDirection: "column", gap: "10px",
        });

        const targets = this.players.filter(p => p.alive);
        if (targets.length === 0) {
            const empty = document.createElement("div");
            empty.textContent = "No players available";
            Object.assign(empty.style, { color: "#2d6640", textAlign: "center", marginTop: "40px", fontSize: "14px" });
            list.appendChild(empty);
        } else {
            targets.forEach(player => {
                const isMe = player.id === socketService.socket.id;
                const row = document.createElement("div");
                Object.assign(row.style, {
                    display: "flex", alignItems: "center", gap: "14px",
                    padding: "14px 16px", borderRadius: "8px",
                    backgroundColor: isMe ? "rgba(10,26,12,0.9)" : "rgba(10,26,12,0.7)",
                    border: `1px solid ${isMe ? "#22c55e44" : "#1a3d20"}`,
                });

                const avatar = document.createElement("div");
                avatar.textContent = isMe ? "🧑" : "👤";
                avatar.style.fontSize = "28px";

                const nameEl = document.createElement("div");
                nameEl.textContent = player.username + (isMe ? " (YOU)" : "");
                Object.assign(nameEl.style, {
                    flex: "1", color: isMe ? "#a3e6b4" : "#b8c8b8",
                    fontSize: "15px", fontWeight: isMe ? "bold" : "normal",
                });

                const btn = document.createElement("button");
                btn.textContent = "PROTECT";
                Object.assign(btn.style, {
                    padding: "10px 18px", fontSize: "11px", fontWeight: "bold",
                    letterSpacing: "2px", border: "1px solid #22c55e",
                    borderRadius: "4px", backgroundColor: "transparent",
                    color: "#22c55e", cursor: "pointer",
                    fontFamily: "'Courier New', monospace",
                    touchAction: "manipulation",
                });

                btn.addEventListener("click", () => {
                    if (this.actionUsed) return;
                    this.actionUsed = true;
                    this.savedPlayerId = player.id;
                    btn.textContent = "✓ SAVING";
                    btn.style.backgroundColor = "#22c55e";
                    btn.style.color = "#000";
                    row.style.borderColor = "#22c55e";
                    list.querySelectorAll<HTMLButtonElement>("button").forEach(b => {
                        if (b !== btn) { b.style.opacity = "0.3"; b.style.pointerEvents = "none"; }
                    });
                    this.cameras.main.flash(400, 0, 100, 0);
                    socketService.socket.emit("doctor_save", player.id);
                    this.showToast(`Protecting: ${player.username}`, "success");
                });

                row.appendChild(avatar);
                row.appendChild(nameEl);
                row.appendChild(btn);
                list.appendChild(row);
            });
        }

        ui.appendChild(list);
        document.body.appendChild(ui);
    }

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

    private setupSocketListeners() {
        socketService.socket.on("phase_changed", (data: any) => {
            if (data.phase === "NIGHT" || data.phase === "NIGHT_REVIEW") return;
            this.cameras.main.fadeOut(400, 8, 16, 10);
            this.time.delayedCall(400, () => this.scene.start("GameScene", { role: "DOCTOR", roomId: this.roomId, userType: "PLAYER" }));
        });
        socketService.socket.on("back_to_lobby", () => {
            this.cameras.main.fadeOut(300, 8, 16, 10);
            this.time.delayedCall(300, () => this.scene.start("GameScene", { role: "DOCTOR", roomId: this.roomId, userType: "PLAYER" }));
        });
        socketService.socket.on("player_killed", (data: any) => {
            const msg = `${data.username} was killed in the night`;
            if (data.id === this.savedPlayerId) this.showToast(`Failed to save ${data.username}`, "danger");
            else this.showToast(msg, "danger");
            this.addNightEventToMobilePanel(msg, "#f87171");
        });
    }

    // ─── helper: نحفظ الـ event عشان GameScene تعرضه لما ترجع ───
    private addNightEventToMobilePanel(msg: string, color: string) {
        socketService.pendingEvents.push({ msg, color });
        const panel = document.getElementById("tab-panel-events");
        if (!panel) return;
        const now  = new Date();
        const time = `${now.getHours().toString().padStart(2,"0")}:${now.getMinutes().toString().padStart(2,"0")}`;
        const card = document.createElement("div");
        card.style.cssText = `display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-radius:8px;background:rgba(239,68,68,0.1);border:1px solid #ef444444;border-left:3px solid ${color};animation:eventSlideIn 0.3s ease-out`;
        card.innerHTML = `
            <div style="font-size:18px;min-width:22px;text-align:center;margin-top:1px">🔪</div>
            <div style="flex:1">
                <div style="display:flex;justify-content:space-between;margin-bottom:3px">
                    <span style="font-size:9px;font-weight:bold;letter-spacing:2px;color:${color};font-family:'Courier New',monospace">ELIMINATED</span>
                    <span style="font-size:9px;color:#374151;font-family:'Courier New',monospace">${time}</span>
                </div>
                <div style="font-size:13px;color:#e2e8f0;font-family:'Courier New',monospace">${msg}</div>
            </div>`;
        panel.appendChild(card);
        panel.scrollTop = panel.scrollHeight;
    }

    shutdown() {
        document.getElementById("mobile-night-ui")?.remove();
        this.healParticles.forEach(p => p.gfx.destroy());
        this.healParticles = [];
        socketService.socket.off("phase_changed");
        socketService.socket.off("player_killed");
        socketService.socket.off("back_to_lobby");
    }
}