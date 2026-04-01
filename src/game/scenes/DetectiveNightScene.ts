import Phaser from "phaser";
import { socketService } from "../../socket";
import { ar, ARABIC_FONT_FAMILY } from "../../i18n";

export default class DetectiveNightScene extends Phaser.Scene {

    private players: any[] = [];
    private roomId!: string;
    private actionUsed: boolean = false;
    private playerCards: Phaser.GameObjects.Container[] = [];
    private resultDisplay?: Phaser.GameObjects.Container;
    private scanParticles: Array<{
        gfx: Phaser.GameObjects.Graphics;
        x: number; y: number; vx: number; vy: number;
        life: number; maxLife: number;
    }> = [];
    private isMobile: boolean = false;
    // ✅ منع double-submit
    private _submitLock: boolean = false;

    private readonly C = {
        bg:          0x060a12,
        surface:     0x0a1020,
        card:        0x080d1a,
        cardHover:   0x0f1a30,
        borderDim:   0x1e2d45,
        borderBright:0x3b82f6,
        accent:      0x3b82f6,
        accentGlow:  0x60a5fa,
    };

    constructor() { super("DetectiveNightScene"); }

    init(data: any) {
        this.roomId       = data.roomId;
        this.players      = data.players || [];
        this.actionUsed   = false;
        this._submitLock  = false;
        this.scanParticles = [];
        socketService.socket.off("phase_changed");
        socketService.socket.off("player_killed");
        socketService.socket.off("detective_result");
        socketService.socket.off("back_to_lobby");
        socketService.socket.off("server_reset");
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
                gfx:     this.add.graphics().setDepth(0),
                x:       Math.random() * W,
                y:       Math.random() * H,
                vx:      (Math.random() - 0.5) * 0.5,
                vy:      (Math.random() - 0.5) * 0.5,
                life:    0,
                maxLife: 80 + Math.random() * 60,
            });
        }
        this.scanParticles = this.scanParticles.filter(p => {
            p.x += p.vx; p.y += p.vy; p.life++;
            const prog  = p.life / p.maxLife;
            const alpha = prog < 0.3 ? prog / 0.3 : 1 - (prog - 0.3) / 0.7;
            p.gfx.clear();
            p.gfx.fillStyle(0x3b82f6, alpha * 0.3);
            p.gfx.fillCircle(p.x, p.y, 2);
            if (p.life >= p.maxLife) { p.gfx.destroy(); return false; }
            return true;
        });
    }

    // ─── Background ───────────────────────────────────────────────────────────
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
            fontFamily: ARABIC_FONT_FAMILY, fontStyle: "bold",
        }).setOrigin(0, 0.5).setDepth(3);
        this.add.text(W / 2, 28, ar.night.room(this.roomId?.substring(0, 8).toUpperCase()), {
            fontSize: "11px", color: "#1e3a5f",
            fontFamily: ARABIC_FONT_FAMILY,
        }).setOrigin(0.5, 0.5).setDepth(3);
        this.add.text(W - 20, 28, ar.night.nightPhase, {
            fontSize: "11px", color: "#1e3a5f",
            fontFamily: ARABIC_FONT_FAMILY,
        }).setOrigin(1, 0.5).setDepth(3);
    }

    private drawTitle(W: number) {
        const titleY = 110;
        const title = this.add.text(W / 2, titleY, ar.night.detectiveTitle, {
            fontSize:   "32px",
            color:      "#e8eef8",
            fontFamily: ARABIC_FONT_FAMILY,
            fontStyle:  "bold",
            align:      "center",
        }).setOrigin(0.5).setDepth(2).setAlpha(0);
        this.tweens.add({ targets: title, alpha: 1, y: titleY - 5, duration: 700, ease: "Cubic.easeOut", delay: 300 });

        const sub = this.add.text(W / 2, titleY + 38, ar.night.detectiveSubtitle, {
            fontSize:   "13px",
            color:      "#1e3a5f",
            fontFamily: ARABIC_FONT_FAMILY,
            align:      "center",
        }).setOrigin(0.5).setDepth(2).setAlpha(0);
        this.tweens.add({ targets: sub, alpha: 1, duration: 600, delay: 500 });

        const divider = this.add.graphics().setDepth(2).setAlpha(0);
        divider.lineStyle(1, this.C.accent, 0.4);
        divider.moveTo(W / 2 - 120, titleY + 58);
        divider.lineTo(W / 2 + 120, titleY + 58);
        divider.strokePath();
        this.tweens.add({ targets: divider, alpha: 1, duration: 500, delay: 600 });
    }

    // ─── Desktop: Player Cards ────────────────────────────────────────────────
    private drawPlayerCards(W: number, H: number) {
        const targets = this.players.filter(p => p.alive && p.id !== socketService.socket.id);
        if (!targets.length) return;

        let cardW = 140, cardH = 185, gap = 24;
        const naturalW = targets.length * cardW + (targets.length - 1) * gap;
        if (naturalW > W - 40) {
            const s = (W - 40) / naturalW;
            cardW = Math.floor(cardW * s);
            cardH = Math.floor(cardH * s);
            gap   = Math.floor(gap * s);
        }
        const totalW = targets.length * cardW + (targets.length - 1) * gap;
        const startX = W / 2 - totalW / 2 + cardW / 2;
        const cardY  = H / 2 + 30;

        targets.forEach((player, i) => {
            const x         = startX + i * (cardW + gap);
            const container = this.add.container(x, cardY).setDepth(5).setAlpha(0);

            const shadow = this.add.graphics();
            shadow.fillStyle(0x000000, 0.6);
            shadow.fillRoundedRect(-cardW / 2 + 4, -cardH / 2 + 6, cardW, cardH, 12);

            const bg = this.add.graphics();
            let isSelected = false;
            const drawCardBg = (hover: boolean, selected: boolean) => {
                bg.clear();
                if (selected) {
                    bg.fillGradientStyle(0x051020, 0x051020, 0x020810, 0x020810, 1);
                    bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 12);
                    bg.lineStyle(2, this.C.accentGlow, 1);
                } else if (hover) {
                    bg.fillGradientStyle(0x0f1a30, 0x0f1a30, 0x0a1020, 0x0a1020, 1);
                    bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 12);
                    bg.lineStyle(1, this.C.borderBright, 0.6);
                } else {
                    bg.fillGradientStyle(0x080d1a, 0x080d1a, 0x050810, 0x050810, 1);
                    bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 12);
                    bg.lineStyle(1, this.C.borderDim, 0.5);
                }
                bg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 12);
            };
            drawCardBg(false, false);

            const nameText = this.add.text(0, cardH / 2 - 30, player.username, {
                fontSize:   `${Math.max(10, Math.floor(cardW / 9))}px`,
                color:      "#b8c4d8",
                fontFamily: ARABIC_FONT_FAMILY,
                fontStyle:  "bold",
                align:      "center",
                wordWrap:   { width: cardW - 10 },
            }).setOrigin(0.5);

            const btnH   = Math.max(28, Math.floor(cardH * 0.16));
            const btnW2  = cardW - 20;
            const btnY   = cardH / 2 - btnH / 2 - 6;
            const btnBg  = this.add.graphics();
            const drawBtn = (active: boolean) => {
                btnBg.clear();
                btnBg.fillStyle(active ? 0x3b82f6 : 0x1e2d45, 1);
                btnBg.fillRoundedRect(-btnW2 / 2, btnY - btnH / 2, btnW2, btnH, 6);
            };
            drawBtn(false);

            const btnLabel = this.add.text(0, btnY, ar.night.detectiveInspect, {
                fontSize:   `${Math.max(9, Math.floor(cardH * 0.075))}px`,
                color:      "#3b82f6",
                fontFamily: ARABIC_FONT_FAMILY,
                fontStyle:  "bold",
            }).setOrigin(0.5);

            container.add([shadow, bg, nameText, btnBg, btnLabel]);
            container.setSize(cardW, cardH);
            container.setInteractive();

            container.on("pointerover", () => {
                if (this.actionUsed || isSelected) return;
                drawCardBg(true, false);
                drawBtn(true);
                btnLabel.setColor("#ffffff");
            });
            container.on("pointerout", () => {
                if (isSelected) return;
                drawCardBg(false, false);
                drawBtn(false);
                btnLabel.setColor("#3b82f6");
            });
            container.on("pointerdown", () => {
                if (this.actionUsed || this._submitLock) return;
                this._submitLock = true;
                this.actionUsed  = true;
                isSelected = true;

                // تعطيل كل البطاقات بأمان
                this.playerCards.forEach(card => {
                    if (card && card.active && card.disableInteractive) {
                        card.disableInteractive();
                    }
                });

                drawCardBg(false, true);
                drawBtn(true);
                btnLabel.setColor("#ffffff").setText(ar.night.detectiveScanning);

                this.cameras.main.flash(300, 0, 50, 120);
                socketService.socket.emit("detective_check", player.id);
                this.showToast(ar.night.detectiveInvestigating(player.username), "info");
            });

            this.playerCards.push(container);
            this.tweens.add({
                targets:  container,
                alpha:    1,
                y:        cardY - 8,
                duration: 400,
                ease:     "Cubic.easeOut",
                delay:    200 + i * 80,
            });
        });
    }

    // ─── Show detective result ────────────────────────────────────────────────
    private showResult(data: { username: string; role: string }) {
        const isMafia = data.role === "MAFIA";
        const W = this.scale.width;
        const H = this.scale.height;

        if (this.isMobile) {
            const existingResult = document.getElementById("mobile-detective-result");
            if (existingResult) existingResult.remove();

            const result = document.createElement("div");
            result.id = "mobile-detective-result";
            Object.assign(result.style, {
                position:     "fixed",
                top:          "50%",
                left:         "50%",
                transform:    "translate(-50%,-50%)",
                zIndex:       "200",
                background:   isMafia
                    ? "linear-gradient(145deg, #1a0505, #0d0000)"
                    : "linear-gradient(145deg, #051a05, #000d00)",
                border:       `2px solid ${isMafia ? "#cc2222" : "#22c55e"}`,
                borderRadius: "16px",
                padding:      "28px 32px",
                textAlign:    "center",
                fontFamily:   ARABIC_FONT_FAMILY,
                direction:    "rtl",
                boxShadow:    `0 0 30px ${isMafia ? "rgba(204,34,34,0.4)" : "rgba(34,197,94,0.4)"}`,
                minWidth:     "220px",
            });

            result.innerHTML = `
                <div style="font-size:32px;margin-bottom:12px">${isMafia ? "🔴" : "🟢"}</div>
                <div style="font-size:14px;color:#64748b;margin-bottom:8px;letter-spacing:2px">
                    ${ar.night.detectiveTitle}
                </div>
                <div style="font-size:20px;font-weight:bold;color:#f1f5f9;margin-bottom:6px">
                    ${data.username}
                </div>
                <div style="font-size:16px;font-weight:bold;color:${isMafia ? "#ef4444" : "#22c55e"}">
                    ${isMafia ? ar.roles.MAFIA : ar.roles.CITIZEN}
                </div>
            `;
            document.body.appendChild(result);
            this.time.delayedCall(5000, () => result.remove());
            return;
        }

        // Desktop result
        if (this.resultDisplay) this.resultDisplay.destroy();
        this.resultDisplay = this.add.container(W / 2, H / 2).setDepth(20).setAlpha(0);

        const resultColor  = isMafia ? 0xcc2222 : 0x22c55e;
        const resultText   = isMafia ? ar.roles.MAFIA : ar.roles.CITIZEN;
        const textColor    = isMafia ? "#ef4444" : "#22c55e";

        const overlay = this.add.rectangle(0, 0, 280, 160, isMafia ? 0x1a0505 : 0x051a05);
        overlay.setStrokeStyle(2, resultColor);

        const nameT = this.add.text(0, -30, data.username, {
            fontSize:   "20px",
            color:      "#f1f5f9",
            fontFamily: ARABIC_FONT_FAMILY,
            fontStyle:  "bold",
        }).setOrigin(0.5);

        const roleT = this.add.text(0, 20, resultText, {
            fontSize:   "16px",
            color:      textColor,
            fontFamily: ARABIC_FONT_FAMILY,
            fontStyle:  "bold",
        }).setOrigin(0.5);

        this.resultDisplay.add([overlay, nameT, roleT]);
        this.tweens.add({
            targets:  this.resultDisplay,
            alpha:    1,
            scaleX:   1,
            scaleY:   1,
            duration: 400,
            ease:     "Back.easeOut",
        });
    }

    // ─── Mobile UI ────────────────────────────────────────────────────────────
    private createMobileUI(_W: number, _H: number) {
        const ui = document.createElement("div");
        ui.id = "mobile-night-ui";
        Object.assign(ui.style, {
            position:      "fixed",
            top:           "56px",
            left:          "0",
            right:         "0",
            bottom:        "0",
            background:    "linear-gradient(180deg, #060a12 0%, #030609 100%)",
            display:       "flex",
            flexDirection: "column",
            zIndex:        "100",
            fontFamily:    ARABIC_FONT_FAMILY,
            direction:     "rtl",
        });

        const header = document.createElement("div");
        Object.assign(header.style, {
            padding:      "16px",
            borderBottom: "1px solid rgba(59,130,246,0.15)",
            textAlign:    "center",
        });
        header.innerHTML = `
            <div style="color:#3b82f6;font-size:12px;letter-spacing:3px;font-weight:bold;margin-bottom:6px">
                ${ar.night.detectiveRoleLabel}
            </div>
            <div style="color:#e8eef8;font-size:18px;font-weight:bold">${ar.night.detectiveTitle}</div>
            <div style="color:#1e3a5f;font-size:11px;margin-top:4px">${ar.night.detectiveSubtitle}</div>
        `;
        ui.appendChild(header);

        const list = document.createElement("div");
        Object.assign(list.style, {
            flex:          "1",
            overflowY:     "auto",
            padding:       "12px",
            display:       "flex",
            flexDirection: "column",
            gap:           "10px",
        });

        const targets = this.players.filter(p => p.alive && p.id !== socketService.socket.id);

        if (targets.length === 0) {
            const empty = document.createElement("div");
            empty.textContent = ar.night.noSuspects;
            Object.assign(empty.style, {
                color:     "#1e3a5f",
                textAlign: "center",
                marginTop: "40px",
                fontSize:  "14px",
            });
            list.appendChild(empty);
        } else {
            targets.forEach(player => {
                const row = document.createElement("div");
                Object.assign(row.style, {
                    display:      "flex",
                    alignItems:   "center",
                    gap:          "14px",
                    padding:      "12px 16px",
                    borderRadius: "10px",
                    background:   "linear-gradient(145deg, rgba(15,26,48,0.9), rgba(8,13,26,0.95))",
                    border:       "1px solid rgba(59,130,246,0.1)",
                    transition:   "all 0.2s",
                });

                const nameEl = document.createElement("div");
                nameEl.textContent = player.username;
                Object.assign(nameEl.style, {
                    flex:      "1",
                    color:     "#b8c4d8",
                    fontSize:  "15px",
                    fontWeight:"bold",
                    direction: "rtl",
                });

                const btn = document.createElement("button");
                btn.textContent = ar.night.detectiveInspect;
                Object.assign(btn.style, {
                    padding:       "10px 16px",
                    fontSize:      "11px",
                    fontWeight:    "bold",
                    letterSpacing: "2px",
                    border:        "1px solid rgba(59,130,246,0.5)",
                    borderRadius:  "6px",
                    background:    "linear-gradient(180deg, rgba(59,130,246,0.1), transparent)",
                    color:         "#3b82f6",
                    cursor:        "pointer",
                    fontFamily:    ARABIC_FONT_FAMILY,
                    touchAction:   "manipulation",
                    transition:    "all 0.2s",
                    minWidth:      "80px",
                });

                const handleAction = (e: Event) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (this.actionUsed || this._submitLock) return;

                    this._submitLock = true;
                    this.actionUsed  = true;

                    // تعطيل كل الأزرار فوراً
                    list.querySelectorAll<HTMLButtonElement>("button").forEach(b => {
                        b.disabled            = true;
                        b.style.opacity       = "0.3";
                        b.style.pointerEvents = "none";
                    });

                    btn.textContent      = ar.night.detectiveScanning;
                    btn.style.background = "linear-gradient(180deg, #3b82f6, #2563eb)";
                    btn.style.color      = "#000";

                    row.style.borderColor = "#60a5fa";
                    row.style.boxShadow   = "0 0 15px rgba(59,130,246,0.2)";

                    this.cameras.main.flash(300, 0, 50, 120);
                    socketService.socket.emit("detective_check", player.id);
                    this.showToast(ar.night.detectiveInvestigating(player.username), "info");
                };

                btn.addEventListener("click",    handleAction);
                btn.addEventListener("touchend", handleAction, { passive: false });

                row.appendChild(nameEl);
                row.appendChild(btn);
                list.appendChild(row);
            });
        }

        ui.appendChild(list);
        document.body.appendChild(ui);
    }

    // ─── Toast ────────────────────────────────────────────────────────────────
    private showToast(message: string, type: "danger" | "success" | "info") {
        const colorMap = {
            danger:  { bg: 0x1a0505, border: 0xcc2222, text: "#ff4444" },
            success: { bg: 0x051a05, border: 0x22cc22, text: "#44ff44" },
            info:    { bg: 0x05051a, border: 0x2244cc, text: "#4488ff" },
        };
        const c    = colorMap[type];
        const W    = this.scale.width;
        const H    = this.scale.height;
        const toast = this.add.container(W / 2, H - 40).setDepth(20);
        const msgW  = Math.min(message.length * 9 + 48, Math.min(420, W - 20));
        const bg    = this.add.rectangle(0, 0, msgW, 40, c.bg);
        bg.setStrokeStyle(1, c.border);
        const text = this.add.text(0, 0, message, {
            fontSize:   "13px",
            color:      c.text,
            fontFamily: ARABIC_FONT_FAMILY,
        }).setOrigin(0.5);
        toast.add([bg, text]);
        toast.setAlpha(0).setY(H - 10);
        this.tweens.add({ targets: toast, alpha: 1, y: H - 60, duration: 300, ease: "Cubic.easeOut" });
        this.time.delayedCall(2800, () =>
            this.tweens.add({
                targets:    toast,
                alpha:      0,
                y:          H - 40,
                duration:   300,
                onComplete: () => toast.destroy(),
            })
        );
    }

    // ─── Socket Listeners ─────────────────────────────────────────────────────
    private setupSocketListeners() {
        socketService.socket.on("phase_changed", (data: any) => {
            if (data.phase === "NIGHT" || data.phase === "NIGHT_REVIEW") return;
            this.cameras.main.fadeOut(400, 8, 8, 15);
            this.time.delayedCall(400, () =>
                this.scene.start("GameScene", { role: "DETECTIVE", roomId: this.roomId, userType: "PLAYER" })
            );
        });

        socketService.socket.on("back_to_lobby", () => {
            this.cameras.main.fadeOut(300, 8, 8, 15);
            this.time.delayedCall(300, () =>
                this.scene.start("GameScene", { role: "DETECTIVE", roomId: this.roomId, userType: "PLAYER" })
            );
        });

        socketService.socket.on("server_reset", () => {
            socketService.reset();
            document.getElementById("mobile-night-ui")?.remove();
            this.cameras.main.fadeOut(400, 6, 8, 16);
            this.time.delayedCall(400, () => this.scene.start("LobbyScene"));
        });

        socketService.socket.on("detective_result", (data: any) => {
            this._submitLock = false;
            this.showResult(data);
        });

        socketService.socket.on("player_killed", (data: any) => {
            const msg = ar.night.eliminatedNight(data.username);
            this.showToast(msg, "danger");
            this.addNightEventToMobilePanel(msg, "#f87171");
        });
    }

    // ─── Pending events ───────────────────────────────────────────────────────
    private addNightEventToMobilePanel(msg: string, color: string) {
        socketService.pendingEvents.push({ msg, color });
        const panel = document.getElementById("tab-panel-events");
        if (!panel) return;
        const now  = new Date();
        const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
        const card = document.createElement("div");
        card.style.cssText = `
            display:flex;align-items:flex-start;gap:10px;
            padding:10px 12px;border-radius:8px;
            background:rgba(239,68,68,0.1);
            border:1px solid #ef444444;
            border-right:3px solid ${color};
            animation:eventSlideIn 0.3s ease-out;
            direction:rtl;
        `;
        card.innerHTML = `
            <div style="font-size:18px;min-width:22px;text-align:center;margin-top:1px">!</div>
            <div style="flex:1">
                <div style="display:flex;justify-content:space-between;margin-bottom:3px">
                    <span style="font-size:9px;font-weight:bold;letter-spacing:2px;color:${color};
                        font-family:'Courier New',monospace">تم القضاء عليه</span>
                    <span style="font-size:9px;color:#374151;font-family:'Courier New',monospace">${time}</span>
                </div>
                <div style="font-size:13px;color:#e2e8f0;font-family:${ARABIC_FONT_FAMILY}">${msg}</div>
            </div>
        `;
        panel.appendChild(card);
        panel.scrollTop = panel.scrollHeight;
    }

    // ─── Shutdown ─────────────────────────────────────────────────────────────
    shutdown() {
        // تنظيف البطاقات بأمان
        this.playerCards.forEach(card => {
            if (card && card.destroy) card.destroy();
        });
        this.playerCards = [];

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