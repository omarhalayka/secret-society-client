import Phaser from "phaser";
import { socketService } from "../../socket";

export default class DetectiveNightScene extends Phaser.Scene {

    private players: any[] = [];
    private roomId!: string;
    private actionUsed: boolean = false;
    private playerCards: Phaser.GameObjects.Container[] = [];
    private resultDisplay?: Phaser.GameObjects.Container;
    private scanParticles: Array<{ gfx: Phaser.GameObjects.Graphics; x: number; y: number; vx: number; vy: number; life: number; maxLife: number }> = [];
    private isMobile: boolean = false;

    private readonly C = {
        bg: 0x060a12, surface: 0x0a1020, card: 0x080d1a,
        cardHover: 0x0f1a30, borderDim: 0x1e2d45, borderBright: 0x3b82f6,
        accent: 0x3b82f6, accentGlow: 0x60a5fa,
    };

    constructor() { super("DetectiveNightScene"); }

    init(data: any) {
        this.roomId = data.roomId;
        this.players = data.players || [];
        this.actionUsed = false;
        this.scanParticles = [];
        socketService.socket.off("phase_changed");
        socketService.socket.off("player_killed");
        socketService.socket.off("detective_result");
        socketService.socket.off("back_to_lobby");
    }

    create() {
        document.getElementById("mobile-game-ui")?.remove();
        document.getElementById("mobile-voting-overlay")?.remove();
        document.getElementById("mobile-admin-bar")?.remove();

        const W = this.scale.width;
        const H = this.scale.height;
        this.isMobile = W < 700;

        this.cameras.main.setBackgroundColor("#060a12");
        this.cameras.main.fadeIn(700, 6, 10, 18);

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

    update() {
        const W = this.scale.width;
        const H = this.scale.height;
        if (Math.random() < 0.08) {
            this.scanParticles.push({
                gfx: this.add.graphics().setDepth(0),
                x: Math.random() * W, y: Math.random() * H,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                life: 0, maxLife: 80 + Math.random() * 60,
            });
        }
        this.scanParticles = this.scanParticles.filter(p => {
            p.x += p.vx; p.y += p.vy; p.life++;
            const prog = p.life / p.maxLife;
            const alpha = prog < 0.3 ? prog / 0.3 : 1 - (prog - 0.3) / 0.7;
            p.gfx.clear();
            p.gfx.fillStyle(0x3b82f6, alpha * 0.3);
            p.gfx.fillCircle(p.x, p.y, 2);
            if (p.life >= p.maxLife) { p.gfx.destroy(); return false; }
            return true;
        });
    }

    private drawBackground(W: number, H: number) {
        this.add.rectangle(0, 0, W, H, this.C.bg).setOrigin(0).setDepth(0);
        const grid = this.add.graphics().setDepth(0);
        grid.lineStyle(1, 0x0d1525, 1);
        for (let x = 0; x < W; x += 56) { grid.moveTo(x, 0); grid.lineTo(x, H); }
        for (let y = 0; y < H; y += 56) { grid.moveTo(0, y); grid.lineTo(W, y); }
        grid.strokePath();
        const glow = this.add.graphics().setDepth(0);
        glow.fillGradientStyle(0x000000, 0x000000, 0x000d33, 0x000d33, 0, 0, 0.4, 0.4);
        glow.fillRect(0, H * 0.6, W, H * 0.4);
    }

    private drawTopBar(W: number) {
        this.add.rectangle(0, 0, W, 56, this.C.surface).setOrigin(0).setDepth(2);
        const line = this.add.graphics().setDepth(3);
        line.lineStyle(2, this.C.accent, 0.8);
        line.moveTo(0, 56); line.lineTo(W, 56); line.strokePath();
        this.add.text(20, 28, "🔍  DETECTIVE", {
            fontSize: "14px", color: "#3b82f6",
            fontFamily: "'Courier New', monospace", fontStyle: "bold", letterSpacing: 3
        }).setOrigin(0, 0.5).setDepth(3);
        this.add.text(W / 2, 28, `ROOM  ${this.roomId?.substring(0, 8).toUpperCase()}`, {
            fontSize: "11px", color: "#1e3a5f",
            fontFamily: "'Courier New', monospace", letterSpacing: 2
        }).setOrigin(0.5, 0.5).setDepth(3);
        this.add.text(W - 20, 28, "◉  NIGHT PHASE", {
            fontSize: "11px", color: "#1e3a5f",
            fontFamily: "'Courier New', monospace", letterSpacing: 2
        }).setOrigin(1, 0.5).setDepth(3);
    }

    private drawTitle(W: number) {
        const titleY = 110;
        const title = this.add.text(W / 2, titleY, "INVESTIGATE A SUSPECT", {
            fontSize: "32px", color: "#e8eef8",
            fontFamily: "'Georgia', serif", fontStyle: "bold", letterSpacing: 6,
        }).setOrigin(0.5).setDepth(2).setAlpha(0);
        this.tweens.add({ targets: title, alpha: 1, y: titleY - 5, duration: 700, ease: "Cubic.easeOut", delay: 300 });
        const sub = this.add.text(W / 2, titleY + 38, "Reveal the true identity of one player", {
            fontSize: "13px", color: "#1e3a5f",
            fontFamily: "'Courier New', monospace", letterSpacing: 2
        }).setOrigin(0.5).setDepth(2).setAlpha(0);
        this.tweens.add({ targets: sub, alpha: 1, duration: 600, delay: 500 });
        const divider = this.add.graphics().setDepth(2).setAlpha(0);
        divider.lineStyle(1, this.C.accent, 0.4);
        divider.moveTo(W / 2 - 120, titleY + 58); divider.lineTo(W / 2 + 120, titleY + 58); divider.strokePath();
        this.tweens.add({ targets: divider, alpha: 1, duration: 500, delay: 600 });
    }

    private drawPlayerCards(W: number, H: number) {
        const targets = this.players.filter(p => p.alive && p.id !== socketService.socket.id);
        if (!targets.length) return;

        let cardW = 140, cardH = 185, gap = 24;
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
            const avatarBg = this.add.circle(0, -cardH * 0.23, Math.floor(cardW * 0.21), 0x040810); avatarBg.setStrokeStyle(1, this.C.borderDim);
            const avatarIcon = this.add.text(0, -cardH * 0.23, "◎", { fontSize: `${Math.floor(cardW * 0.2)}px`, color: "#1e3a5f" }).setOrigin(0.5);
            const pulse = this.add.circle(0, -cardH * 0.23, Math.floor(cardW * 0.24), this.C.accent, 0);
            this.tweens.add({ targets: pulse, alpha: 0.1, scaleX: 1.3, scaleY: 1.3, duration: 1200, yoyo: true, repeat: -1, delay: i * 200 });
            const name = this.add.text(0, cardH * 0.07, player.username.toUpperCase(), {
                fontSize: `${Math.max(10, Math.floor(cardW * 0.086))}px`,
                color: "#b8c4d8", fontFamily: "'Courier New', monospace", letterSpacing: 1
            }).setOrigin(0.5);
            const statusTxt = this.add.text(0, cardH * 0.16, "SCANNING...", {
                fontSize: "9px", color: "#1e3a5f",
                fontFamily: "'Courier New', monospace", letterSpacing: 2
            }).setOrigin(0.5);
            const btnBg = this.add.rectangle(0, cardH * 0.38, cardW * 0.71, 28, this.C.accent, 0); btnBg.setStrokeStyle(1, this.C.accent); btnBg.setOrigin(0.5);
            const btnLabel = this.add.text(0, cardH * 0.38, "INSPECT", { fontSize: "10px", color: "#3b82f6", fontFamily: "'Courier New', monospace", letterSpacing: 2 }).setOrigin(0.5);
            container.add([shadow, bg, topAccent, pulse, avatarBg, avatarIcon, name, statusTxt, btnBg, btnLabel]);
            container.setInteractive(new Phaser.Geom.Rectangle(-cardW / 2, -cardH / 2, cardW, cardH), Phaser.Geom.Rectangle.Contains);
            container.on("pointerover", () => { if (this.actionUsed) return; bg.setFillStyle(this.C.cardHover); bg.setStrokeStyle(1, this.C.accent); topAccent.setAlpha(1); this.tweens.add({ targets: container, scaleX: 1.05, scaleY: 1.05, duration: 150 }); });
            container.on("pointerout", () => { bg.setFillStyle(this.C.card); bg.setStrokeStyle(1, this.C.borderDim); topAccent.setAlpha(0); this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 150 }); });
            container.on("pointerdown", () => { if (this.actionUsed) return; this.handleInspect(player, container, bg, avatarIcon, statusTxt); });
            this.playerCards.push(container);
            this.tweens.add({ targets: container, alpha: 1, y: cardY, duration: 500, delay: 200 + i * 120, ease: "Back.easeOut", onStart: () => container.setY(cardY + 40) });
        });
    }

    private handleInspect(player: any, selected: Phaser.GameObjects.Container, bg: Phaser.GameObjects.Rectangle, iconText: Phaser.GameObjects.Text, statusTxt: Phaser.GameObjects.Text) {
        this.actionUsed = true;
        this.cameras.main.flash(300, 0, 50, 120);
        this.playerCards.forEach(card => {
            if (card !== selected) { card.disableInteractive(); this.tweens.add({ targets: card, alpha: 0.2, scaleX: 0.92, scaleY: 0.92, duration: 300 }); }
        });
        bg.setFillStyle(0x040d1a); bg.setStrokeStyle(2, this.C.accentGlow);
        iconText.setText("?").setColor("#60a5fa");
        statusTxt.setText("INVESTIGATING...").setColor("#3b82f6");
        this.tweens.add({ targets: iconText, alpha: 0.3, duration: 400, yoyo: true, repeat: -1 });
        socketService.socket.emit("detective_check", player.id);
        this.showToast(`Investigating: ${player.username}`, "info");
    }

    private showResult(data: any) {
        if (this.resultDisplay) { this.resultDisplay.destroy(); }
        const role: string = data.role ?? (data.isMafia ? "MAFIA" : "CITIZEN");
        const W = this.scale.width;

        if (this.isMobile) {
            this.showMobileResult(data.username, role);
            return;
        }

        const roleConfig: Record<string, { color: string; border: number; bg: number; icon: string; label: string }> = {
            MAFIA:     { color: "#ff4444", border: 0xcc2222, bg: 0x1a0505, icon: "⚠", label: "⚠  MAFIA CONFIRMED"  },
            DOCTOR:    { color: "#44ff88", border: 0x22cc55, bg: 0x051a05, icon: "✚", label: "✚  DOCTOR IDENTIFIED" },
            DETECTIVE: { color: "#60a5fa", border: 0x2255cc, bg: 0x05051a, icon: "🔍", label: "🔍  DETECTIVE FOUND"  },
            CITIZEN:   { color: "#94a3b8", border: 0x334155, bg: 0x0a0d13, icon: "✓", label: "✓  INNOCENT CITIZEN"  },
        };
        const cfg = roleConfig[role] ?? roleConfig["CITIZEN"];

        // تحديث بطاقة اللاعع المحقق معه
        const targetCard = this.playerCards.find(c => {
            const nameText = c.list.find((obj: any) =>
                obj instanceof Phaser.GameObjects.Text && obj.text === (data.username || "").toUpperCase()
            );
            return !!nameText;
        });
        if (targetCard) {
            const iconText = targetCard.list.find((obj: any) => obj instanceof Phaser.GameObjects.Text && (obj.text === "◎" || obj.text === "?")) as Phaser.GameObjects.Text | undefined;
            const statusTxt = targetCard.list.find((obj: any) => obj instanceof Phaser.GameObjects.Text && (obj.text === "SCANNING..." || obj.text === "INVESTIGATING...")) as Phaser.GameObjects.Text | undefined;
            if (iconText) { this.tweens.killTweensOf(iconText); iconText.setText(cfg.icon).setColor(cfg.color).setAlpha(1); }
            if (statusTxt) { statusTxt.setText(role).setColor(cfg.color); }
        }

        const panelW = Math.min(380, W - 40);
        const container = this.add.container(W / 2, 200).setDepth(20).setAlpha(0);
        const panelBg = this.add.rectangle(0, 0, panelW, 80, cfg.bg); panelBg.setStrokeStyle(2, cfg.border);
        const label = this.add.text(0, -10, cfg.label, { fontSize: "20px", color: cfg.color, fontFamily: "'Courier New', monospace", fontStyle: "bold", letterSpacing: 3 }).setOrigin(0.5);
        const username = this.add.text(0, 18, data.username, { fontSize: "13px", color: "#888899", fontFamily: "'Courier New', monospace", letterSpacing: 2 }).setOrigin(0.5);
        container.add([panelBg, label, username]);
        this.resultDisplay = container;
        this.tweens.add({ targets: container, alpha: 1, duration: 400, ease: "Back.easeOut" });
        this.time.delayedCall(6000, () => {
            if (this.resultDisplay) {
                this.tweens.add({ targets: this.resultDisplay, alpha: 0, duration: 400, onComplete: () => { this.resultDisplay?.destroy(); this.resultDisplay = undefined; } });
            }
        });
    }

    private showMobileResult(username: string, role: string) {
        document.getElementById("mobile-detective-result")?.remove();
        const roleConfig: Record<string, { color: string; icon: string; label: string }> = {
            MAFIA:     { color: "#ef4444", icon: "⚠", label: "MAFIA CONFIRMED"  },
            DOCTOR:    { color: "#22c55e", icon: "✚", label: "DOCTOR IDENTIFIED" },
            DETECTIVE: { color: "#60a5fa", icon: "🔍", label: "DETECTIVE FOUND"  },
            CITIZEN:   { color: "#94a3b8", icon: "✓", label: "INNOCENT CITIZEN"  },
        };
        const cfg = roleConfig[role] ?? roleConfig["CITIZEN"];

        const banner = document.createElement("div");
        banner.id = "mobile-detective-result";
        Object.assign(banner.style, {
            position: "fixed", top: "70px", left: "10px", right: "10px",
            zIndex: "600", padding: "20px",
            backgroundColor: "#060a12", border: `2px solid ${cfg.color}`,
            borderRadius: "10px", fontFamily: "'Courier New', monospace",
            boxShadow: `0 0 30px ${cfg.color}44`,
            textAlign: "center",
        });

        banner.innerHTML = `
            <div style="font-size:36px;margin-bottom:12px">${cfg.icon}</div>
            <div style="color:${cfg.color};font-size:16px;font-weight:bold;letter-spacing:3px;margin-bottom:8px">${cfg.label}</div>
            <div style="color:#94a3b8;font-size:14px;margin-bottom:12px">${username}</div>
            <div style="color:#1e3a5f;font-size:10px;letter-spacing:2px">TAP TO DISMISS</div>
        `;

        // تحديث كرت اللاعع في الـ mobile UI
        const rows = document.querySelectorAll<HTMLElement>("#mobile-night-ui [data-player-id]");
        rows.forEach(row => {
            if (row.dataset.playerId === "pending") {
                // updated by data attribute if we add it
            }
        });

        banner.addEventListener("click", () => banner.remove());
        document.body.appendChild(banner);
        setTimeout(() => banner?.remove(), 8000);
    }

    // ══════════════════════════════
    //  Mobile UI
    // ══════════════════════════════
    private createMobileUI(W: number, H: number) {
        const ui = document.createElement("div");
        ui.id = "mobile-night-ui";
        Object.assign(ui.style, {
            position: "fixed", top: "56px", left: "0", right: "0", bottom: "0",
            zIndex: "100", backgroundColor: "rgba(6,10,18,0.97)",
            display: "flex", flexDirection: "column",
            fontFamily: "'Courier New', monospace",
        });

        const header = document.createElement("div");
        Object.assign(header.style, {
            padding: "16px 20px", borderBottom: "1px solid #1e2d45",
            backgroundColor: "rgba(0,0,0,0.4)",
        });
        header.innerHTML = `
            <div style="color:#3b82f6;font-size:12px;letter-spacing:3px;font-weight:bold;margin-bottom:6px">🔍 DETECTIVE</div>
            <div style="color:#e8eef8;font-size:18px;font-weight:bold;letter-spacing:2px">INVESTIGATE A SUSPECT</div>
            <div style="color:#1e3a5f;font-size:11px;margin-top:4px">Reveal the true identity of one player</div>
        `;
        ui.appendChild(header);

        const list = document.createElement("div");
        Object.assign(list.style, {
            flex: "1", overflowY: "auto", padding: "12px",
            display: "flex", flexDirection: "column", gap: "10px",
        });

        const targets = this.players.filter(p => p.alive && p.id !== socketService.socket.id);
        if (targets.length === 0) {
            const empty = document.createElement("div");
            empty.textContent = "No suspects available";
            Object.assign(empty.style, { color: "#1e3a5f", textAlign: "center", marginTop: "40px", fontSize: "14px" });
            list.appendChild(empty);
        } else {
            targets.forEach(player => {
                const row = document.createElement("div");
                Object.assign(row.style, {
                    display: "flex", alignItems: "center", gap: "14px",
                    padding: "14px 16px", borderRadius: "8px",
                    backgroundColor: "rgba(8,13,26,0.9)",
                    border: "1px solid #1e2d45",
                });

                const avatar = document.createElement("div");
                avatar.textContent = "◎";
                avatar.style.cssText = "font-size:28px;color:#1e3a5f;font-family:'Courier New',monospace;min-width:36px;text-align:center";

                const nameEl = document.createElement("div");
                nameEl.textContent = player.username;
                Object.assign(nameEl.style, {
                    flex: "1", color: "#b8c4d8", fontSize: "15px", fontWeight: "bold",
                });

                const btn = document.createElement("button");
                btn.textContent = "INSPECT";
                Object.assign(btn.style, {
                    padding: "10px 18px", fontSize: "11px", fontWeight: "bold",
                    letterSpacing: "2px", border: "1px solid #3b82f6",
                    borderRadius: "4px", backgroundColor: "transparent",
                    color: "#3b82f6", cursor: "pointer",
                    fontFamily: "'Courier New', monospace",
                    touchAction: "manipulation",
                });

                btn.addEventListener("click", () => {
                    if (this.actionUsed) return;
                    this.actionUsed = true;
                    btn.textContent = "⌛ SCANNING...";
                    btn.style.opacity = "0.7";
                    btn.style.pointerEvents = "none";
                    avatar.textContent = "?";
                    avatar.style.color = "#60a5fa";
                    row.style.borderColor = "#3b82f6";
                    // Disable all other buttons
                    list.querySelectorAll<HTMLButtonElement>("button").forEach(b => {
                        if (b !== btn) { b.style.opacity = "0.3"; b.style.pointerEvents = "none"; }
                    });
                    this.cameras.main.flash(300, 0, 50, 120);
                    socketService.socket.emit("detective_check", player.id);
                    this.showToast(`Investigating: ${player.username}`, "info");
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
            this.cameras.main.fadeOut(400, 8, 8, 15);
            this.time.delayedCall(400, () => this.scene.start("GameScene", { role: "DETECTIVE", roomId: this.roomId, userType: "PLAYER" }));
        });
        socketService.socket.on("back_to_lobby", () => {
            this.cameras.main.fadeOut(300, 8, 8, 15);
            this.time.delayedCall(300, () => this.scene.start("GameScene", { role: "DETECTIVE", roomId: this.roomId, userType: "PLAYER" }));
        });
        socketService.socket.on("detective_result", (data: any) => {
            this.showResult(data);
        });
        socketService.socket.on("player_killed", (data: any) => {
            this.showToast(`${data.username} was eliminated`, "danger");
        });
    }

    shutdown() {
        document.getElementById("mobile-night-ui")?.remove();
        document.getElementById("mobile-detective-result")?.remove();
        this.scanParticles.forEach(p => p.gfx.destroy());
        this.scanParticles = [];
        socketService.socket.off("phase_changed");
        socketService.socket.off("player_killed");
        socketService.socket.off("detective_result");
        socketService.socket.off("back_to_lobby");
    }
}