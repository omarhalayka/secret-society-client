import Phaser from "phaser";
import { socketService } from "../../socket";

export default class DoctorNightScene extends Phaser.Scene {

    private players: any[] = [];
    private roomId!: string;
    private actionUsed: boolean = false;
    private playerCards: Phaser.GameObjects.Container[] = [];
    private savedPlayerId: string | null = null;


    // جسيمات دوائر الشفاء
    private healParticles: Array<{
        gfx: Phaser.GameObjects.Graphics;
        x: number; y: number;
        radius: number; maxRadius: number;
        alpha: number; speed: number;
    }> = [];

    // ألوان الثيم - شخصية الطبيب
    private readonly C = {
        bg:           0x08100a,
        surface:      0x0d1a0f,
        card:         0x0a130c,
        cardHover:    0x0f1f11,
        borderDim:    0x153020,
        borderBright: 0x22aa55,
        accent:       0x22aa55,
        accentGlow:   0x44ff88,
        textPrimary:  0xe8f5ee,
        textMuted:    0x3a6645,
        ring1:        0x22cc66,
        ring2:        0x44ff88,
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
        super("DoctorNightScene");
    }

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
        // نشيل أي HTML من GameScene
        document.getElementById("mobile-game-ui")?.remove();
        document.getElementById("game-chat-input")?.remove();
        const W = this.scale.width;
        const H = this.scale.height;

        this.cameras.main.setBackgroundColor("#08100a");
        this.cameras.main.fadeIn(700, 8, 16, 10);

        this.drawBackground(W, H);
        this.drawTopBar(W);
        this.drawTitle(W);
        if (W >= 700) this.drawPlayerCards(W, H);
        this.createMobileNightUI(W);
        this.setupSocketListeners();

    }

    // ══════════════════════════════
    //  update — دوائر الشفاء
    // ══════════════════════════════
    update() {
        const W = this.scale.width;
        const H = this.scale.height;

        // إضافة دوائر شفاء عشوائية خفيفة
        if (Math.random() < 0.04) {
            this.healParticles.push({
                gfx: this.add.graphics().setDepth(0),
                x: Math.random() * W,
                y: Math.random() * H,
                radius: 2 + Math.random() * 8,
                maxRadius: 40 + Math.random() * 60,
                alpha: 0.15,
                speed: 0.4 + Math.random() * 0.4
            });
        }

        this.healParticles = this.healParticles.filter(p => {
            p.radius += p.speed;
            p.alpha = Math.max(0, 0.15 * (1 - p.radius / p.maxRadius));

            p.gfx.clear();
            p.gfx.lineStyle(1, this.C.ring1, p.alpha);
            p.gfx.strokeCircle(p.x, p.y, p.radius);

            if (p.radius >= p.maxRadius) {
                p.gfx.destroy();
                return false;
            }
            return true;
        });
    }

    // ══════════════════════════════
    //  رسم الخلفية
    // ══════════════════════════════
    private drawBackground(W: number, H: number) {
        this.add.rectangle(0, 0, W, H, this.C.bg).setOrigin(0).setDepth(0);

        // شبكة خفيفة خضراء
        const grid = this.add.graphics().setDepth(0);
        grid.lineStyle(1, 0x0d1f10, 1);
        const step = 56;
        for (let x = 0; x < W; x += step) { grid.moveTo(x, 0); grid.lineTo(x, H); }
        for (let y = 0; y < H; y += step) { grid.moveTo(0, y); grid.lineTo(W, y); }
        grid.strokePath();

        // توهج أخضر من أعلى الشاشة (مصدر الضوء الطبي)
        const glow = this.add.graphics().setDepth(0);
        glow.fillGradientStyle(0x002200, 0x002200, 0x000000, 0x000000, 0.4, 0.4, 0, 0);
        glow.fillRect(0, 0, W, H * 0.5);

        // علامة + طبية ضخمة في الخلفية (ديكور)
        const cross = this.add.graphics().setDepth(0);
        cross.fillStyle(0x0d2015, 0.5);
        cross.fillRect(W * 0.5 - 4, H * 0.5 - 60, 8, 120);
        cross.fillRect(W * 0.5 - 60, H * 0.5 - 4, 120, 8);
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

        this.add.text(20, 28, "✚  DOCTOR", {
            fontSize: "14px",
            color: "#22aa55",
            fontFamily: "'Courier New', monospace",
            fontStyle: "bold",
            letterSpacing: 3
        }).setOrigin(0, 0.5).setDepth(3);

        this.add.text(W / 2, 28, `ROOM  ${this.roomId?.substring(0, 8).toUpperCase()}`, {
            fontSize: "11px",
            color: "#3a6645",
            fontFamily: "'Courier New', monospace",
            letterSpacing: 2
        }).setOrigin(0.5, 0.5).setDepth(3);

        this.add.text(W - 20, 28, "◉  NIGHT PHASE", {
            fontSize: "11px",
            color: "#3a6645",
            fontFamily: "'Courier New', monospace",
            letterSpacing: 2
        }).setOrigin(1, 0.5).setDepth(3);
    }

    // ══════════════════════════════
    //  العنوان
    // ══════════════════════════════
    private drawTitle(W: number) {
        const titleY = 110;

        const title = this.add.text(W / 2, titleY, "CHOOSE WHO TO SAVE", {
            fontSize: "32px",
            color: "#e8f5ee",
            fontFamily: "'Georgia', serif",
            fontStyle: "bold",
            letterSpacing: 6,
        }).setOrigin(0.5).setDepth(2).setAlpha(0);

        this.tweens.add({
            targets: title,
            alpha: 1, y: titleY - 5,
            duration: 700, ease: "Cubic.easeOut", delay: 300
        });

        const sub = this.add.text(W / 2, titleY + 38, "Protect one player from elimination tonight", {
            fontSize: "13px",
            color: "#3a6645",
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
        const targets = this.players.filter(p => p.alive);
        if (targets.length === 0) return;

        // ── Card dimensions (responsive) ──
        let cardW  = 140;
        let cardH  = 190;
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
            const isMe = player.id === socketService.socket.id;

            const container = this.add.container(x, cardY).setDepth(5).setAlpha(0);

            const shadow = this.add.rectangle(4, 6, cardW, cardH, 0x000000, 0.5);
            shadow.setOrigin(0.5);

            const bg = this.add.rectangle(0, 0, cardW, cardH, this.C.card);
            bg.setStrokeStyle(1, this.C.borderDim);
            bg.setOrigin(0.5);

            const topAccent = this.add.rectangle(0, -cardH / 2 + 2, cardW - 2, 3, this.C.accent, 0);
            topAccent.setOrigin(0.5, 0);

            const avatarBg = this.add.circle(0, -48, 28, 0x0a1a0c);
            avatarBg.setStrokeStyle(1, this.C.borderDim);

            const avatarIcon = this.add.text(0, -48, isMe ? "🧑‍⚕️" : "👤", {
                fontSize: "26px"
            }).setOrigin(0.5);

            // شريط الحياة
            const hpBg = this.add.rectangle(0, -8, 96, 8, 0x0d1a0f);
            hpBg.setStrokeStyle(1, this.C.borderDim);
            hpBg.setOrigin(0.5);

            const hpBar = this.add.rectangle(-48, -8, 96, 8, this.C.accent);
            hpBar.setOrigin(0, 0.5);

            // نبضة القلب
            const pulse = this.add.circle(0, -48, 32, this.C.accent, 0);
            this.tweens.add({
                targets: pulse,
                alpha: 0.12,
                scaleX: 1.4, scaleY: 1.4,
                duration: 900,
                yoyo: true, repeat: -1,
                delay: i * 180
            });

            const name = this.add.text(0, 12, player.username.toUpperCase(), {
                fontSize: "12px",
                color: "#c8e8d0",
                fontFamily: "'Courier New', monospace",
                fontStyle: "bold",
                letterSpacing: 1
            }).setOrigin(0.5);

            const status = this.add.text(0, 30, isMe ? "[ YOU ]" : "ALIVE", {
                fontSize: "10px",
                color: isMe ? "#22aa55" : "#3a6645",
                fontFamily: "'Courier New', monospace",
                letterSpacing: 2
            }).setOrigin(0.5);

            const btnBg = this.add.rectangle(0, 72, 100, 28, this.C.accent, 0);
            btnBg.setStrokeStyle(1, this.C.accent);
            btnBg.setOrigin(0.5);

            const btnLabel = this.add.text(0, 72, "PROTECT", {
                fontSize: "10px",
                color: "#22aa55",
                fontFamily: "'Courier New', monospace",
                letterSpacing: 2
            }).setOrigin(0.5);

            container.add([shadow, bg, topAccent, pulse, avatarBg, avatarIcon,
                           hpBg, hpBar, name, status, btnBg, btnLabel]);

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
                btnLabel.setColor("#44ff88");
                // شريط الحياة يتسع
                this.tweens.add({ targets: hpBar, scaleX: 1.05, duration: 200 });
                this.tweens.add({ targets: container, scaleX: 1.05, scaleY: 1.05, duration: 150 });
            });

            container.on("pointerout", () => {
                bg.setFillStyle(this.C.card);
                bg.setStrokeStyle(1, this.C.borderDim);
                topAccent.setAlpha(0);
                btnBg.setFillStyle(this.C.accent, 0);
                btnLabel.setColor("#22aa55");
                this.tweens.add({ targets: hpBar, scaleX: 1, duration: 200 });
                this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 150 });
            });

            container.on("pointerdown", () => {
                if (this.actionUsed) return;
                this.handleSave(player, container, bg, hpBar);
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
    //  تحديد اللاعب للإنقاذ
    // ══════════════════════════════
    private handleSave(player: any, selected: Phaser.GameObjects.Container,
                       bg: Phaser.GameObjects.Rectangle, hpBar: Phaser.GameObjects.Rectangle) {
        this.actionUsed = true;
        this.savedPlayerId = player.id;

        this.cameras.main.flash(350, 0, 80, 0);

        this.playerCards.forEach(card => {
            if (card !== selected && card?.active) {
                card.disableInteractive();
                this.tweens.add({ targets: card, alpha: 0.2, scaleX: 0.92, scaleY: 0.92, duration: 300 });
            }
        });

        this.tweens.add({ targets: selected, scaleX: 1.1, scaleY: 1.1, duration: 250, ease: "Back.easeOut" });

        bg.setFillStyle(0x0a200d);
        bg.setStrokeStyle(2, this.C.accentGlow);

        // شريط الحياة يمتلئ
        this.tweens.add({ targets: hpBar, scaleX: 1.1, duration: 400, ease: "Cubic.easeOut" });
        hpBar.setFillStyle(this.C.accentGlow);

        // دوائر شفاء انفجارية
        for (let i = 0; i < 6; i++) {
            this.time.delayedCall(i * 80, () => {
                const ring = this.add.graphics().setDepth(10);
                ring.lineStyle(2, this.C.ring2, 0.6);
                ring.strokeCircle(selected.x, selected.y, 20);
                this.tweens.add({
                    targets: ring,
                    scaleX: 3, scaleY: 3,
                    alpha: 0,
                    duration: 600,
                    onComplete: () => ring.destroy()
                });
            });
        }

        // علامة ✓
        const mark = this.add.text(selected.x, selected.y - 20, "✓", {
            fontSize: "56px",
            color: "#44ff88",
            fontStyle: "bold",
            fontFamily: "'Georgia', serif"
        }).setOrigin(0.5).setAlpha(0).setDepth(10);

        this.tweens.add({
            targets: mark,
            alpha: 1, scaleX: 1.2, scaleY: 1.2,
            duration: 250, yoyo: true, repeat: 1,
            onComplete: () => {
                this.tweens.add({ targets: mark, alpha: 0, duration: 400, onComplete: () => mark.destroy() });
            }
        });

        socketService.socket.emit("doctor_save", player.id);
        this.showToast(`Protected: ${player.username}`, "success");
    }

    // ══════════════════════════════
    //  Toast
    // ══════════════════════════════
    private showToast(message: string, type: "success" | "danger" | "info") {
        const colorMap = {
            success: { bg: 0x051a05, border: 0x22cc55, text: "#44ff88" },
            danger:  { bg: 0x1a0505, border: 0xcc2222, text: "#ff4444" },
            info:    { bg: 0x05051a, border: 0x2244cc, text: "#4488ff" },
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
            this.cameras.main.fadeOut(400, 8, 16, 10);
            this.time.delayedCall(400, () => {
                this.scene.start("GameScene", { role: "DOCTOR", roomId: this.roomId, userType: "PLAYER" });
            });
        });

        socketService.socket.on("back_to_lobby", () => {
            this.cameras.main.fadeOut(300, 8, 16, 10);
            this.time.delayedCall(300, () => {
                this.scene.start("GameScene", { role: "DOCTOR", roomId: this.roomId, userType: "PLAYER" });
            });
        });

        socketService.socket.on("player_killed", (data: any) => {
            if (data.id === this.savedPlayerId) {
                this.showToast(`Failed to save ${data.username}`, "danger");
            } else {
                this.showToast(`${data.username} was eliminated`, "danger");
            }
        });
    }

    shutdown() {
        this.cleanupMobileNightUI();
        this.cleanupNightChat();
        this.healParticles.forEach(p => p.gfx.destroy());
        this.healParticles = [];
        socketService.socket.off("phase_changed");
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
            zIndex: "1000", backgroundColor: "#08100a",
            display: "flex", flexDirection: "column",
            fontFamily: "'Courier New', monospace",
        });
        const header = document.createElement("div");
        Object.assign(header.style, {
            padding: "16px 20px", borderBottom: "1px solid #14532d",
            backgroundColor: "rgba(0,0,0,0.4)",
        });
        header.innerHTML = `<div style="color:#22c55e;font-size:11px;letter-spacing:3px;margin-bottom:6px">+ DOCTOR</div><div style="color:#f1f5f9;font-size:18px;font-weight:bold;letter-spacing:2px">CHOOSE WHO TO SAVE</div><div style="color:#64748b;font-size:11px;margin-top:4px">Protect one player from the Mafia tonight</div>`;
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
        const targets = this.players.filter(p => p.alive);
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
                backgroundColor: "rgba(17,24,39,0.8)", border: "1px solid #14532d",
            });
            const avatar = document.createElement("div");
            avatar.textContent = "👤";
            avatar.style.fontSize = "28px";
            const name = document.createElement("div");
            name.textContent = player.username;
            Object.assign(name.style, { flex: "1", color: "#f1f5f9", fontSize: "14px", fontWeight: "bold" });
            const btn = document.createElement("button");
            btn.textContent = "PROTECT";
            Object.assign(btn.style, {
                padding: "8px 16px", fontSize: "11px", fontWeight: "bold", letterSpacing: "2px",
                border: "1px solid #22c55e", borderRadius: "4px",
                backgroundColor: "transparent", color: "#22c55e", cursor: "pointer",
            });
            btn.onclick = () => {
                if (this.actionUsedMobile) return;
                this.actionUsedMobile = true;
                btn.textContent = "✓ DONE";
                btn.style.backgroundColor = "#22c55e";
                btn.style.color = "#000";
                document.querySelectorAll("#mobile-night-list button").forEach(b => {
                    (b as HTMLButtonElement).style.opacity = "0.4";
                    (b as HTMLButtonElement).style.pointerEvents = "none";
                });
                socketService.socket.emit("doctor_save", player.id);
                const W2 = this.scale.width;
                if (W2 < 700) {
                    this.showMobileResult("✚ PROTECTED", "#22c55e", player.username);
                }
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