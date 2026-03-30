import Phaser from "phaser";
import { socketService } from "../../socket";
import { ar, ARABIC_FONT_FAMILY } from "../../i18n";

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
        this.add.text(20, 28, ar.night.detectiveRoleLabel, {
            fontSize: "14px", color: "#3b82f6",
            fontFamily: ARABIC_FONT_FAMILY, fontStyle: "bold", align: "right"
        }).setOrigin(0, 0.5).setDepth(3);
        this.add.text(W / 2, 28, ar.night.room(this.roomId?.substring(0, 8).toUpperCase()), {
            fontSize: "11px", color: "#1e3a5f",
            fontFamily: ARABIC_FONT_FAMILY, align: "center"
        }).setOrigin(0.5, 0.5).setDepth(3);
        this.add.text(W - 20, 28, ar.night.nightPhase, {
            fontSize: "11px", color: "#1e3a5f",
            fontFamily: ARABIC_FONT_FAMILY, align: "right"
        }).setOrigin(1, 0.5).setDepth(3);
    }

    private drawTitle(W: number) {
        const titleY = 110;
        const title = this.add.text(W / 2, titleY, ar.night.detectiveTitle, {
            fontSize: "32px", color: "#e8eef8",
            fontFamily: ARABIC_FONT_FAMILY, fontStyle: "bold", align: "center",
        }).setOrigin(0.5).setDepth(2).setAlpha(0);
        this.tweens.add({ targets: title, alpha: 1, y: titleY - 5, duration: 700, ease: "Cubic.easeOut", delay: 300 });
        const sub = this.add.text(W / 2, titleY + 38, ar.night.detectiveSubtitle, {
            fontSize: "13px", color: "#1e3a5f",
            fontFamily: ARABIC_FONT_FAMILY, align: "center"
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
            const shadow = this.add.graphics();
            shadow.fillStyle(0x000000, 0.6);
            shadow.fillRoundedRect(-cardW / 2 + 4, -cardH / 2 + 6, cardW, cardH, 12);

            const bg = this.add.graphics();
            const drawBg = (hover: boolean, selected: boolean) => {
                bg.clear();
                if (selected) {
                    bg.fillGradientStyle(0x051020, 0x051020, 0x020810, 0x020810, 1);
                    bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 12);
                    bg.lineStyle(2, this.C.accentGlow, 1);
                } else if (hover) {
                    bg.fillGradientStyle(0x0f1a30, 0x0f1a30, 0x0a1020, 0x0a1020, 1);
                    bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 12);
                    bg.lineStyle(1.5, this.C.accent, 1);
                } else {
                    bg.fillGradientStyle(0x080d1a, 0x080d1a, 0x040810, 0x040810, 1);
                    bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 12);
                    bg.lineStyle(1.5, this.C.borderDim, 1);
                }
                bg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 12);
            };
            drawBg(false, false);

            const topAccent = this.add.graphics().setAlpha(0);
            topAccent.lineStyle(1.5, this.C.accent, 0.4);
            topAccent.beginPath();
            topAccent.arc(-cardW / 2 + 12, -cardH / 2 + 12, 12, Math.PI, Math.PI * 1.5);
            topAccent.lineTo(cardW / 2 - 12, -cardH / 2);
            topAccent.strokePath();

            const avatarBg = this.add.circle(0, -cardH * 0.23, Math.floor(cardW * 0.21), 0x040810); avatarBg.setStrokeStyle(1, this.C.borderDim);
            const avatarIcon = this.add.text(0, -cardH * 0.23, "•", { fontSize: `${Math.floor(cardW * 0.2)}px`, color: "#1e3a5f", fontFamily: ARABIC_FONT_FAMILY }).setOrigin(0.5);
            const pulse = this.add.circle(0, -cardH * 0.23, Math.floor(cardW * 0.24), this.C.accent, 0);
            this.tweens.add({ targets: pulse, alpha: 0.1, scaleX: 1.3, scaleY: 1.3, duration: 1200, yoyo: true, repeat: -1, delay: i * 200 });
            const name = this.add.text(0, cardH * 0.07, player.username.toUpperCase(), {
                fontSize: `${Math.max(10, Math.floor(cardW * 0.086))}px`,
                color: "#b8c4d8", fontFamily: "'Courier New', monospace", letterSpacing: 1
            }).setOrigin(0.5);
            const statusTxt = this.add.text(0, cardH * 0.16, ar.night.detectiveScanning, {
                fontSize: "9px", color: "#1e3a5f",
                fontFamily: ARABIC_FONT_FAMILY, align: "center"
            }).setOrigin(0.5);

            const btnBg = this.add.graphics();
            const drawBtnBg = (hover: boolean) => {
                btnBg.clear();
                btnBg.fillStyle(this.C.accent, hover ? 0.15 : 0);
                btnBg.fillRoundedRect(-cardW * 0.355, cardH * 0.38 - 14, cardW * 0.71, 28, 6);
                btnBg.lineStyle(1, this.C.accent, 1);
                btnBg.strokeRoundedRect(-cardW * 0.355, cardH * 0.38 - 14, cardW * 0.71, 28, 6);
            };
            drawBtnBg(false);

            const btnLabel = this.add.text(0, cardH * 0.38, ar.night.detectiveInspect, { fontSize: "10px", color: "#3b82f6", fontFamily: ARABIC_FONT_FAMILY, align: "center" }).setOrigin(0.5);
            container.add([shadow, bg, topAccent, pulse, avatarBg, avatarIcon, name, statusTxt, btnBg, btnLabel]);
            container.setInteractive(new Phaser.Geom.Rectangle(-cardW / 2, -cardH / 2, cardW, cardH), Phaser.Geom.Rectangle.Contains);
            container.on("pointerover", () => { if (this.actionUsed) return; drawBg(true, false); topAccent.setAlpha(1); drawBtnBg(true); this.tweens.add({ targets: container, scaleX: 1.05, scaleY: 1.05, y: cardY - 4, duration: 150 }); });
            container.on("pointerout", () => { drawBg(false, false); topAccent.setAlpha(0); drawBtnBg(false); this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, y: cardY, duration: 150 }); });
            container.on("pointerdown", () => { if (this.actionUsed) return; drawBg(false, true); this.handleInspect(player, container, bg, avatarIcon, statusTxt, drawBg, drawBtnBg); });
            this.playerCards.push(container);
            this.tweens.add({ targets: container, alpha: 1, y: cardY, duration: 500, delay: 200 + i * 120, ease: "Back.easeOut", onStart: () => container.setY(cardY + 40) });
        });
    }

    private handleInspect(player: any, selected: Phaser.GameObjects.Container, bg: Phaser.GameObjects.Graphics, iconText: Phaser.GameObjects.Text, statusTxt: Phaser.GameObjects.Text, drawBg: any, drawBtnBg: any) {
        this.actionUsed = true;
        this.cameras.main.flash(300, 0, 50, 120);
        this.playerCards.forEach(card => {
            if (card !== selected) { card.disableInteractive(); this.tweens.add({ targets: card, alpha: 0.2, scaleX: 0.92, scaleY: 0.92, duration: 300 }); }
        });
        drawBg(false, true);
        iconText.setText("?").setColor("#60a5fa");
        statusTxt.setText(ar.night.detectiveScanning).setColor("#3b82f6");
        this.tweens.add({ targets: iconText, alpha: 0.3, duration: 400, yoyo: true, repeat: -1 });
        socketService.socket.emit("detective_check", player.id);
        this.showToast(ar.night.detectiveInvestigating(player.username), "info");
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
            MAFIA: { color: "#ff4444", border: 0xcc2222, bg: 0x1a0505, icon: "!", label: ar.roles.MAFIA },
            DOCTOR: { color: "#4ade80", border: 0x22cc55, bg: 0x051a05, icon: "+", label: ar.roles.DOCTOR },
            DETECTIVE: { color: "#60a5fa", border: 0x2255cc, bg: 0x05051a, icon: "?", label: ar.roles.DETECTIVE },
            CITIZEN: { color: "#94a3b8", border: 0x334155, bg: 0x0a0d13, icon: "•", label: ar.roles.CITIZEN },
        };
        const cfg = roleConfig[role] ?? roleConfig["CITIZEN"];

        // ØªØ­Ø¯ÙŠØ« Ø¨Ø·Ø§Ù‚Ø© Ø§Ù„Ù„Ø§Ø¹Ø¹ Ø§Ù„Ù…Ø­Ù‚Ù‚ Ù…Ø¹Ù‡
        const targetCard = this.playerCards.find(c => {
            const nameText = c.list.find((obj: any) =>
                obj instanceof Phaser.GameObjects.Text && obj.text === (data.username || "").toUpperCase()
            );
            return !!nameText;
        });
        if (targetCard) {
            const iconText = targetCard.list.find((obj: any) => obj instanceof Phaser.GameObjects.Text && (obj.text === "•" || obj.text === "?")) as Phaser.GameObjects.Text | undefined;
            const statusTxt = targetCard.list.find((obj: any) => obj instanceof Phaser.GameObjects.Text && (obj.text === ar.night.detectiveScanning || obj.text === ar.night.detectiveScanning)) as Phaser.GameObjects.Text | undefined;
            if (iconText) { this.tweens.killTweensOf(iconText); iconText.setText(cfg.icon).setColor(cfg.color).setAlpha(1); }
            if (statusTxt) { statusTxt.setText(role).setColor(cfg.color); }
        }

        const panelW = Math.min(380, W - 40);
        const container = this.add.container(W / 2, 200).setDepth(20).setAlpha(0);
        const panelBg = this.add.rectangle(0, 0, panelW, 80, cfg.bg); panelBg.setStrokeStyle(2, cfg.border);
        const label = this.add.text(0, -10, cfg.label, { fontSize: "20px", color: cfg.color, fontFamily: ARABIC_FONT_FAMILY, fontStyle: "bold", align: "right" }).setOrigin(0.5);
        const username = this.add.text(0, 18, data.username, { fontSize: "13px", color: "#888899", fontFamily: ARABIC_FONT_FAMILY, align: "center" }).setOrigin(0.5);
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
            MAFIA: { color: "#ef4444", icon: "!", label: ar.roles.MAFIA },
            DOCTOR: { color: "#4ade80", icon: "+", label: ar.roles.DOCTOR },
            DETECTIVE: { color: "#60a5fa", icon: "?", label: ar.roles.DETECTIVE },
            CITIZEN: { color: "#94a3b8", icon: "•", label: ar.roles.CITIZEN },
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
            <div style="color:${cfg.color};font-size:22px;font-weight:bold;letter-spacing:2px;margin-bottom:8px;direction:rtl">${cfg.label}</div>
            <div style="color:#94a3b8;font-size:14px;margin-bottom:12px">${username}</div>
            <div style="color:#1e3a5f;font-size:10px;letter-spacing:2px">اضغط للإغلاق</div>
        `;

        // ØªØ­Ø¯ÙŠØ« ÙƒØ±Øª Ø§Ù„Ù„Ø§Ø¹Ø¹ ÙÙŠ Ø§Ù„Ù€ mobile UI
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

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    //  Mobile UI
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    private createMobileUI(W: number, H: number) {
        const ui = document.createElement("div");
        ui.id = "mobile-night-ui";
        Object.assign(ui.style, {
            position: "fixed", top: "56px", left: "0", right: "0", bottom: "0",
            zIndex: "100", backgroundColor: "rgba(6,10,18,0.97)",
            display: "flex", flexDirection: "column",
            fontFamily: ARABIC_FONT_FAMILY,
        });

        const header = document.createElement("div");
        Object.assign(header.style, {
            padding: "16px 20px", borderBottom: "1px solid #1e2d45",
            backgroundColor: "rgba(0,0,0,0.4)",
        });
        header.innerHTML = `
            <div style="color:#3b82f6;font-size:12px;letter-spacing:3px;font-weight:bold;margin-bottom:6px">${ar.night.detectiveRoleLabel}</div>
            <div style="color:#e8eef8;font-size:18px;font-weight:bold;letter-spacing:0">${ar.night.detectiveTitle}</div>
            <div style="color:#1e3a5f;font-size:11px;margin-top:4px">${ar.night.detectiveSubtitle}</div>
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
            empty.textContent = ar.night.noSuspects;
            Object.assign(empty.style, { color: "#1e3a5f", textAlign: "center", marginTop: "40px", fontSize: "14px" });
            list.appendChild(empty);
        } else {
            targets.forEach(player => {
                const row = document.createElement("div");
                Object.assign(row.style, {
                    display: "flex", alignItems: "center", gap: "14px",
                    padding: "12px 16px", borderRadius: "10px",
                    background: "linear-gradient(145deg, rgba(15,26,48,0.9), rgba(8,13,26,0.95))",
                    border: "1px solid rgba(59,130,246,0.1)",
                    boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
                    marginBottom: "8px",
                    transition: "all 0.2s"
                });

                const avatar = document.createElement("div");
                avatar.textContent = "•";
                avatar.style.cssText = `font-size:28px;color:#1e3a5f;font-family:${ARABIC_FONT_FAMILY};min-width:36px;text-align:center`;

                const nameEl = document.createElement("div");
                nameEl.textContent = player.username;
                Object.assign(nameEl.style, {
                    flex: "1", color: "#b8c4d8", fontSize: "15px", fontWeight: "bold",
                });

                const btn = document.createElement("button");
                btn.textContent = ar.night.detectiveInspect;
                Object.assign(btn.style, {
                    padding: "10px 16px", fontSize: "11px", fontWeight: "bold",
                    letterSpacing: "2px", border: "1px solid rgba(59,130,246,0.5)",
                    borderRadius: "6px", background: "linear-gradient(180deg, rgba(59,130,246,0.1), transparent)",
                    color: "#3b82f6", cursor: "pointer",
                    fontFamily: ARABIC_FONT_FAMILY,
                    touchAction: "manipulation",
                    transition: "all 0.2s",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.5)"
                });

                btn.addEventListener("click", () => {
                    if (this.actionUsed) return;
                    this.actionUsed = true;
                    btn.textContent = ar.night.detectiveScanning;
                    btn.style.background = "linear-gradient(180deg, #3b82f6, #2563eb)";
                    btn.style.color = "#000";
                    btn.style.borderColor = "#60a5fa";
                    btn.style.transform = "scale(0.96)";
                    setTimeout(() => btn.style.transform = "scale(1)", 150);
                    avatar.textContent = "?";
                    avatar.style.color = "#60a5fa";
                    row.style.borderColor = "#60a5fa";
                    row.style.boxShadow = "0 0 15px rgba(59,130,246,0.2)";
                    // Disable all other buttons
                    list.querySelectorAll<HTMLButtonElement>("button").forEach(b => {
                        if (b !== btn) { b.style.opacity = "0.3"; b.style.pointerEvents = "none"; }
                    });
                    this.cameras.main.flash(300, 0, 50, 120);
                    socketService.socket.emit("detective_check", player.id);
                    this.showToast(ar.night.detectiveInvestigating(player.username), "info");
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
            danger: { bg: 0x1a0505, border: 0xcc2222, text: "#ff4444" },
            success: { bg: 0x051a05, border: 0x22cc22, text: "#44ff44" },
            info: { bg: 0x05051a, border: 0x2244cc, text: "#4488ff" },
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
        socketService.socket.on("server_reset", () => {
            socketService.reset();
            document.getElementById("mobile-night-ui")?.remove();
            this.cameras.main.fadeOut(400, 6, 8, 16);
            this.time.delayedCall(400, () => { this.scene.start("LobbyScene"); });
        });
        socketService.socket.on("detective_result", (data: any) => {
            this.showResult(data);
        });
        socketService.socket.on("player_killed", (data: any) => {
            const msg = ar.night.eliminatedNight(data.username);
            this.showToast(msg, "danger");
            this.addNightEventToMobilePanel(msg, "#f87171");
        });
    }

    // â”€â”€â”€ helper: Ù†Ø­ÙØ¸ Ø§Ù„Ù€ event Ø¹Ø´Ø§Ù† GameScene ØªØ¹Ø±Ø¶Ù‡ Ù„Ù…Ø§ ØªØ±Ø¬Ø¹ â”€â”€â”€
    private addNightEventToMobilePanel(msg: string, color: string) {
        socketService.pendingEvents.push({ msg, color });
        const panel = document.getElementById("tab-panel-events");
        if (!panel) return;
        const now = new Date();
        const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
        const card = document.createElement("div");
        card.style.cssText = `display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-radius:8px;background:rgba(239,68,68,0.1);border:1px solid #ef444444;border-left:3px solid ${color};animation:eventSlideIn 0.3s ease-out`;
        card.innerHTML = `
            <div style="font-size:18px;min-width:22px;text-align:center;margin-top:1px">!</div>
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
        document.getElementById("mobile-detective-result")?.remove();
        this.scanParticles.forEach(p => p.gfx.destroy());
        this.scanParticles = [];
        socketService.socket.off("phase_changed");
        socketService.socket.off("player_killed");
        socketService.socket.off("detective_result");
        socketService.socket.off("back_to_lobby");
        socketService.socket.off("server_reset");
    }
}

