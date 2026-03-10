import Phaser from "phaser";
import { socketService } from "../../socket";

export default class DetectiveNightScene extends Phaser.Scene {

    private players: any[] = [];
    private roomId!: string;
    private actionUsed: boolean = false;
    private playerCards: Phaser.GameObjects.Container[] = [];
    private resultDisplay?: Phaser.GameObjects.Container;


    // جسيمات النجوم/الجسيمات الزرقاء
    private scanParticles: Array<{
        gfx: Phaser.GameObjects.Graphics;
        x: number; y: number;
        vx: number; vy: number;
        life: number; maxLife: number;
        size: number;
    }> = [];

    // موضع الكشاف
    private spotlightAngle: number = 0;

    // ألوان الثيم - شخصية المحقق
    private readonly C = {
        bg:           0x08080f,
        surface:      0x0d0d1a,
        card:         0x0a0a14,
        cardHover:    0x0f0f20,
        borderDim:    0x1a1a35,
        borderBright: 0x3355cc,
        accent:       0x3355cc,
        accentGlow:   0x5588ff,
        textPrimary:  0xe8eeff,
        textMuted:    0x334466,
        scanColor:    0x4466ff,
        starColor:    0x8899ff,
    };

    // ── Chat ──
    private nightChatInput!: HTMLInputElement;
    private nightChatBtn!: HTMLButtonElement;
    private chatTexts: Phaser.GameObjects.Text[] = [];
    // ══════════════════════════════
    //  Chat Panel (Phaser)
    // ══════════════════════════════
    private chatPanel!: Phaser.GameObjects.Container;
    private chatLines: Phaser.GameObjects.Text[] = [];
    private readonly CHAT_X = 10;
    private readonly CHAT_PANEL_W = 320;
    private readonly CHAT_LINE_H = 18;
    private readonly CHAT_MAX = 7;


    constructor() {
        super("DetectiveNightScene");
    }

    init(data: any) {
        this.roomId = data.roomId;
        this.players = data.players || [];
        this.actionUsed = false;
        this.spotlightAngle = 0;
        this.scanParticles = [];
        socketService.socket.off("phase_changed");
        socketService.socket.off("detective_result");
        socketService.socket.off("player_killed");
        socketService.socket.off("back_to_lobby");
    }

    create() {
        // نشيل أي HTML من GameScene
        document.getElementById("mobile-game-ui")?.remove();
        document.getElementById("game-chat-input")?.remove();
        const W = this.scale.width;
        const H = this.scale.height;

        this.cameras.main.setBackgroundColor("#08080f");
        this.cameras.main.fadeIn(700, 8, 8, 15);

        this.drawBackground(W, H);
        this.drawTopBar(W);
        this.drawTitle(W);
        if (W >= 700) this.drawPlayerCards(W, H);
        this.createMobileNightUI(W);
        this.setupSocketListeners();

    }

    // ══════════════════════════════
    //  update — كشاف متحرك + نجوم
    // ══════════════════════════════
    update(time: number) {
        const W = this.scale.width;
        const H = this.scale.height;

        // تحديث زاوية الكشاف
        this.spotlightAngle = time * 0.0004;

        // جسيمات نجمية عشوائية
        if (Math.random() < 0.06) {
            this.scanParticles.push({
                gfx: this.add.graphics().setDepth(0),
                x: Math.random() * W,
                y: Math.random() * H,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3,
                life: 0,
                maxLife: 80 + Math.random() * 60,
                size: 1 + Math.random() * 1.5
            });
        }

        this.scanParticles = this.scanParticles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.life++;

            const progress = p.life / p.maxLife;
            const alpha = progress < 0.3
                ? progress / 0.3 * 0.5
                : (1 - progress) * 0.5;

            p.gfx.clear();
            p.gfx.fillStyle(this.C.starColor, alpha);
            p.gfx.fillCircle(p.x, p.y, p.size);

            if (p.life >= p.maxLife) {
                p.gfx.destroy();
                return false;
            }
            return true;
        });

        // تحديث الكشاف المتحرك في الخلفية
        const spotGfx = this.children.getByName("spotlight") as Phaser.GameObjects.Graphics;
        if (spotGfx) {
            const sx = W / 2 + Math.cos(this.spotlightAngle) * (W * 0.3);
            const sy = H / 2 + Math.sin(this.spotlightAngle * 0.7) * (H * 0.25);
            spotGfx.clear();
            spotGfx.fillStyle(this.C.scanColor, 0.03);
            spotGfx.fillCircle(sx, sy, 200);
            spotGfx.fillStyle(this.C.scanColor, 0.015);
            spotGfx.fillCircle(sx, sy, 320);
        }
    }

    // ══════════════════════════════
    //  رسم الخلفية
    // ══════════════════════════════
    private drawBackground(W: number, H: number) {
        this.add.rectangle(0, 0, W, H, this.C.bg).setOrigin(0).setDepth(0);

        // شبكة خفيفة
        const grid = this.add.graphics().setDepth(0);
        grid.lineStyle(1, 0x0d0d20, 1);
        const step = 56;
        for (let x = 0; x < W; x += step) { grid.moveTo(x, 0); grid.lineTo(x, H); }
        for (let y = 0; y < H; y += step) { grid.moveTo(0, y); grid.lineTo(W, y); }
        grid.strokePath();

        // كشاف متحرك (يتحدث في update)
        this.add.graphics().setName("spotlight").setDepth(0);

        // نقاط ثابتة (نجوم)
        const stars = this.add.graphics().setDepth(0);
        for (let i = 0; i < 40; i++) {
            const sx = Math.random() * W;
            const sy = Math.random() * H;
            const sr = Math.random() < 0.2 ? 1.5 : 1;
            stars.fillStyle(0x4466aa, 0.2 + Math.random() * 0.2);
            stars.fillCircle(sx, sy, sr);
        }
    }

    // ══════════════════════════════
    //  الشريط العلوي
    // ══════════════════════════════
    private drawTopBar(W: number) {
        this.add.rectangle(0, 0, W, 56, this.C.surface).setOrigin(0).setDepth(2);

        const line = this.add.graphics().setDepth(3);
        line.lineStyle(2, this.C.accent, 0.8);
        line.moveTo(0, 56); line.lineTo(W, 56);
        line.strokePath();

        this.add.text(20, 28, "⬡  DETECTIVE", {
            fontSize: "14px",
            color: "#3355cc",
            fontFamily: "'Courier New', monospace",
            fontStyle: "bold",
            letterSpacing: 3
        }).setOrigin(0, 0.5).setDepth(3);

        this.add.text(W / 2, 28, `ROOM  ${this.roomId?.substring(0, 8).toUpperCase()}`, {
            fontSize: "11px",
            color: "#334466",
            fontFamily: "'Courier New', monospace",
            letterSpacing: 2
        }).setOrigin(0.5, 0.5).setDepth(3);

        this.add.text(W - 20, 28, "◉  NIGHT PHASE", {
            fontSize: "11px",
            color: "#334466",
            fontFamily: "'Courier New', monospace",
            letterSpacing: 2
        }).setOrigin(1, 0.5).setDepth(3);
    }

    // ══════════════════════════════
    //  العنوان
    // ══════════════════════════════
    private drawTitle(W: number) {
        const titleY = 110;

        const title = this.add.text(W / 2, titleY, "INVESTIGATE A SUSPECT", {
            fontSize: "32px",
            color: "#e8eeff",
            fontFamily: "'Georgia', serif",
            fontStyle: "bold",
            letterSpacing: 6,
        }).setOrigin(0.5).setDepth(2).setAlpha(0);

        this.tweens.add({
            targets: title,
            alpha: 1, y: titleY - 5,
            duration: 700, ease: "Cubic.easeOut", delay: 300
        });

        const sub = this.add.text(W / 2, titleY + 38, "Reveal the true identity of one player", {
            fontSize: "13px",
            color: "#334466",
            fontFamily: "'Courier New', monospace",
            letterSpacing: 2
        }).setOrigin(0.5).setDepth(2).setAlpha(0);

        this.tweens.add({ targets: sub, alpha: 1, duration: 600, delay: 500 });

        const divider = this.add.graphics().setDepth(2).setAlpha(0);
        divider.lineStyle(1, this.C.accent, 0.4);
        divider.moveTo(W / 2 - 120, titleY + 58);
        divider.lineTo(W / 2 + 120, titleY + 58);
        divider.strokePath();
        this.tweens.add({ targets: divider, alpha: 1, duration: 500, delay: 600 });
    }

    // ══════════════════════════════
    //  بطاقات اللاعبين
    // ══════════════════════════════
    private drawPlayerCards(W: number, H: number) {
        const targets = this.players.filter(p => p.alive && p.id !== socketService.socket.id);
        if (targets.length === 0) return;

        // ── Card dimensions (responsive) ──
        let cardW  = 140;
        let cardH  = 185;
        let gap    = 24;
        const naturalW  = targets.length * cardW + (targets.length - 1) * gap;
        const maxAvailW = W - 32;
        if (naturalW > maxAvailW) {
            const s = maxAvailW / naturalW;
            cardW = Math.floor(cardW * s);
            cardH = Math.floor(cardH * s);
            gap   = Math.floor(gap   * s);
        }
        const totalW = targets.length * cardW + (targets.length - 1) * gap;
        const startX = W / 2 - totalW / 2 + cardW / 2;
        const cardY = H / 2 + 30;

        targets.forEach((player, i) => {
            const x = startX + i * (cardW + gap);

            const container = this.add.container(x, cardY).setDepth(5).setAlpha(0);

            const shadow = this.add.rectangle(4, 6, cardW, cardH, 0x000000, 0.5);
            shadow.setOrigin(0.5);

            const bg = this.add.rectangle(0, 0, cardW, cardH, this.C.card);
            bg.setStrokeStyle(1, this.C.borderDim);
            bg.setOrigin(0.5);

            const topAccent = this.add.rectangle(0, -cardH / 2 + 2, cardW - 2, 3, this.C.accent, 0);
            topAccent.setOrigin(0.5, 0);

            // علامة استفهام مخفية (هوية مجهولة)
            const unknownBg = this.add.circle(0, -48, 28, 0x0a0a18);
            unknownBg.setStrokeStyle(1, this.C.borderDim);

            const unknownIcon = this.add.text(0, -48, "?", {
                fontSize: "30px",
                color: "#334466",
                fontFamily: "'Courier New', monospace",
                fontStyle: "bold"
            }).setOrigin(0.5);

            // نبضة
            const pulse = this.add.circle(0, -48, 32, this.C.accent, 0);
            this.tweens.add({
                targets: pulse,
                alpha: 0.1,
                scaleX: 1.4, scaleY: 1.4,
                duration: 1100,
                yoyo: true, repeat: -1,
                delay: i * 200
            });

            // معرف الملف
            const fileId = this.add.text(0, -12, `FILE #${String(i + 1).padStart(3, "0")}`, {
                fontSize: "9px",
                color: "#334466",
                fontFamily: "'Courier New', monospace",
                letterSpacing: 2
            }).setOrigin(0.5);

            const name = this.add.text(0, 8, player.username.toUpperCase(), {
                fontSize: "12px",
                color: "#c8d0f0",
                fontFamily: "'Courier New', monospace",
                fontStyle: "bold",
                letterSpacing: 1
            }).setOrigin(0.5);

            // حالة مجهولة
            const statusBg = this.add.rectangle(0, 30, 90, 18, 0x111128);
            statusBg.setStrokeStyle(1, this.C.borderDim);
            statusBg.setOrigin(0.5);

            const statusText = this.add.text(0, 30, "UNKNOWN", {
                fontSize: "9px",
                color: "#334466",
                fontFamily: "'Courier New', monospace",
                letterSpacing: 3
            }).setOrigin(0.5);

            const btnBg = this.add.rectangle(0, 70, 100, 28, this.C.accent, 0);
            btnBg.setStrokeStyle(1, this.C.accent);
            btnBg.setOrigin(0.5);

            const btnLabel = this.add.text(0, 70, "INSPECT", {
                fontSize: "10px",
                color: "#3355cc",
                fontFamily: "'Courier New', monospace",
                letterSpacing: 2
            }).setOrigin(0.5);

            container.add([shadow, bg, topAccent, pulse, unknownBg, unknownIcon,
                           fileId, name, statusBg, statusText, btnBg, btnLabel]);

            container.setInteractive(
                new Phaser.Geom.Rectangle(-cardW / 2, -cardH / 2, cardW, cardH),
                Phaser.Geom.Rectangle.Contains
            );

            container.on("pointerover", () => {
                if (this.actionUsed) return;
                bg.setFillStyle(this.C.cardHover);
                bg.setStrokeStyle(1, this.C.accent);
                topAccent.setAlpha(1);
                btnBg.setFillStyle(this.C.accent, 0.15);
                btnLabel.setColor("#5588ff");
                unknownIcon.setColor("#5588ff");
                this.tweens.add({ targets: container, scaleX: 1.05, scaleY: 1.05, duration: 150 });
            });

            container.on("pointerout", () => {
                bg.setFillStyle(this.C.card);
                bg.setStrokeStyle(1, this.C.borderDim);
                topAccent.setAlpha(0);
                btnBg.setFillStyle(this.C.accent, 0);
                btnLabel.setColor("#3355cc");
                unknownIcon.setColor("#334466");
                this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 150 });
            });

            container.on("pointerdown", () => {
                if (this.actionUsed) return;
                this.handleInvestigate(player, container, bg, unknownIcon, statusText, statusBg);
            });

            this.playerCards.push(container);

            this.tweens.add({
                targets: container,
                alpha: 1, y: cardY,
                duration: 500,
                delay: 200 + i * 120,
                ease: "Back.easeOut",
                onStart: () => container.setY(cardY + 40)
            });
        });
    }

    // ══════════════════════════════
    //  التحقيق
    // ══════════════════════════════
    private handleInvestigate(
        player: any,
        selected: Phaser.GameObjects.Container,
        bg: Phaser.GameObjects.Rectangle,
        unknownIcon: Phaser.GameObjects.Text,
        statusText: Phaser.GameObjects.Text,
        statusBg: Phaser.GameObjects.Rectangle
    ) {
        this.actionUsed = true;

        this.cameras.main.flash(350, 30, 30, 120);

        this.playerCards.forEach(card => {
            if (card !== selected && card?.active) {
                card.disableInteractive();
                this.tweens.add({ targets: card, alpha: 0.2, scaleX: 0.92, scaleY: 0.92, duration: 300 });
            }
        });

        this.tweens.add({ targets: selected, scaleX: 1.1, scaleY: 1.1, duration: 250, ease: "Back.easeOut" });

        bg.setFillStyle(0x0a0a20);
        bg.setStrokeStyle(2, this.C.accentGlow);

        // تأثير scan — خطوط أفقية تمر
        for (let i = 0; i < 5; i++) {
            this.time.delayedCall(i * 60, () => {
                const scanLine = this.add.graphics().setDepth(10);
                scanLine.lineStyle(1, this.C.scanColor, 0.5);
                scanLine.moveTo(selected.x - 60, selected.y - 80 + i * 30);
                scanLine.lineTo(selected.x + 60, selected.y - 80 + i * 30);
                scanLine.strokePath();
                this.tweens.add({
                    targets: scanLine,
                    alpha: 0, duration: 400,
                    onComplete: () => scanLine.destroy()
                });
            });
        }

        // أيقونة البحث تنبض
        unknownIcon.setText("◎");
        unknownIcon.setColor("#5588ff");
        this.tweens.add({
            targets: unknownIcon,
            scaleX: 1.3, scaleY: 1.3,
            duration: 300, yoyo: true, repeat: 2
        });

        statusText.setText("SCANNING...");
        statusText.setColor("#5588ff");
        statusBg.setStrokeStyle(1, this.C.accent);

        socketService.socket.emit("detective_check", player.id);
        this.showToast(`Investigating: ${player.username}`, "info");
    }

    // ══════════════════════════════
    //  عرض نتيجة التحقيق
    // ══════════════════════════════
    private showResult(data: any) {
        if (this.resultDisplay) {
            this.resultDisplay.destroy();
        }

        // دعم كل الأدوار: MAFIA / DOCTOR / CITIZEN / DETECTIVE
        const role: string = data.role ?? (data.isMafia ? "MAFIA" : "CITIZEN");
        const W = this.scale.width;

        // ألوان ونصوص حسب الدور
        const roleConfig: Record<string, { color: string; border: number; bg: number; icon: string; label: string }> = {
            MAFIA:     { color: "#ff4444", border: 0xcc2222, bg: 0x1a0505, icon: "⚠", label: "⚠  MAFIA CONFIRMED"  },
            DOCTOR:    { color: "#44ff88", border: 0x22cc55, bg: 0x051a05, icon: "✚", label: "✚  DOCTOR IDENTIFIED" },
            DETECTIVE: { color: "#60a5fa", border: 0x2255cc, bg: 0x05051a, icon: "🔍", label: "🔍  DETECTIVE FOUND"  },
            CITIZEN:   { color: "#94a3b8", border: 0x334155, bg: 0x0a0d13, icon: "✓", label: "✓  INNOCENT CITIZEN"  },
        };
        const cfg = roleConfig[role] ?? roleConfig["CITIZEN"];

        // تحديث بطاقة اللاعب المحقق معه
        const targetCard = this.playerCards.find(c => {
            const nameText = c.list.find((obj: any) =>
                obj instanceof Phaser.GameObjects.Text &&
                obj.text === (data.username || "").toUpperCase()
            );
            return !!nameText;
        });

        if (targetCard) {
            const iconText = targetCard.list.find((obj: any) =>
                obj instanceof Phaser.GameObjects.Text && obj.text === "◎"
            ) as Phaser.GameObjects.Text | undefined;

            const statusTxt = targetCard.list.find((obj: any) =>
                obj instanceof Phaser.GameObjects.Text && obj.text === "SCANNING..."
            ) as Phaser.GameObjects.Text | undefined;

            if (iconText) {
                iconText.setText(cfg.icon);
                iconText.setColor(cfg.color);
            }
            if (statusTxt) {
                statusTxt.setText(role);
                statusTxt.setColor(cfg.color);
            }
        }

        // لافتة النتيجة الكبيرة
        const resultColor = cfg.color;
        const resultBorderColor = cfg.border;
        const resultBg = cfg.bg;
        const resultLabel = cfg.label;

        const container = this.add.container(W / 2, 200).setDepth(20).setAlpha(0);

        const panelBg = this.add.rectangle(0, 0, 380, 80, resultBg);
        panelBg.setStrokeStyle(2, resultBorderColor);

        const label = this.add.text(0, -10, resultLabel, {
            fontSize: "20px",
            color: resultColor,
            fontFamily: "'Courier New', monospace",
            fontStyle: "bold",
            letterSpacing: 3
        }).setOrigin(0.5);

        const username = this.add.text(0, 18, data.username, {
            fontSize: "13px",
            color: "#888899",
            fontFamily: "'Courier New', monospace",
            letterSpacing: 2
        }).setOrigin(0.5);

        container.add([panelBg, label, username]);
        this.resultDisplay = container;

        this.tweens.add({
            targets: container,
            alpha: 1, scaleX: 1, scaleY: 1,
            duration: 400, ease: "Back.easeOut",
        });

        this.time.delayedCall(5000, () => {
            if (this.resultDisplay) {
                this.tweens.add({
                    targets: this.resultDisplay,
                    alpha: 0, duration: 400,
                    onComplete: () => {
                        this.resultDisplay?.destroy();
                        this.resultDisplay = undefined;
                    }
                });
            }
        });
    }

    // ══════════════════════════════
    //  Toast
    // ══════════════════════════════
    private showToast(message: string, type: "info" | "danger" | "success") {
        const colorMap = {
            info:    { bg: 0x05051a, border: 0x3355cc, text: "#5588ff" },
            danger:  { bg: 0x1a0505, border: 0xcc2222, text: "#ff4444" },
            success: { bg: 0x051a05, border: 0x22cc55, text: "#44ff88" },
        };
        const c = colorMap[type];
        const W = this.scale.width;
        const H = this.scale.height;

        const toast = this.add.container(W / 2, H - 40).setDepth(20);
        const msgW = Math.min(message.length * 9 + 48, 420);
        const bg = this.add.rectangle(0, 0, msgW, 40, c.bg);
        bg.setStrokeStyle(1, c.border);
        const text = this.add.text(0, 0, message, {
            fontSize: "13px",
            color: c.text,
            fontFamily: "'Courier New', monospace"
        }).setOrigin(0.5);
        toast.add([bg, text]);
        toast.setAlpha(0).setY(H - 10);

        this.tweens.add({ targets: toast, alpha: 1, y: H - 50, duration: 300, ease: "Cubic.easeOut" });
        this.time.delayedCall(2800, () => {
            this.tweens.add({
                targets: toast, alpha: 0, y: H - 30, duration: 300,
                onComplete: () => toast.destroy()
            });
        });
    }


    // ══════════════════════════════
    //  Night Chat
    // ══════════════════════════════

    private createChatPanel() {
        const H = this.scale.height;
        const panelH = this.CHAT_MAX * this.CHAT_LINE_H + 16;
        // نضعه فوق input box بـ 10px هامش
        const panelY = H - 60 - panelH;

        this.chatPanel = this.add.container(0, panelY).setDepth(60);

        // خلفية شبه شفافة
        const bg = this.add.rectangle(
            this.CHAT_X, 0,
            this.CHAT_PANEL_W, panelH,
            0x000000, 0.55
        ).setOrigin(0, 0).setDepth(59);
        this.chatPanel.add(bg);
    }

    private addChatLine(username: string, message: string, alive: boolean) {
        if (!this.scene?.isActive()) return;
        const msgArea = document.getElementById("night-chat-messages");
        if (!msgArea) return;

        const isMe = username === (socketService.socket as any)?.username;
        const color = !alive ? "#4b5563" : isMe ? "#e2e8f0" : "#94a3b8";

        const el = document.createElement("div");
        el.textContent = `${alive ? "" : "☠ "}${username}: ${message}`;
        Object.assign(el.style, {
            fontSize: "12px",
            fontFamily: "'Courier New', monospace",
            color,
            wordBreak: "break-word",
            lineHeight: "1.4",
            opacity: "0",
            transition: "opacity 0.2s",
        });
        msgArea.appendChild(el);
        requestAnimationFrame(() => { el.style.opacity = "1"; });

        // scroll للأسفل
        msgArea.scrollTop = msgArea.scrollHeight;

        // احذف القديم (أكثر من 30)
        while (msgArea.children.length > 30) {
            msgArea.removeChild(msgArea.firstChild!);
        }
    }

    private destroyChatPanel() {
        if (this.chatPanel?.active) this.chatPanel.destroy();
        this.chatLines.forEach(t => { if (t.active) t.destroy(); });
        this.chatLines = [];
    }

    private createNightChat() {
        const H = window.innerHeight;
        const panelW = 220;

        // ── Chat Panel ──
        const panel = document.createElement("div");
        panel.id = "night-chat-panel";
        Object.assign(panel.style, {
            position: "fixed",
            right: "0px",
            top: "0px",
            width: `${panelW}px`,
            height: `${H}px`,
            backgroundColor: "rgba(8, 10, 18, 0.96)",
            borderLeft: "1px solid #1e2d45",
            zIndex: "9999",
            display: "flex",
            flexDirection: "column",
            boxSizing: "border-box",
        });
        document.body.appendChild(panel);

        // ── Header ──
        const header = document.createElement("div");
        header.textContent = "CHAT  ◉ NIGHT";
        Object.assign(header.style, {
            padding: "10px 14px",
            fontSize: "11px",
            fontFamily: "'Courier New', monospace",
            color: "#3b82f6",
            letterSpacing: "3px",
            borderBottom: "1px solid #1e2d45",
            flexShrink: "0",
        });
        panel.appendChild(header);

        // ── Messages Area ──
        const msgArea = document.createElement("div");
        msgArea.id = "night-chat-messages";
        Object.assign(msgArea.style, {
            flex: "1",
            overflowY: "auto",
            padding: "8px 10px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
        });
        panel.appendChild(msgArea);

        // ── Input Row ──
        const inputRow = document.createElement("div");
        Object.assign(inputRow.style, {
            display: "flex",
            gap: "4px",
            padding: "8px",
            borderTop: "1px solid #1e2d45",
            flexShrink: "0",
        });
        panel.appendChild(inputRow);

        this.nightChatInput = document.createElement("input");
        this.nightChatInput.id = "night-chat-input";
        this.nightChatInput.placeholder = "Message...";
        this.nightChatInput.maxLength = 120;
        Object.assign(this.nightChatInput.style, {
            flex: "1",
            padding: "7px 8px",
            fontSize: "12px",
            fontFamily: "'Courier New', monospace",
            border: "1px solid #1e2d45",
            borderRadius: "4px",
            backgroundColor: "#0a0d13",
            color: "#f1f5f9",
            outline: "none",
        });
        inputRow.appendChild(this.nightChatInput);

        this.nightChatBtn = document.createElement("button");
        this.nightChatBtn.id = "night-chat-btn";
        this.nightChatBtn.textContent = "➤";
        Object.assign(this.nightChatBtn.style, {
            width: "30px",
            height: "32px",
            fontSize: "12px",
            border: "1px solid #1e2d45",
            borderRadius: "4px",
            backgroundColor: "#0f172a",
            color: "#3b82f6",
            cursor: "pointer",
            flexShrink: "0",
        });
        inputRow.appendChild(this.nightChatBtn);

        const send = () => {
            const msg = this.nightChatInput?.value?.trim();
            if (msg && msg.length > 0) {
                socketService.socket.emit("send_message", msg);
                this.nightChatInput.value = "";
            }
        };
        this.nightChatBtn.addEventListener("click", send);
        this.nightChatInput.addEventListener("keypress", (e: KeyboardEvent) => {
            if (e.key === "Enter") send();
        });

        socketService.socket.on("receive_message", (data: any) => {
            if (!this.scene?.isActive()) return;
            this.addChatLine(data.username, data.message, data.alive !== false);
        });
    }

    private showNightChatMessage(username: string, message: string, alive?: boolean) {
        this.addChatLine(username, message, alive !== false);
    }

    private cleanupNightChat() {
        document.getElementById("night-chat-panel")?.remove();
        socketService.socket.off("receive_message");
        if (this.chatPanel?.active) this.chatPanel.destroy();
        this.chatLines.forEach(t => { if (t.active) t.destroy(); });
        this.chatLines = [];
        this.chatTexts.forEach(t => {
            const bg = (t as any)._bg;
            if (bg?.active) bg.destroy();
            if (t.active) t.destroy();
        });
        this.chatTexts = [];
    }

    // ══════════════════════════════
    //  Socket Listeners
    // ══════════════════════════════


    // ══════════════════════════════
    //  Night Chat
    // ══════════════════════════════
    private setupSocketListeners() {
        socketService.socket.on("phase_changed", (data: any) => {
            if (data.phase === "NIGHT") return;
            if (data.phase === "NIGHT_REVIEW") return;
            this.cameras.main.fadeOut(400, 8, 8, 15);
            this.time.delayedCall(400, () => {
                this.scene.start("GameScene", { role: "DETECTIVE", roomId: this.roomId, userType: "PLAYER" });
            });
        });

        socketService.socket.on("back_to_lobby", () => {
            this.cameras.main.fadeOut(300, 8, 8, 15);
            this.time.delayedCall(300, () => {
                this.scene.start("GameScene", { role: "DETECTIVE", roomId: this.roomId, userType: "PLAYER" });
            });
        });

        socketService.socket.on("detective_result", (data: any) => {
            this.showResult(data);
            // Mobile result
            const W = this.scale.width;
            if (W < 700) {
                const role: string = data.role ?? (data.isMafia ? "MAFIA" : "CITIZEN");
                const colors: Record<string,string> = {
                    MAFIA: "#ef4444", DOCTOR: "#22c55e",
                    DETECTIVE: "#60a5fa", CITIZEN: "#94a3b8"
                };
                const labels: Record<string,string> = {
                    MAFIA: "⚠ MAFIA CONFIRMED", DOCTOR: "✚ DOCTOR IDENTIFIED",
                    DETECTIVE: "🔍 DETECTIVE FOUND", CITIZEN: "✓ INNOCENT CITIZEN"
                };
                this.showMobileResult(
                    labels[role] ?? "✓ INNOCENT CITIZEN",
                    colors[role] ?? "#94a3b8",
                    data.username ?? ""
                );
            }
        });

        socketService.socket.on("player_killed", (data: any) => {
            this.showToast(`${data.username} was eliminated`, "danger");
        });
    }

    shutdown() {
        this.cleanupMobileNightUI();
        this.cleanupNightChat();
        this.scanParticles.forEach(p => p.gfx.destroy());
        this.scanParticles = [];
        if (this.resultDisplay) { this.resultDisplay.destroy(); this.resultDisplay = undefined; }
        socketService.socket.off("phase_changed");
        socketService.socket.off("detective_result");
        socketService.socket.off("player_killed");
        socketService.socket.off("back_to_lobby");
    }
    // ═══════════════════════════════
    //  MOBILE NIGHT UI (HTML)
    // ═══════════════════════════════
    private actionUsedMobile: boolean = false;

    private createMobileNightUI(W: number) {
        if (W >= 700) return;
        const container = document.createElement("div");
        container.id = "mobile-night-ui";
        Object.assign(container.style, {
            position: "fixed", top: "0", left: "0", right: "0", bottom: "0",
            zIndex: "1000", backgroundColor: "#060a12",
            display: "flex", flexDirection: "column",
            fontFamily: "'Courier New', monospace",
        });
        const header = document.createElement("div");
        Object.assign(header.style, {
            padding: "16px 20px", borderBottom: "1px solid #1e3a5f",
            backgroundColor: "rgba(0,0,0,0.4)",
        });
        header.innerHTML = `<div style="color:#3b82f6;font-size:11px;letter-spacing:3px;margin-bottom:6px">🔍 DETECTIVE</div><div style="color:#f1f5f9;font-size:18px;font-weight:bold;letter-spacing:2px">INVESTIGATE A SUSPECT</div><div style="color:#64748b;font-size:11px;margin-top:4px">Reveal the true identity of one player</div>`;
        container.appendChild(header);
        const list = document.createElement("div");
        list.id = "mobile-night-list";
        Object.assign(list.style, {
            flex: "1", overflowY: "auto", padding: "12px",
            display: "flex", flexDirection: "column", gap: "10px",
        });
        this.populateMobileNightList(list);
        container.appendChild(list);
        document.body.appendChild(container);
    }

    private populateMobileNightList(list: HTMLDivElement) {
        const targets = this.players.filter(p => p.alive && p.id !== socketService.socket.id);
        if (targets.length === 0) {
            const empty = document.createElement("div");
            empty.textContent = "No targets available";
            Object.assign(empty.style, { color: "#64748b", textAlign: "center", marginTop: "40px" });
            list.appendChild(empty);
            return;
        }
        targets.forEach(player => {
            const row = document.createElement("div");
            Object.assign(row.style, {
                display: "flex", alignItems: "center", gap: "12px",
                padding: "14px 16px", borderRadius: "8px",
                backgroundColor: "rgba(17,24,39,0.8)", border: "1px solid #1e3a5f",
            });
            const avatar = document.createElement("div");
            avatar.textContent = "👤";
            avatar.style.fontSize = "28px";
            const name = document.createElement("div");
            name.textContent = player.username;
            Object.assign(name.style, { flex: "1", color: "#f1f5f9", fontSize: "14px", fontWeight: "bold" });
            const btn = document.createElement("button");
            btn.textContent = "INSPECT";
            Object.assign(btn.style, {
                padding: "8px 16px", fontSize: "11px", fontWeight: "bold", letterSpacing: "2px",
                border: "1px solid #3b82f6", borderRadius: "4px",
                backgroundColor: "transparent", color: "#3b82f6", cursor: "pointer",
            });
            btn.onclick = () => {
                if (this.actionUsedMobile) return;
                this.actionUsedMobile = true;
                btn.textContent = "✓ DONE";
                btn.style.backgroundColor = "#3b82f6";
                btn.style.color = "#000";
                document.querySelectorAll("#mobile-night-list button").forEach(b => {
                    (b as HTMLButtonElement).style.opacity = "0.4";
                    (b as HTMLButtonElement).style.pointerEvents = "none";
                });
                socketService.socket.emit("detective_check", player.id);
            };
            row.appendChild(avatar);
            row.appendChild(name);
            row.appendChild(btn);
            list.appendChild(row);
        });
    }

    private cleanupMobileNightUI() {
        document.getElementById("mobile-night-ui")?.remove();
        document.getElementById("mobile-night-result")?.remove();
    }

    private showMobileResult(text: string, color: string, username: string) {
        document.getElementById("mobile-night-result")?.remove();
        const banner = document.createElement("div");
        banner.id = "mobile-night-result";
        Object.assign(banner.style, {
            position: "fixed", top: "80px", left: "50%",
            transform: "translateX(-50%)",
            zIndex: "2000", padding: "16px 24px",
            backgroundColor: "#0a0d13",
            border: `2px solid ${color}`,
            borderRadius: "8px", textAlign: "center",
            fontFamily: "'Courier New', monospace",
            boxShadow: `0 0 20px ${color}44`,
            minWidth: "260px",
            animation: "resultPop 0.4s cubic-bezier(0.34,1.56,0.64,1)",
        });
        const style = document.createElement("style");
        style.textContent = `@keyframes resultPop { from { opacity:0;transform:translateX(-50%) scale(0.8) } to { opacity:1;transform:translateX(-50%) scale(1) } }`;
        document.head.appendChild(style);
        banner.innerHTML = `
            <div style="color:${color};font-size:14px;font-weight:bold;letter-spacing:2px;margin-bottom:6px">${text}</div>
            <div style="color:#94a3b8;font-size:13px">${username}</div>
            <div style="color:#374151;font-size:10px;margin-top:8px">TAP TO DISMISS</div>
        `;
        banner.onclick = () => banner.remove();
        document.body.appendChild(banner);
        setTimeout(() => banner?.remove(), 6000);
    }

}