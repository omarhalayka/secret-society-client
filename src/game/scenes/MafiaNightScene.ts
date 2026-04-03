// src/scenes/night/MafiaNightScene.ts
// ✅ الإصلاح: منع تكرار الهدف ليلتين متتاليتين - عرض البطاقات الممنوعة مع تعطيلها
import Phaser from "phaser";
import { socketService } from "../../socket";
import { ar, ARABIC_FONT_FAMILY } from "../../i18n";

export default class MafiaNightScene extends Phaser.Scene {

    private players: any[] = [];
    private roomId!: string;
    private actionUsed: boolean = false;
    private playerCards: Phaser.GameObjects.Container[] = [];
    private killedPlayerId: string | null = null;
    private isMobile: boolean = false;
    private isSoloMafia: boolean = false;
    private mafiaTeamCount: number = 1;
    private myPlayer: any = null;

    // ✅ متغيرات منع التكرار
    private lastTargetPlayerId: string | null = null;  // آخر هدف من الليلة الماضية
    private restrictedPlayerIds: string[] = [];  // قائمة الأهداف الممنوعة

    // ✅ متغير لlastTarget من السيرفر
    private serverLastTarget: string | null = null;

    // Effects
    private embers: Array<{
        gfx: Phaser.GameObjects.Graphics;
        x: number; y: number; vx: number; vy: number;
        life: number; maxLife: number; size: number;
    }> = [];

    private readonly C = {
        bg: 0x080810, surface: 0x0f0f18, card: 0x130a0a,
        cardHover: 0x1f0f0f, borderDim: 0x2a1515, borderBright: 0xcc2222,
        accent: 0xcc2222, accentGlow: 0xff4444, restricted: 0x444444,
    };

    constructor() { super("MafiaNightScene"); }

    private normalizePlayers(players: any[]) {
        return (players || []).map((player) => ({
            ...player,
            id: player?.playerId || player?.id || null,
            playerId: player?.playerId || player?.id || null,
            socketId: player?.socketId || null,
        }));
    }

    init(data: any) {
        this.roomId = data.roomId;
        this.players = this.normalizePlayers(data.players || []);
        this.actionUsed = false;
        this.killedPlayerId = null;
        this.embers = [];
        this.restrictedPlayerIds = [];
        this.lastTargetPlayerId = null;
        this.serverLastTarget = data.lastTarget || null;

        this.myPlayer = this.players.find((p) => p.id === socketService.playerId) || null;
        this.mafiaTeamCount = Math.max(1, this.players.filter((p) => p.role === "MAFIA" && p.alive).length);

        // ✅ إذا كان هناك lastTarget من السيرفر، نضيفه للممنوعين
        if (this.serverLastTarget) {
            this.restrictedPlayerIds.push(this.serverLastTarget);
            this.lastTargetPlayerId = this.serverLastTarget;
        }

        socketService.socket.off("phase_changed");
        socketService.socket.off("player_killed");
        socketService.socket.off("back_to_lobby");
        socketService.socket.off("night_targets");
        socketService.socket.off("mafia_suggestion");
        socketService.socket.off("mafia_chat_message");
        socketService.socket.off("mafia_action_registered");
        socketService.socket.off("server_reset");
        socketService.socket.off("mafia_error");
    }

    create() {
        document.getElementById("mobile-game-ui")?.remove();
        document.getElementById("mobile-voting-overlay")?.remove();
        document.getElementById("mobile-admin-bar")?.remove();
        document.getElementById("mobile-night-ui")?.remove();
        document.getElementById("mafia-desktop-chat")?.remove();

        const W = this.scale.width;
        const H = this.scale.height;
        this.isMobile = W < 700;

        this.isSoloMafia = this.mafiaTeamCount <= 1;

        this.cameras.main.setBackgroundColor("#080810");
        this.cameras.main.fadeIn(700, 8, 8, 16);

        this.setupSocketListeners();
        socketService.socket.emit("request_night_targets");

        this.drawBackground(W, H);
        this.drawTopBar(W);

        if (this.isMobile) {
            this.createMobileUI(W, H);
        } else {
            this.drawTitle(W);
            this.drawPlayerCards(W, H);
            if (!this.isSoloMafia && !(this.myPlayer && !this.myPlayer.alive)) {
                this.createDesktopChatPanel();
            }
        }
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

    // ✅ دالة فحص إذا كان الهدف ممنوع
    private isTargetRestricted(playerId: string): boolean {
        return this.restrictedPlayerIds.includes(playerId);
    }

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

    private drawTopBar(W: number) {
        this.add.rectangle(0, 0, W, 56, this.C.surface).setOrigin(0).setDepth(2);
        const line = this.add.graphics().setDepth(3);
        line.lineStyle(2, this.C.accent, 0.8);
        line.moveTo(0, 56); line.lineTo(W, 56); line.strokePath();

        // ✅ رسالة التنبيه إذا كان هناك هدف ممنوع
        let alertText = "";
        if (this.lastTargetPlayerId) {
            const lastPlayer = this.players.find(p => p.id === this.lastTargetPlayerId);
            if (lastPlayer) {
                alertText = ` ⛔ ${lastPlayer.username}`;
            }
        }

        this.add.text(20, 28, ar.night.mafiaRoleLabel + alertText, {
            fontSize: "14px", color: "#cc2222",
            fontFamily: ARABIC_FONT_FAMILY, fontStyle: "bold", align: "right"
        }).setOrigin(0, 0.5).setDepth(3);

        this.add.text(W / 2, 28, ar.night.room(this.roomId?.substring(0, 8).toUpperCase()), {
            fontSize: "11px", color: "#664444",
            fontFamily: ARABIC_FONT_FAMILY, align: "center"
        }).setOrigin(0.5, 0.5).setDepth(3);

        this.add.text(W - 20, 28, ar.night.nightPhase, {
            fontSize: "11px", color: "#664444",
            fontFamily: ARABIC_FONT_FAMILY, align: "right"
        }).setOrigin(1, 0.5).setDepth(3);
    }

    private drawTitle(W: number) {
        const isDead = this.myPlayer && !this.myPlayer.alive;
        const titleY = 110;
        const titleText = isDead ? ar.night.mafiaDeadTitle : ar.night.mafiaTitle;
        const subText = isDead ? ar.night.mafiaDeadSubtitle : ar.night.mafiaSubtitle;
        const title = this.add.text(W / 2, titleY, titleText, {
            fontSize: "32px", color: isDead ? "#664444" : "#f1e8e8",
            fontFamily: ARABIC_FONT_FAMILY, fontStyle: "bold", align: "center",
        }).setOrigin(0.5).setDepth(2).setAlpha(0);
        this.tweens.add({ targets: title, alpha: 1, y: titleY - 5, duration: 700, ease: "Cubic.easeOut", delay: 300 });
        const sub = this.add.text(W / 2, titleY + 38, subText, {
            fontSize: "13px", color: "#664444",
            fontFamily: ARABIC_FONT_FAMILY, align: "center"
        }).setOrigin(0.5).setDepth(2).setAlpha(0);
        this.tweens.add({ targets: sub, alpha: 1, duration: 600, delay: 500 });
        const divider = this.add.graphics().setDepth(2).setAlpha(0);
        divider.lineStyle(1, this.C.accent, 0.4);
        divider.moveTo(W / 2 - 120, titleY + 58); divider.lineTo(W / 2 + 120, titleY + 58); divider.strokePath();
        this.tweens.add({ targets: divider, alpha: 1, duration: 500, delay: 600 });
    }

    private createDesktopChatPanel() {
        document.getElementById("mafia-desktop-chat")?.remove();
        const isDead = this.myPlayer && !this.myPlayer.alive;

        const panel = document.createElement("div");
        panel.id = "mafia-desktop-chat";
        Object.assign(panel.style, {
            position: "fixed", top: "70px", right: "16px",
            width: "280px", bottom: isDead ? "16px" : "70px",
            zIndex: "50", backgroundColor: "rgba(8,4,4,0.92)",
            border: "1px solid #2a1515", borderRadius: "10px",
            display: "flex", flexDirection: "column",
            fontFamily: ARABIC_FONT_FAMILY,
            boxShadow: "0 0 30px rgba(204,34,34,0.15)",
        });

        panel.innerHTML = `
            <div style="padding:10px 14px;border-bottom:1px solid #2a1515;background:rgba(0,0,0,0.3);border-radius:10px 10px 0 0">
                <div style="color:#cc2222;font-size:10px;font-weight:bold">${ar.night.mafiaChannel}</div>
            </div>
            <div id="mafia-suggestion-bar-d" style="display:none;padding:6px 12px;background:rgba(204,34,34,0.08);border-bottom:1px solid #2a1515;direction:rtl">
                <span style="color:#664444;font-size:9px">الاقتراح الحالي: </span>
                <span id="suggestion-name-d" style="color:#ff4444;font-size:11px;font-weight:bold"></span>
                <span id="suggestion-by-d" style="color:#664444;font-size:9px"></span>
            </div>
            <div id="mafia-chat-box-d" style="flex:1;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:5px">
                <div style="color:#3a1515;font-size:9px;text-align:center">${ar.night.mafiaChannel}</div>
            </div>
        `;

        if (!isDead) {
            const inputDiv = document.createElement("div");
            inputDiv.style.cssText = "display:flex;gap:6px;padding:8px;border-top:1px solid #2a1515";
            inputDiv.innerHTML = `
                <input id="mafia-chat-input-d" type="text" placeholder="اكتب رسالة..."
                    style="flex:1;padding:6px 10px;background:#0a0505;color:#f1e8e8;border:1px solid #2a1515;border-radius:5px;font-size:12px;font-family:'Courier New',monospace;outline:none"/>
                <button id="mafia-chat-send-d" style="padding:6px 10px;border:1px solid #cc2222;border-radius:5px;background:transparent;color:#cc2222;font-size:11px;cursor:pointer;font-family:${ARABIC_FONT_FAMILY}">إرسال</button>
            `;
            panel.appendChild(inputDiv);

            const input = inputDiv.querySelector<HTMLInputElement>("#mafia-chat-input-d")!;
            const sendBtn = inputDiv.querySelector<HTMLButtonElement>("#mafia-chat-send-d")!;
            const sendMsg = () => {
                const msg = input.value.trim();
                if (!msg) return;
                socketService.socket.emit("mafia_chat", msg);
                input.value = "";
            };
            sendBtn.addEventListener("click", sendMsg);
            input.addEventListener("keydown", e => { if (e.key === "Enter") sendMsg(); });
        }

        document.body.appendChild(panel);
    }

    private addDesktopChatMessage(from: string, message: string) {
        const chatBox = document.getElementById("mafia-chat-box-d");
        if (!chatBox) return;
        const isMine = from === (this.myPlayer?.username);
        const msg = document.createElement("div");
        Object.assign(msg.style, {
            padding: "5px 8px", borderRadius: "6px", maxWidth: "90%",
            alignSelf: isMine ? "flex-end" : "flex-start",
            backgroundColor: isMine ? "rgba(204,34,34,0.2)" : "rgba(255,255,255,0.04)",
            border: isMine ? "1px solid #cc2222" : "1px solid #2a1515",
            fontSize: "12px",
        });
        msg.innerHTML = `<span style="color:#664444;font-size:9px">${isMine ? ar.night.you : from}: </span><span style="color:#f1e8e8">${message}</span>`;
        chatBox.appendChild(msg);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    private updateDesktopSuggestion(suggestedBy: string, targetUsername: string) {
        const bar = document.getElementById("mafia-suggestion-bar-d");
        const name = document.getElementById("suggestion-name-d");
        const by = document.getElementById("suggestion-by-d");
        if (bar) bar.style.display = "block";
        if (name) name.textContent = targetUsername;
        if (by) by.textContent = ` (${suggestedBy})`;
    }

    // ✅ تعديل دالة رسم البطاقات: عرض الممنوعين مع تعطيلهم بدلاً من استبعادهم
    private drawPlayerCards(W: number, H: number) {
        // جميع الأهداف المحتملة (أحياء، ليسوا مافيا، ليسوا اللاعب نفسه)
        const allTargets = this.players.filter((p) =>
            p.alive &&
            p.id !== socketService.playerId &&
            p.role !== "MAFIA"
        );

        if (!allTargets.length) {
            const noTargetsText = this.add.text(W / 2, H / 2, ar.night.noTargets || "لا توجد أهداف متاحة", {
                fontSize: "16px", color: "#664444",
                fontFamily: ARABIC_FONT_FAMILY, align: "center",
            }).setOrigin(0.5).setDepth(5);
            return;
        }

        let cardW = 140, cardH = 180, gap = 24;
        const naturalW = allTargets.length * cardW + (allTargets.length - 1) * gap;
        if (naturalW > W - 40) {
            const s = (W - 40) / naturalW;
            cardW = Math.floor(cardW * s);
            cardH = Math.floor(cardH * s);
            gap = Math.floor(gap * s);
        }
        const totalW = allTargets.length * cardW + (allTargets.length - 1) * gap;
        const startX = W / 2 - totalW / 2 + cardW / 2;
        const cardY = H / 2 + 30;

        allTargets.forEach((player, i) => {
            const isRestricted = this.isTargetRestricted(player.id);
            const x = startX + i * (cardW + gap);
            const container = this.add.container(x, cardY).setDepth(5).setAlpha(0);

            const shadow = this.add.graphics();
            shadow.fillStyle(0x000000, 0.6);
            shadow.fillRoundedRect(-cardW / 2 + 4, -cardH / 2 + 6, cardW, cardH, 12);

            const bg = this.add.graphics();
            let isSelected = false;
            const drawBg = (hover: boolean, selected: boolean) => {
                bg.clear();
                if (selected) {
                    bg.fillGradientStyle(0x2a0a0a, 0x2a0a0a, 0x1a0505, 0x1a0505, 1);
                    bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 12);
                    bg.lineStyle(2, this.C.accentGlow, 1);
                } else if (hover && !isRestricted) {
                    bg.fillGradientStyle(0x1f0f0f, 0x1f0f0f, 0x0f0707, 0x0f0707, 1);
                    bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 12);
                    bg.lineStyle(1.5, this.C.accent, 1);
                } else {
                    bg.fillGradientStyle(0x130a0a, 0x130a0a, 0x0a0505, 0x0a0505, 1);
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

            const avatarBg = this.add.circle(0, -cardH * 0.23, Math.floor(cardW * 0.21), 0x1a0a0a);
            avatarBg.setStrokeStyle(1, this.C.borderDim);
            const avatarIcon = this.add.text(0, -cardH * 0.23, "•", { fontSize: `${Math.floor(cardW * 0.2)}px`, fontFamily: ARABIC_FONT_FAMILY }).setOrigin(0.5);
            const pulse = this.add.circle(0, -cardH * 0.23, Math.floor(cardW * 0.24), this.C.accent, 0);
            this.tweens.add({ targets: pulse, alpha: 0.15, scaleX: 1.3, scaleY: 1.3, duration: 1200, yoyo: true, repeat: -1, delay: i * 200 });

            const name = this.add.text(0, cardH * 0.07, player.username.toUpperCase(), {
                fontSize: `${Math.max(10, Math.floor(cardW * 0.086))}px`,
                color: "#c8b8b8", fontFamily: ARABIC_FONT_FAMILY, fontStyle: "bold", letterSpacing: 1
            }).setOrigin(0.5);

            const btnBg = this.add.graphics();
            const drawBtnBg = (hover: boolean) => {
                btnBg.clear();
                btnBg.fillStyle(this.C.accent, hover && !isRestricted ? 0.15 : 0);
                btnBg.fillRoundedRect(-cardW * 0.355, cardH * 0.38 - 14, cardW * 0.71, 28, 6);
                btnBg.lineStyle(1, this.C.accent, 1);
                btnBg.strokeRoundedRect(-cardW * 0.355, cardH * 0.38 - 14, cardW * 0.71, 28, 6);
            };
            drawBtnBg(false);

            const btnLabel = this.add.text(0, cardH * 0.38, ar.night.mafiaSuggest, { fontSize: "10px", color: "#cc2222", fontFamily: ARABIC_FONT_FAMILY, align: "center" }).setOrigin(0.5);
            container.add([shadow, bg, topAccent, pulse, avatarBg, avatarIcon, name, btnBg, btnLabel]);

            container.setData("drawBg", drawBg);
            container.setData("drawBtnBg", drawBtnBg);

            // ✅ إذا كان الهدف ممنوعاً: تعطيل التفاعل وتعتيم البطاقة
            if (isRestricted) {
                container.setAlpha(0.5);
                container.disableInteractive();
                // إضافة علامة ممنوع
                const banIcon = this.add.text(0, -cardH * 0.23, "⛔", {
                    fontSize: `${Math.floor(cardW * 0.22)}px`,
                    fontFamily: "Arial",
                    color: "#ff8888"
                }).setOrigin(0.5);
                container.add(banIcon);
            } else {
                container.setInteractive(new Phaser.Geom.Rectangle(-cardW / 2, -cardH / 2, cardW, cardH), Phaser.Geom.Rectangle.Contains);
                container.on("pointerover", () => { if (this.actionUsed) return; drawBg(true, false); topAccent.setAlpha(1); drawBtnBg(true); this.tweens.add({ targets: container, scaleX: 1.05, scaleY: 1.05, y: cardY - 4, duration: 150 }); });
                container.on("pointerout", () => { drawBg(false, false); topAccent.setAlpha(0); drawBtnBg(false); this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, y: cardY, duration: 150 }); });
                container.on("pointerdown", () => { if (this.actionUsed) return; this.handleTarget(player); });
            }

            this.playerCards.push(container);
            this.tweens.add({ targets: container, alpha: 1, y: cardY, duration: 500, delay: 200 + i * 120, ease: "Back.easeOut", onStart: () => container.setY(cardY + 40) });
        });
    }

    private handleTarget(player: any) {
        // ✅ فحص إضافي قبل الإرسال
        if (this.isTargetRestricted(player.id)) {
            this.showToast("لا يمكنك استهداف هذا اللاعب ليلتين متتاليتين ⛔", "danger");
            return;
        }

        this.killedPlayerId = player.id;
        this.cameras.main.flash(300, 120, 0, 0);
        socketService.socket.emit("mafia_kill", player.id);
    }

    private applyAcceptedMafiaTarget(targetId: string) {
        this.actionUsed = true;
        this.killedPlayerId = targetId;

        this.playerCards.forEach(card => {
            const nameText = card.list.find(l => l instanceof Phaser.GameObjects.Text && l.text === this.players.find(p => p.id === targetId)?.username?.toUpperCase());
            const isSelected = !!nameText;
            const drawBg = card.getData("drawBg");
            const drawBtnBg = card.getData("drawBtnBg");
            if (drawBg) drawBg(false, isSelected);
            if (drawBtnBg) drawBtnBg(false);

            const cardLabel = card.list[8] as Phaser.GameObjects.Text;
            if (cardLabel) {
                cardLabel.setText(isSelected ? ar.night.mafiaSuggested : ar.night.mafiaSuggest);
                cardLabel.setColor(isSelected ? "#ff4444" : "#cc2222");
            }

            if (isSelected) {
                this.tweens.add({ targets: card, scaleX: 1.08, scaleY: 1.08, duration: 200, ease: "Back.easeOut" });
            } else {
                this.tweens.add({ targets: card, scaleX: 1, scaleY: 1, alpha: 0.35, duration: 200 });
                card.disableInteractive();
            }
        });

        const mobileButtons = document.querySelectorAll<HTMLButtonElement>("#mafia-target-section button[id^='kill-btn-']");
        mobileButtons.forEach((btn) => {
            const isSelected = btn.id === `kill-btn-${targetId}`;
            btn.textContent = isSelected ? ar.night.mafiaSuggested : ar.night.mafiaSuggest;
            btn.style.background = isSelected
                ? "linear-gradient(180deg, #cc2222, #991111)"
                : "linear-gradient(180deg, rgba(204,34,34,0.1), transparent)";
            btn.style.color = isSelected ? "#fff" : "#cc2222";
            btn.style.borderColor = isSelected ? "#ff4444" : "rgba(204,34,34,0.5)";
            btn.style.opacity = isSelected ? "1" : "0.3";
            btn.style.pointerEvents = isSelected ? "auto" : "none";
        });
    }

    private createMobileUI(W: number, H: number) {
        const ui = document.createElement("div");
        ui.id = "mobile-night-ui";
        Object.assign(ui.style, {
            position: "fixed", top: "56px", left: "0", right: "0", bottom: "0",
            zIndex: "100", backgroundColor: "rgba(8,8,16,0.97)",
            display: "flex", flexDirection: "column",
            fontFamily: ARABIC_FONT_FAMILY,
        });

        const isDead = this.myPlayer && !this.myPlayer.alive;

        const header = document.createElement("div");
        Object.assign(header.style, {
            padding: "12px 16px", borderBottom: "1px solid #2a1515",
            backgroundColor: "rgba(0,0,0,0.5)",
        });
        header.innerHTML = isDead
            ? `<div style="color:#664444;font-size:11px;letter-spacing:3px;margin-bottom:4px">تم الإقصاء</div>
               <div style="color:#f1e8e8;font-size:15px;font-weight:bold">${ar.night.mafiaDeadTitle}</div>
               <div style="color:#664444;font-size:11px;margin-top:3px">${ar.night.mafiaDeadSubtitle}</div>`
            : `<div style="color:#cc2222;font-size:11px;letter-spacing:3px;font-weight:bold;margin-bottom:4px">${ar.night.mafiaRoleLabel}</div>
               <div style="color:#f1e8e8;font-size:16px;font-weight:bold">${ar.night.mafiaTitle}</div>
               <div style="color:#664444;font-size:11px;margin-top:3px">${ar.night.mafiaSubtitle}</div>`;
        ui.appendChild(header);

        // ✅ تنبيه الأهداف الممنوعة
        if (this.lastTargetPlayerId) {
            const lastPlayer = this.players.find(p => p.id === this.lastTargetPlayerId);
            if (lastPlayer) {
                const alertBanner = document.createElement("div");
                Object.assign(alertBanner.style, {
                    margin: "8px 12px 0",
                    padding: "8px 12px",
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.3)",
                    borderRadius: "6px",
                    fontSize: "11px",
                    color: "#ef4444",
                    direction: "rtl",
                    textAlign: "center",
                });
                alertBanner.textContent = `⛔ لا يمكنك استهداف "${lastPlayer.username}" هذه الليلة`;
                ui.appendChild(alertBanner);
            }
        }

        const suggestionBar = document.createElement("div");
        suggestionBar.id = "mafia-suggestion-bar";
        Object.assign(suggestionBar.style, {
            padding: "8px 16px", backgroundColor: "rgba(204,34,34,0.08)",
            borderBottom: "1px solid #2a1515", display: "none",
            direction: "rtl",
        });
        suggestionBar.innerHTML = `
            <span style="color:#664444;font-size:10px;letter-spacing:2px">الاقتراح الحالي: </span>
            <span id="suggestion-name" style="color:#ff4444;font-size:12px;font-weight:bold"></span>
            <span id="suggestion-by" style="color:#664444;font-size:10px"></span>
        `;
        ui.appendChild(suggestionBar);

        const body = document.createElement("div");
        Object.assign(body.style, {
            flex: "1", display: "flex", flexDirection: "column", overflow: "hidden",
        });

        const chatBox = document.createElement("div");
        chatBox.id = "mafia-chat-box";
        Object.assign(chatBox.style, {
            flex: this.isSoloMafia || isDead ? "0" : "1",
            display: this.isSoloMafia && !isDead ? "none" : "flex",
            overflowY: "auto",
            padding: "10px 14px",
            flexDirection: "column",
            gap: "6px",
            maxHeight: isDead ? "100%" : "140px",
        });

        const welcomeMsg = document.createElement("div");
        welcomeMsg.style.cssText = "color:#3a1515;font-size:10px;text-align:center;letter-spacing:1px;padding:6px";
        welcomeMsg.textContent = ar.night.mafiaChannel;
        chatBox.appendChild(welcomeMsg);
        body.appendChild(chatBox);

        const targetSection = document.createElement("div");
        targetSection.id = "mafia-target-section";
        Object.assign(targetSection.style, {
            borderTop: "1px solid #2a1515", maxHeight: "200px",
            overflowY: "auto", display: isDead ? "none" : "block",
        });

        if (!isDead) {
            const targetHeader = document.createElement("div");
            targetHeader.style.cssText = "padding:8px 14px;color:#664444;font-size:9px;letter-spacing:2px;background:rgba(0,0,0,0.3)";
            targetHeader.textContent = ar.night.mafiaTitle;
            targetSection.appendChild(targetHeader);

            // ✅ عرض جميع الأهداف المحتملة، مع تعطيل الممنوعين
            const allTargets = this.players.filter((p) =>
                p.alive &&
                p.id !== socketService.playerId &&
                p.role !== "MAFIA"
            );

            if (allTargets.length === 0) {
                const empty = document.createElement("div");
                empty.style.cssText = "color:#664444;text-align:center;padding:16px;font-size:12px";
                empty.textContent = ar.night.noTargets || "لا توجد أهداف متاحة";
                targetSection.appendChild(empty);
            } else {
                allTargets.forEach(player => {
                    const isRestricted = this.isTargetRestricted(player.id);
                    const row = document.createElement("div");
                    row.id = `target-row-${player.id}`;
                    Object.assign(row.style, {
                        display: "flex", alignItems: "center", gap: "10px",
                        padding: "12px 16px", borderBottom: "1px solid #1a0a0a",
                        cursor: isRestricted ? "not-allowed" : "pointer",
                        transition: "all 0.2s",
                        background: "linear-gradient(145deg, rgba(30,10,10,0.8), rgba(15,5,5,0.9))",
                        borderRadius: "10px",
                        boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
                        border: "1px solid rgba(255,255,255,0.05)",
                        marginBottom: "8px",
                        opacity: isRestricted ? "0.5" : "1"
                    });

                    row.innerHTML = `
                        <span style="font-size:22px">•</span>
                        <span style="flex:1;color:#f1e8e8;font-size:14px;font-weight:bold">${player.username}</span>
                        <button id="kill-btn-${player.id}" style="padding:10px 16px;font-size:10px;font-weight:bold;letter-spacing:2px;border:1px solid rgba(204,34,34,0.5);border-radius:6px;background:linear-gradient(180deg, rgba(204,34,34,0.1), transparent);color:#cc2222;cursor:pointer;font-family:${ARABIC_FONT_FAMILY};transition:all 0.2s;box-shadow:0 2px 4px rgba(0,0,0,0.5);touch-action:manipulation">${ar.night.mafiaSuggest}</button>
                    `;

                    const btn = row.querySelector<HTMLButtonElement>(`#kill-btn-${player.id}`)!;
                    if (isRestricted) {
                        btn.disabled = true;
                        btn.style.opacity = "0.4";
                        btn.style.cursor = "not-allowed";
                        btn.textContent = "⛔ ممنوع";
                    } else {
                        btn.addEventListener("click", () => {
                            if (this.actionUsed) return;
                            if (this.isTargetRestricted(player.id)) {
                                this.showToast("لا يمكنك استهداف هذا اللاعب ليلتين متتاليتين ⛔", "danger");
                                return;
                            }
                            socketService.socket.emit("mafia_kill", player.id);
                            this.killedPlayerId = player.id;
                            this.cameras.main.flash(300, 120, 0, 0);
                        });
                    }

                    targetSection.appendChild(row);
                });
            }
        }

        body.appendChild(targetSection);
        ui.appendChild(body);

        if (!isDead) {
            const chatInput = document.createElement("div");
            Object.assign(chatInput.style, {
                display: "flex", gap: "8px", padding: "8px 12px",
                borderTop: "1px solid #2a1515", backgroundColor: "rgba(0,0,0,0.4)",
            });
            chatInput.innerHTML = `
                <input id="mafia-chat-input" type="text" placeholder="Message your team..."
                    style="flex:1;padding:8px 12px;background:#0a0505;color:#f1e8e8;border:1px solid #2a1515;border-radius:6px;font-size:13px;font-family:'Courier New',monospace;outline:none"/>
                <button id="mafia-chat-send" style="padding:8px 14px;border:1px solid #cc2222;border-radius:6px;background:transparent;color:#cc2222;font-size:12px;cursor:pointer;font-family:'Courier New',monospace;touch-action:manipulation">SEND</button>
            `;
            ui.appendChild(chatInput);

            const input = chatInput.querySelector<HTMLInputElement>("#mafia-chat-input")!;
            const sendBtn = chatInput.querySelector<HTMLButtonElement>("#mafia-chat-send")!;

            const sendMsg = () => {
                const msg = input.value.trim();
                if (!msg) return;
                socketService.socket.emit("mafia_chat", msg);
                input.value = "";
            };
            sendBtn.addEventListener("click", sendMsg);
            input.addEventListener("keydown", e => { if (e.key === "Enter") sendMsg(); });
        }

        document.body.appendChild(ui);
    }

    private addMafiaChatMessage(from: string, message: string) {
        const chatBox = document.getElementById("mafia-chat-box");
        if (!chatBox) return;
        const isMine = from === (this.myPlayer?.username);
        const msg = document.createElement("div");
        Object.assign(msg.style, {
            padding: "6px 10px", borderRadius: "8px", maxWidth: "85%",
            alignSelf: isMine ? "flex-end" : "flex-start",
            backgroundColor: isMine ? "rgba(204,34,34,0.25)" : "rgba(255,255,255,0.05)",
            border: isMine ? "1px solid #cc2222" : "1px solid #2a1515",
        });
        msg.innerHTML = `
            <div style="color:#664444;font-size:9px;margin-bottom:2px;letter-spacing:1px">${isMine ? ar.night.you : from}</div>
            <div style="color:#f1e8e8;font-size:13px">${message}</div>
        `;
        chatBox.appendChild(msg);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    private updateSuggestion(suggestedBy: string, targetUsername: string) {
        const bar = document.getElementById("mafia-suggestion-bar");
        if (!bar) return;
        bar.style.display = "block";
        const nameEl = document.getElementById("suggestion-name");
        const byEl = document.getElementById("suggestion-by");
        if (nameEl) nameEl.textContent = targetUsername;
        if (byEl) byEl.textContent = ` (اقترحه ${suggestedBy})`;
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
        const bg = this.add.rectangle(0, 0, msgW, 40, c.bg);
        bg.setStrokeStyle(1, c.border);
        const text = this.add.text(0, 0, message, { fontSize: "13px", color: c.text, fontFamily: "'Courier New', monospace" }).setOrigin(0.5);
        toast.add([bg, text]);
        toast.setAlpha(0).setY(H - 10);
        this.tweens.add({ targets: toast, alpha: 1, y: H - 60, duration: 300, ease: "Cubic.easeOut" });
        this.time.delayedCall(2800, () => this.tweens.add({ targets: toast, alpha: 0, y: H - 40, duration: 300, onComplete: () => toast.destroy() }));
    }

    private setupSocketListeners() {
        // ✅ استقبال lastTarget من السيرفر
        socketService.socket.on("night_targets", (data: any) => {
            if (Array.isArray(data?.players)) {
                this.players = this.normalizePlayers(data.players);
            }

            if (typeof data?.teamCount === "number") {
                this.mafiaTeamCount = Math.max(1, data.teamCount);
            }

            if (data?.self) {
                this.myPlayer = {
                    ...(this.myPlayer || {}),
                    ...this.normalizePlayers([data.self])[0],
                };
            }

            // ✅ استقبال lastTarget وتحديث قائمة الممنوعين
            if (data?.lastTarget) {
                this.serverLastTarget = data.lastTarget;
                if (!this.restrictedPlayerIds.includes(data.lastTarget)) {
                    this.restrictedPlayerIds.push(data.lastTarget);
                }
                this.lastTargetPlayerId = data.lastTarget;

                // تحديث الواجهة
                this.drawTopBar(this.scale.width);
            }

            this.isSoloMafia = this.mafiaTeamCount <= 1;

            if (!this.isMobile) {
                this.playerCards.forEach((card) => {
                    if (card?.active) card.destroy();
                });
                this.playerCards = [];
                this.drawPlayerCards(this.scale.width, this.scale.height);
                document.getElementById("mafia-desktop-chat")?.remove();
                if (!this.isSoloMafia && !(this.myPlayer && !this.myPlayer.alive)) {
                    this.createDesktopChatPanel();
                }
            } else {
                document.getElementById("mobile-night-ui")?.remove();
                this.createMobileUI(this.scale.width, this.scale.height);
            }
        });

        socketService.socket.on("phase_changed", (data: any) => {
            if (data.phase === "NIGHT" || data.phase === "NIGHT_REVIEW") return;
            document.getElementById("mafia-desktop-chat")?.remove();
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

        socketService.socket.on("server_reset", () => {
            socketService.reset();
            document.getElementById("mobile-night-ui")?.remove();
            this.cameras.main.fadeOut(400, 6, 8, 16);
            this.time.delayedCall(400, () => { this.scene.start("LobbyScene"); });
        });

        socketService.socket.on("mafia_chat_message", (data: any) => {
            this.addMafiaChatMessage(data.from, data.message);
            if (!this.isMobile) this.addDesktopChatMessage(data.from, data.message);
        });

        socketService.socket.on("mafia_suggestion", (data: any) => {
            this.updateSuggestion(data.suggestedBy, data.targetUsername);
            this.addMafiaChatMessage("النظام", ar.night.mafiaSystemSuggested(data.suggestedBy, data.targetUsername));
            if (!this.isMobile) {
                this.updateDesktopSuggestion(data.suggestedBy, data.targetUsername);
                this.addDesktopChatMessage("النظام", ar.night.mafiaSystemSuggested(data.suggestedBy, data.targetUsername));
            }
        });

        // ✅ معالج خطأ المافيا - يُظهر رسالة ويحرر القفل مع alert و console.warn
        socketService.socket.on("mafia_error", (data: any) => {
            console.warn("❌ Mafia error:", data.message);
            alert(data.message);
            this.actionUsed = false;
            this.showToast(data.message || "حدث خطأ", "danger");
        });

        socketService.socket.on("mafia_action_registered", (data: any) => {
            if (!data?.targetId) return;
            this.applyAcceptedMafiaTarget(data.targetId);
            this.showToast(ar.night.mafiaSystemSuggested(ar.night.you, data.targetUsername), "success");
        });

        socketService.socket.on("player_killed", (data: any) => {
            const msg = ar.night.eliminatedNight(data.username);
            this.showToast(msg, "danger");
            this.addNightEventToMobilePanel(msg, "#f87171");
        });
    }

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
        document.getElementById("mafia-desktop-chat")?.remove();
        this.embers.forEach(e => e.gfx.destroy());
        this.embers = [];
        socketService.socket.off("phase_changed");
        socketService.socket.off("player_killed");
        socketService.socket.off("back_to_lobby");
        socketService.socket.off("night_targets");
        socketService.socket.off("server_reset");
        socketService.socket.off("mafia_chat_message");
        socketService.socket.off("mafia_suggestion");
        socketService.socket.off("mafia_error");
        socketService.socket.off("mafia_action_registered");
    }
}