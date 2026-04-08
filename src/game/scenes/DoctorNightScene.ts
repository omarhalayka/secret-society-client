import Phaser from "phaser";
import { socketService } from "../../socket";
import { ar, ARABIC_FONT_FAMILY } from "../../i18n";

export default class DoctorNightScene extends Phaser.Scene {

    private players: any[] = [];
    private roomId!: string;
    private actionUsed: boolean = false;
    private playerCards: Phaser.GameObjects.Container[] = [];
    private savedPlayerId: string | null = null;
    private healParticles: Array<{
        gfx: Phaser.GameObjects.Graphics;
        x: number; y: number; vy: number; alpha: number; size: number;
    }> = [];
    private isMobile: boolean = false;
    private _submitLock: boolean = false;
    // ✅ آخر هدف محمي (يُستقبل من السيرفر عبر night_targets)
    private lastDoctorTarget: string | null = null;

    private readonly C = {
        bg: 0x08100a, surface: 0x0d1a0f, card: 0x0a1a0c,
        cardHover: 0x0f2a14, borderDim: 0x1a3d20, borderBright: 0x22c55e,
        accent: 0x22c55e, accentGlow: 0x4ade80,
    };

    constructor() { super("DoctorNightScene"); }

    private normalizePlayers(players: any[]) {
        return (players || []).map((player) => ({
            ...player,
            id: player?.playerId || player?.id || null,
            playerId: player?.playerId || player?.id || null,
            socketId: player?.socketId || null,
        }));
    }

    private getEligibleTargets() {
        return this.players.filter((player) => player.alive && player.id !== socketService.playerId);
    }

    init(data: any) {
        this.roomId        = data.roomId;
        this.players       = this.normalizePlayers(data.players || []);
        this.actionUsed    = false;
        this._submitLock   = false;
        this.savedPlayerId = null;
        this.healParticles = [];
        this.lastDoctorTarget = null;
        // ✅ إزالة كل الـ listeners القديمة
        socketService.socket.off("phase_changed");
        socketService.socket.off("player_killed");
        socketService.socket.off("back_to_lobby");
        socketService.socket.off("doctor_action_registered");
        socketService.socket.off("doctor_error");
        socketService.socket.off("server_reset");
        socketService.socket.off("night_targets");
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

        // ✅ نستقبل night_targets أول شي قبل رسم البطاقات
        this.setupSocketListeners();
        socketService.socket.emit("request_night_targets");

        if (this.isMobile) {
            this.createMobileUI(W, H);
        } else {
            this.drawTitle(W);
            this.drawPlayerCards(W, H);
        }
    }

    update(_time: number, _delta: number) {
        const W = this.scale.width;
        const H = this.scale.height;
        if (Math.random() < 0.12) {
            this.healParticles.push({
                gfx:   this.add.graphics().setDepth(0),
                x:     Math.random() * W,
                y:     H + 10,
                vy:    -(0.4 + Math.random() * 0.9),
                alpha: 0.6 + Math.random() * 0.4,
                size:  1 + Math.random() * 2,
            });
        }
        this.healParticles = this.healParticles.filter(p => {
            p.y     += p.vy;
            p.alpha -= 0.003;
            if (p.alpha <= 0) { p.gfx.destroy(); return false; }
            p.gfx.clear();
            p.gfx.fillStyle(0x22c55e, p.alpha * 0.7);
            p.gfx.fillCircle(p.x, p.y, p.size);
            return true;
        });
    }

    // ─── Background ───────────────────────────────────────────────────────────
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
        this.add.text(20, 28, ar.night.doctorRoleLabel, {
            fontSize: "14px", color: "#22c55e",
            fontFamily: ARABIC_FONT_FAMILY, fontStyle: "bold",
        }).setOrigin(0, 0.5).setDepth(3);
        this.add.text(W / 2, 28, ar.night.room(this.roomId?.substring(0, 8).toUpperCase()), {
            fontSize: "11px", color: "#2d6640",
            fontFamily: ARABIC_FONT_FAMILY,
        }).setOrigin(0.5, 0.5).setDepth(3);
        this.add.text(W - 20, 28, ar.night.nightPhase, {
            fontSize: "11px", color: "#2d6640",
            fontFamily: ARABIC_FONT_FAMILY,
        }).setOrigin(1, 0.5).setDepth(3);
    }

    private drawTitle(W: number) {
        const titleY = 110;
        const title = this.add.text(W / 2, titleY, ar.night.doctorTitle, {
            fontSize: "32px", color: "#e8f1e8",
            fontFamily: ARABIC_FONT_FAMILY, fontStyle: "bold", align: "center",
        }).setOrigin(0.5).setDepth(2).setAlpha(0);
        this.tweens.add({ targets: title, alpha: 1, y: titleY - 5, duration: 700, ease: "Cubic.easeOut", delay: 300 });

        const sub = this.add.text(W / 2, titleY + 38, ar.night.doctorSubtitle, {
            fontSize: "13px", color: "#2d6640",
            fontFamily: ARABIC_FONT_FAMILY, align: "center",
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
        const targets = this.getEligibleTargets();
        if (!targets.length) return;

        let cardW = 140, cardH = 180, gap = 24;
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
            const isMe = player.id === socketService.playerId;
            // ✅ فحص إذا كان هذا اللاعب هو الهدف المقيّد
            const isRestricted = this.lastDoctorTarget !== null && player.id === this.lastDoctorTarget;
            const x = startX + i * (cardW + gap);
            const container = this.add.container(x, cardY).setDepth(5).setAlpha(0);

            const shadow = this.add.graphics();
            shadow.fillStyle(0x000000, 0.6);
            shadow.fillRoundedRect(-cardW / 2 + 4, -cardH / 2 + 6, cardW, cardH, 12);

            const bg = this.add.graphics();
            let isSelected = false;
            const drawCardBg = (hover: boolean, selected: boolean) => {
                bg.clear();
                if (isRestricted && !selected) {
                    // ✅ بطاقة مقيّدة — مظلمة مع حد رمادي
                    bg.fillStyle(0x0a0a0a, 1);
                    bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 12);
                    bg.lineStyle(1, 0x2a2a2a, 0.5);
                } else if (selected) {
                    bg.fillGradientStyle(0x0a2a0a, 0x0a2a0a, 0x051a05, 0x051a05, 1);
                    bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 12);
                    bg.lineStyle(2, this.C.accentGlow, 1);
                } else if (hover) {
                    bg.fillGradientStyle(0x0f2a14, 0x0f2a14, 0x0a1a0c, 0x0a1a0c, 1);
                    bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 12);
                    bg.lineStyle(1, this.C.borderBright, 0.6);
                } else {
                    bg.fillGradientStyle(0x0a1a0c, 0x0a1a0c, 0x060e07, 0x060e07, 1);
                    bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 12);
                    bg.lineStyle(1, this.C.borderDim, 0.5);
                }
                bg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 12);
            };
            drawCardBg(false, false);

            const avatarBg = this.add.circle(0, -cardH * 0.23, Math.floor(cardW * 0.21),
                isRestricted ? 0x1a1a1a : 0x1a3d20);
            avatarBg.setStrokeStyle(1, isRestricted ? 0x2a2a2a : this.C.borderDim);

            const avatarIcon = this.add.text(0, -cardH * 0.23,
                isRestricted ? "🚫" : "✚", {
                fontSize: `${Math.floor(cardW * 0.2)}px`,
                fontFamily: ARABIC_FONT_FAMILY,
                color: isRestricted ? "#444444" : "#22c55e",
            }).setOrigin(0.5);

            // نبض (فقط للبطاقات غير المقيّدة)
            const pulse = this.add.circle(0, -cardH * 0.23, Math.floor(cardW * 0.24), this.C.accent, 0);
            if (!isRestricted) {
                this.tweens.add({
                    targets: pulse,
                    alpha: 0.15, scaleX: 1.3, scaleY: 1.3,
                    duration: 1200, yoyo: true, repeat: -1, delay: i * 200,
                });
            }

            const name = this.add.text(0, cardH * 0.07,
                player.username.toUpperCase(), {
                fontSize: `${Math.max(10, Math.floor(cardW * 0.086))}px`,
                color: isRestricted ? "#444444" : (isMe ? "#a3e6b4" : "#c8dac8"),
                fontFamily: ARABIC_FONT_FAMILY,
                fontStyle: isMe ? "bold" : "normal",
                align: "center",
            }).setOrigin(0.5);

            const btnBg = this.add.graphics();
            const btnH = Math.max(28, Math.floor(cardH * 0.16));
            const btnW2 = cardW - 20;
            const btnY = cardH * 0.38;
            const drawBtnBg = (hover: boolean) => {
                btnBg.clear();
                if (isRestricted) {
                    btnBg.fillStyle(0x1a1a1a, 1);
                    btnBg.fillRoundedRect(-btnW2 / 2, btnY - btnH / 2, btnW2, btnH, 6);
                    btnBg.lineStyle(1, 0x2a2a2a, 0.5);
                } else {
                    btnBg.fillStyle(this.C.accent, hover ? 0.15 : 0);
                    btnBg.fillRoundedRect(-btnW2 / 2, btnY - btnH / 2, btnW2, btnH, 6);
                    btnBg.lineStyle(1, this.C.accent, 1);
                }
                btnBg.strokeRoundedRect(-btnW2 / 2, btnY - btnH / 2, btnW2, btnH, 6);
            };
            drawBtnBg(false);

            // ✅ نص الزر — يُظهر "محظور" للبطاقة المقيّدة
            const btnLabelText = isRestricted
                ? "محظور ⛔"
                : ar.night.doctorProtect;
            const btnLabel = this.add.text(0, btnY, btnLabelText, {
                fontSize: `${Math.max(9, Math.floor(cardH * 0.075))}px`,
                color: isRestricted ? "#444444" : "#22c55e",
                fontFamily: ARABIC_FONT_FAMILY,
                fontStyle: "bold",
            }).setOrigin(0.5);

            // ✅ label "نفس الليلة الماضية" للبطاقة المقيّدة
            let restrictedLabel: Phaser.GameObjects.Text | null = null;
            if (isRestricted) {
                restrictedLabel = this.add.text(0, -cardH * 0.45,
                    "الليلة الماضية", {
                    fontSize: "9px",
                    color: "#ef4444",
                    fontFamily: ARABIC_FONT_FAMILY,
                }).setOrigin(0.5);
            }

            const items: any[] = [shadow, bg, pulse, avatarBg, avatarIcon, name, btnBg, btnLabel];
            if (restrictedLabel) items.push(restrictedLabel);
            container.add(items);

            container.setData("drawBg", drawCardBg);
            container.setData("drawBtnBg", drawBtnBg);
            container.setData("btnLabel", btnLabel);
            container.setData("isRestricted", isRestricted);

            // ✅ إضافة الـ interactive فقط للبطاقات غير المقيّدة
            if (!isRestricted) {
                container.setInteractive(
                    new Phaser.Geom.Rectangle(-cardW / 2, -cardH / 2, cardW, cardH),
                    Phaser.Geom.Rectangle.Contains
                );

                container.on("pointerover", () => {
                    if (this.actionUsed) return;
                    drawCardBg(true, false);
                    drawBtnBg(true);
                    btnLabel.setColor("#000000");
                    this.tweens.add({ targets: container, scaleX: 1.05, scaleY: 1.05, y: cardY - 4, duration: 150 });
                });
                container.on("pointerout", () => {
                    if (isSelected) return;
                    drawCardBg(false, false);
                    drawBtnBg(false);
                    btnLabel.setColor("#22c55e");
                    this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, y: cardY, duration: 150 });
                });
                container.on("pointerdown", () => {
                    if (this.actionUsed || this._submitLock) return;
                    this._submitLock = true;
                    this.actionUsed  = true;
                    isSelected = true;

                    // ✅ تعطيل كل البطاقات بأمان (بدون disableInteractive على non-interactive)
                    this.playerCards.forEach(c => {
                        if (c && c.active && c.input) {
                            c.disableInteractive();
                        }
                    });

                    drawCardBg(false, true);
                    drawBtnBg(true);
                    btnLabel.setColor("#000000").setText(ar.night.doctorSaving);

                    this.savedPlayerId = player.id;
                    this.cameras.main.flash(400, 0, 100, 0);
                    socketService.socket.emit("doctor_save", player.id);
                });
            } else {
                // ✅ للبطاقات المقيّدة — نُظهر toast لما يضغط عليها
                container.setInteractive(
                    new Phaser.Geom.Rectangle(-cardW / 2, -cardH / 2, cardW, cardH),
                    Phaser.Geom.Rectangle.Contains
                );
                container.on("pointerdown", () => {
                    if (this.actionUsed) return;
                    this.showToast(
                        "لا يمكنك حماية نفس اللاعب ليلتين متتاليتين ⛔",
                        "danger"
                    );
                });
            }

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
            background:    "linear-gradient(180deg, #08100a 0%, #040a05 100%)",
            display:       "flex",
            flexDirection: "column",
            zIndex:        "100",
            fontFamily:    ARABIC_FONT_FAMILY,
            direction:     "rtl",
        });

        const header = document.createElement("div");
        Object.assign(header.style, {
            padding:     "16px",
            borderBottom:"1px solid rgba(34,197,94,0.15)",
            textAlign:   "center",
        });
        header.innerHTML = `
            <div style="color:#22c55e;font-size:12px;letter-spacing:3px;font-weight:bold;margin-bottom:6px;font-family:${ARABIC_FONT_FAMILY}">
                ${ar.night.doctorRoleLabel}
            </div>
            <div style="color:#e8f1e8;font-size:18px;font-weight:bold;font-family:${ARABIC_FONT_FAMILY}">${ar.night.doctorTitle}</div>
            <div style="color:#2d6640;font-size:11px;margin-top:4px;font-family:${ARABIC_FONT_FAMILY}">${ar.night.doctorSubtitle}</div>
        `;
        ui.appendChild(header);

        // ✅ banner تنبيه إذا كان هناك قيد
        if (this.lastDoctorTarget !== null) {
            const restrictedPlayer = this.players.find(p => p.id === this.lastDoctorTarget);
            if (restrictedPlayer) {
                const banner = document.createElement("div");
                Object.assign(banner.style, {
                    margin:     "8px 12px 0",
                    padding:    "8px 12px",
                    background: "rgba(239,68,68,0.1)",
                    border:     "1px solid rgba(239,68,68,0.3)",
                    borderRadius:"6px",
                    fontSize:   "11px",
                    color:      "#ef4444",
                    fontFamily: ARABIC_FONT_FAMILY,
                    direction:  "rtl",
                    textAlign:  "center",
                });
                banner.textContent = `⛔ لا يمكنك حماية "${restrictedPlayer.username}" مجدداً هذه الليلة`;
                ui.appendChild(banner);
            }
        }

        const list = document.createElement("div");
        Object.assign(list.style, {
            flex:          "1",
            overflowY:     "auto",
            padding:       "12px",
            display:       "flex",
            flexDirection: "column",
            gap:           "10px",
        });

        const targets = this.getEligibleTargets();

        if (targets.length === 0) {
            const empty = document.createElement("div");
            empty.textContent = ar.night.noPlayers;
            Object.assign(empty.style, {
                color:     "#2d6640",
                textAlign: "center",
                marginTop: "40px",
                fontSize:  "14px",
            });
            list.appendChild(empty);
        } else {
            targets.forEach(player => {
                const isMe         = player.id === socketService.playerId;
                // ✅ فحص القيد
                const isRestricted = this.lastDoctorTarget !== null && player.id === this.lastDoctorTarget;

                const row = document.createElement("div");
                Object.assign(row.style, {
                    display:      "flex",
                    alignItems:   "center",
                    gap:          "14px",
                    padding:      "12px 16px",
                    borderRadius: "10px",
                    background:   isRestricted
                        ? "linear-gradient(145deg, rgba(50,0,0,0.5), rgba(30,0,0,0.4))"
                        : (isMe
                            ? "linear-gradient(145deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05))"
                            : "linear-gradient(145deg, rgba(10,26,12,0.9), rgba(5,13,6,0.95))"),
                    border:       `1px solid ${isRestricted ? "rgba(239,68,68,0.2)" : (isMe ? "rgba(34,197,94,0.4)" : "rgba(34,197,94,0.1)")}`,
                    opacity:      isRestricted ? "0.7" : "1",
                    transition:   "all 0.2s",
                });

                const nameEl = document.createElement("div");
                nameEl.textContent = player.username + (isMe ? ` (${ar.night.you})` : "");
                Object.assign(nameEl.style, {
                    flex:       "1",
                    color:      isRestricted ? "#664444" : (isMe ? "#a3e6b4" : "#b8c8b8"),
                    fontSize:   "15px",
                    fontWeight: isMe ? "bold" : "normal",
                    direction:  "rtl",
                    fontFamily: ARABIC_FONT_FAMILY,
                });

                const btn = document.createElement("button");
                btn.id = `doctor-btn-${player.id}`;

                if (isRestricted) {
                    // ✅ زر مقيّد — يُظهر رسالة عند الضغط
                    btn.textContent = "⛔ محظور";
                    Object.assign(btn.style, {
                        padding:      "10px 16px",
                        fontSize:     "11px",
                        fontWeight:   "bold",
                        border:       "1px solid rgba(239,68,68,0.3)",
                        borderRadius: "6px",
                        background:   "rgba(239,68,68,0.08)",
                        color:        "#664444",
                        cursor:       "not-allowed",
                        fontFamily:   ARABIC_FONT_FAMILY,
                        minWidth:     "80px",
                        opacity:      "0.7",
                    });
                    btn.addEventListener("click", (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.showToast(
                            "لا يمكنك حماية نفس اللاعب ليلتين متتاليتين ⛔",
                            "danger"
                        );
                    });
                } else {
                    btn.textContent = ar.night.doctorProtect;
                    Object.assign(btn.style, {
                        padding:      "10px 16px",
                        fontSize:     "11px",
                        fontWeight:   "bold",
                        letterSpacing:"2px",
                        border:       "1px solid rgba(34,197,94,0.5)",
                        borderRadius: "6px",
                        background:   "linear-gradient(180deg, rgba(34,197,94,0.1), transparent)",
                        color:        "#22c55e",
                        cursor:       "pointer",
                        fontFamily:   ARABIC_FONT_FAMILY,
                        touchAction:  "manipulation",
                        transition:   "all 0.2s",
                        minWidth:     "80px",
                    });

                    const handleAction = (e: Event) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (this.actionUsed || this._submitLock) return;

                        this._submitLock = true;
                        this.actionUsed  = true;

                        list.querySelectorAll<HTMLButtonElement>("button").forEach(b => {
                            b.disabled            = true;
                            b.style.opacity       = "0.4";
                            b.style.cursor        = "not-allowed";
                            b.style.pointerEvents = "none";
                        });

                        btn.textContent      = ar.night.doctorSaving;
                        btn.style.background = "linear-gradient(180deg, #22c55e, #16a34a)";
                        btn.style.color      = "#000";

                        this.savedPlayerId = player.id;
                        this.cameras.main.flash(400, 0, 100, 0);
                        socketService.socket.emit("doctor_save", player.id);
                    };

                    btn.addEventListener("click",    handleAction);
                    btn.addEventListener("touchend", handleAction, { passive: false });
                }

                row.appendChild(nameEl);
                row.appendChild(btn);
                list.appendChild(row);
            });
        }

        ui.appendChild(list);
        document.body.appendChild(ui);
    }

    // ─── Apply accepted save (desktop) ───────────────────────────────────────
    private applyAcceptedDoctorSave(targetId: string, targetUsername: string) {
        this.showToast(ar.night.doctorProtecting(targetUsername), "success");

        const alivePlayers = this.getEligibleTargets();
        const idx = alivePlayers.findIndex(p => p.id === targetId);
        if (idx >= 0 && this.playerCards[idx]) {
            this.tweens.add({
                targets:  this.playerCards[idx],
                scaleX:   1.05,
                scaleY:   1.05,
                duration: 200,
                yoyo:     true,
            });
        }

        const mobileBtn = document.getElementById(`doctor-btn-${targetId}`) as HTMLButtonElement;
        if (mobileBtn) {
            mobileBtn.textContent   = ar.night.doctorProtected;
            mobileBtn.style.background = "linear-gradient(180deg, #22c55e, #16a34a)";
            mobileBtn.style.color   = "#000";
        }
    }

    // ─── Toast ────────────────────────────────────────────────────────────────
    private showToast(message: string, type: "danger" | "success" | "info") {
        const colorMap = {
            danger:  { bg: 0x1a0505, border: 0xcc2222, text: "#ff4444" },
            success: { bg: 0x051a05, border: 0x22cc22, text: "#44ff44" },
            info:    { bg: 0x05051a, border: 0x2244cc, text: "#4488ff" },
        };
        const c     = colorMap[type];
        const W     = this.scale.width;
        const H     = this.scale.height;
        const toast = this.add.container(W / 2, H - 40).setDepth(20);
        const msgW  = Math.min(message.length * 9 + 48, Math.min(500, W - 20));
        const bg    = this.add.rectangle(0, 0, msgW, 44, c.bg);
        bg.setStrokeStyle(1, c.border);
        const text = this.add.text(0, 0, message, {
            fontSize:   "13px",
            color:      c.text,
            fontFamily: ARABIC_FONT_FAMILY,
        }).setOrigin(0.5);
        toast.add([bg, text]);
        toast.setAlpha(0).setY(H - 10);
        this.tweens.add({ targets: toast, alpha: 1, y: H - 70, duration: 300, ease: "Cubic.easeOut" });
        this.time.delayedCall(3000, () =>
            this.tweens.add({
                targets:    toast,
                alpha:      0,
                y:          H - 40,
                duration:   300,
                onComplete: () => { if (toast.active) toast.destroy(); },
            })
        );
    }

    // ─── Socket Listeners ─────────────────────────────────────────────────────
    private setupSocketListeners() {
        // ✅ استقبال lastTarget من السيرفر وإعادة رسم البطاقات إذا لزم
        socketService.socket.on("night_targets", (data: any) => {
            const playersChanged = Array.isArray(data?.players);
            const nextLastTarget = typeof data?.lastTarget === "string" ? data.lastTarget : null;

            if (Array.isArray(data?.players)) {
                this.players = this.normalizePlayers(data.players);
            }
            const targetChanged = nextLastTarget !== this.lastDoctorTarget;
            this.lastDoctorTarget = nextLastTarget;

            if (!playersChanged && !targetChanged) return;

            if (!this.isMobile) {
                this.playerCards.forEach(c => { if (c?.active) c.destroy(); });
                this.playerCards = [];
                const W = this.scale.width;
                const H = this.scale.height;
                this.drawPlayerCards(W, H);
            } else {
                document.getElementById("mobile-night-ui")?.remove();
                const W = this.scale.width;
                const H = this.scale.height;
                this.createMobileUI(W, H);
            }
        });

        socketService.socket.on("phase_changed", (data: any) => {
            if (data.phase === "NIGHT" || data.phase === "NIGHT_REVIEW") return;
            this.cameras.main.fadeOut(400, 8, 16, 10);
            this.time.delayedCall(400, () =>
                this.scene.start("GameScene", { role: "DOCTOR", roomId: this.roomId, userType: "PLAYER" })
            );
        });

        socketService.socket.on("back_to_lobby", () => {
            this.cameras.main.fadeOut(300, 8, 16, 10);
            this.time.delayedCall(300, () =>
                this.scene.start("GameScene", { role: "DOCTOR", roomId: this.roomId, userType: "PLAYER" })
            );
        });

        socketService.socket.on("server_reset", () => {
            socketService.reset();
            document.getElementById("mobile-night-ui")?.remove();
            this.cameras.main.fadeOut(400, 6, 8, 16);
            this.time.delayedCall(400, () => this.scene.start("LobbyScene"));
        });

        socketService.socket.on("doctor_error", (data: any) => {
            // ✅ تحرير القفل عند الخطأ
            this.actionUsed    = false;
            this._submitLock   = false;
            this.savedPlayerId = null;

            // إعادة تفعيل الأزرار في الموبايل
            const ui = document.getElementById("mobile-night-ui");
            if (ui) {
                ui.querySelectorAll<HTMLButtonElement>("button").forEach(b => {
                    // لا نُعيد تفعيل الأزرار المقيّدة
                    if (b.textContent?.includes("⛔")) return;
                    b.disabled            = false;
                    b.style.opacity       = "1";
                    b.style.cursor        = "pointer";
                    b.style.pointerEvents = "auto";
                    b.textContent         = ar.night.doctorProtect;
                    b.style.background    = "linear-gradient(180deg, rgba(34,197,94,0.1), transparent)";
                    b.style.color         = "#22c55e";
                });
            }
            // ✅ إعادة تفعيل البطاقات بأمان
            this.playerCards.forEach(c => {
                if (c?.active) c.destroy();
            });
            this.playerCards = [];
            if (!this.isMobile) {
                this.drawPlayerCards(this.scale.width, this.scale.height);
            }
            this.showToast(data.message || ar.game.doctorSelectionError, "danger");
        });

        socketService.socket.on("doctor_action_registered", (data: any) => {
            if (!data?.targetId) return;
            this._submitLock = false;
            this.applyAcceptedDoctorSave(data.targetId, data.targetUsername);
        });

        socketService.socket.on("player_killed", (data: any) => {
            const msg = ar.night.eliminatedNight(data.username);
            if (data.id === this.savedPlayerId) {
                this.showToast(ar.night.failedSave(data.username), "danger");
            } else {
                this.showToast(msg, "danger");
            }
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
            direction:rtl;
        `;
        card.innerHTML = `
            <div style="font-size:18px;min-width:22px;text-align:center;margin-top:1px">!</div>
            <div style="flex:1">
                <div style="display:flex;justify-content:space-between;margin-bottom:3px">
                    <span style="font-size:9px;font-weight:bold;color:${color};font-family:${ARABIC_FONT_FAMILY}">تم القضاء عليه</span>
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
        document.getElementById("mobile-night-ui")?.remove();
        this.healParticles.forEach(p => p.gfx.destroy());
        this.healParticles = [];
        socketService.socket.off("phase_changed");
        socketService.socket.off("player_killed");
        socketService.socket.off("back_to_lobby");
        socketService.socket.off("server_reset");
        socketService.socket.off("doctor_error");
        socketService.socket.off("doctor_action_registered");
        socketService.socket.off("night_targets");
    }
}
