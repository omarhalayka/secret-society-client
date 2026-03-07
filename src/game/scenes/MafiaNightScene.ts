import Phaser from "phaser";
import { socketService } from "../../socket";

export default class MafiaNightScene extends Phaser.Scene {

    private players: any[] = [];
    private roomId!: string;
    private actionUsed: boolean = false;
    private playerCards: Phaser.GameObjects.Container[] = [];
    private killedPlayerId: string | null = null;


    // جسيمات الجمر
    private embers: Array<{
        gfx: Phaser.GameObjects.Graphics;
        x: number; y: number;
        vx: number; vy: number;
        life: number; maxLife: number;
        size: number;
    }> = [];

    // ألوان الثيم - شخصية المافيا
    private readonly C = {
        bg:          0x080810,
        surface:     0x0f0f18,
        card:        0x130a0a,
        cardHover:   0x1f0f0f,
        borderDim:   0x2a1515,
        borderBright:0xcc2222,
        accent:      0xcc2222,
        accentGlow:  0xff4444,
        textPrimary: 0xf1e8e8,
        textMuted:   0x664444,
        ember1:      0xff4400,
        ember2:      0xff8800,
        ember3:      0xffcc00,
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
        super("MafiaNightScene");
    }

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
        const W = this.scale.width;
        const H = this.scale.height;

        this.cameras.main.setBackgroundColor("#080810");
        this.cameras.main.fadeIn(700, 8, 8, 16);

        // ─── طبقة الخلفية ───
        this.drawBackground(W, H);

        // ─── شريط علوي ───
        this.drawTopBar(W);

        // ─── العنوان ───
        this.drawTitle(W);

        // ─── بطاقات اللاعبين ───
        this.drawPlayerCards(W, H);

        // ─── Socket ───
        this.setupSocketListeners();

    }

    // ══════════════════════════════
    //  update — جسيمات الجمر
    // ══════════════════════════════
    update(_time: number, delta: number) {
        const W = this.scale.width;
        const H = this.scale.height;

        // إضافة جمر جديد بشكل عشوائي
        if (Math.random() < 0.18) {
            this.embers.push({
                gfx: this.add.graphics().setDepth(0),
                x: Math.random() * W,
                y: H + 10,
                vx: (Math.random() - 0.5) * 0.8,
                vy: -(0.5 + Math.random() * 1.2),
                life: 0,
                maxLife: 120 + Math.random() * 80,
                size: 1 + Math.random() * 2.5,
            });
        }

        // تحديث الجمر
        this.embers = this.embers.filter(e => {
            e.x += e.vx;
            e.y += e.vy;
            e.life++;

            const progress = e.life / e.maxLife;
            const alpha = progress < 0.3
                ? progress / 0.3
                : 1 - (progress - 0.3) / 0.7;

            // لون يتحول من برتقالي → أصفر → أحمر
            const color = progress < 0.5 ? this.C.ember2 : this.C.ember1;

            e.gfx.clear();
            e.gfx.fillStyle(color, Math.max(0, alpha * 0.9));
            e.gfx.fillCircle(e.x, e.y, e.size);

            if (e.life >= e.maxLife) {
                e.gfx.destroy();
                return false;
            }
            return true;
        });
    }

    // ══════════════════════════════
    //  رسم الخلفية
    // ══════════════════════════════
    private drawBackground(W: number, H: number) {
        // خلفية بازة
        this.add.rectangle(0, 0, W, H, this.C.bg).setOrigin(0).setDepth(0);

        // شبكة خفيفة
        const grid = this.add.graphics().setDepth(0);
        grid.lineStyle(1, 0x1a0808, 1);
        const step = 56;
        for (let x = 0; x < W; x += step) { grid.moveTo(x, 0); grid.lineTo(x, H); }
        for (let y = 0; y < H; y += step) { grid.moveTo(0, y); grid.lineTo(W, y); }
        grid.strokePath();

        // توهج أحمر أسفل الشاشة
        const glow = this.add.graphics().setDepth(0);
        glow.fillGradientStyle(0x000000, 0x000000, 0x330000, 0x330000, 0, 0, 0.6, 0.6);
        glow.fillRect(0, H * 0.55, W, H * 0.45);

        // خط أسفل
        const bottomLine = this.add.graphics().setDepth(1);
        bottomLine.lineStyle(1, this.C.accent, 0.3);
        bottomLine.moveTo(0, H - 1);
        bottomLine.lineTo(W, H - 1);
        bottomLine.strokePath();
    }

    // ══════════════════════════════
    //  الشريط العلوي
    // ══════════════════════════════
    private drawTopBar(W: number) {
        // خلفية الشريط
        const bar = this.add.rectangle(0, 0, W, 56, this.C.surface).setOrigin(0).setDepth(2);
        bar.setStrokeStyle(0);

        // خط أسفل الشريط بلون المافيا
        const line = this.add.graphics().setDepth(3);
        line.lineStyle(2, this.C.accent, 0.8);
        line.moveTo(0, 56); line.lineTo(W, 56);
        line.strokePath();

        // الدور
        this.add.text(20, 28, "🔪  MAFIA", {
            fontSize: "14px",
            color: "#cc2222",
            fontFamily: "'Courier New', monospace",
            fontStyle: "bold",
            letterSpacing: 3
        }).setOrigin(0, 0.5).setDepth(3);

        // معرف الغرفة
        this.add.text(W / 2, 28, `ROOM  ${this.roomId?.substring(0, 8).toUpperCase()}`, {
            fontSize: "11px",
            color: "#664444",
            fontFamily: "'Courier New', monospace",
            letterSpacing: 2
        }).setOrigin(0.5, 0.5).setDepth(3);

        // مرحلة الليل
        this.add.text(W - 20, 28, "◉  NIGHT PHASE", {
            fontSize: "11px",
            color: "#664444",
            fontFamily: "'Courier New', monospace",
            letterSpacing: 2
        }).setOrigin(1, 0.5).setDepth(3);
    }

    // ══════════════════════════════
    //  العنوان الرئيسي
    // ══════════════════════════════
    private drawTitle(W: number) {
        const titleY = 110;

        const title = this.add.text(W / 2, titleY, "CHOOSE YOUR TARGET", {
            fontSize: "32px",
            color: "#f1e8e8",
            fontFamily: "'Georgia', serif",
            fontStyle: "bold",
            letterSpacing: 6,
        }).setOrigin(0.5).setDepth(2).setAlpha(0);

        this.tweens.add({
            targets: title,
            alpha: 1,
            y: titleY - 5,
            duration: 700,
            ease: "Cubic.easeOut",
            delay: 300
        });

        const sub = this.add.text(W / 2, titleY + 38, "Select one player to eliminate tonight", {
            fontSize: "13px",
            color: "#664444",
            fontFamily: "'Courier New', monospace",
            letterSpacing: 2
        }).setOrigin(0.5).setDepth(2).setAlpha(0);

        this.tweens.add({
            targets: sub,
            alpha: 1,
            duration: 600,
            delay: 500
        });

        // خط فاصل أنيق
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

        const cardW = 140;
        const cardH = 180;
        const gap = 24;
        const totalW = targets.length * cardW + (targets.length - 1) * gap;
        const startX = W / 2 - totalW / 2 + cardW / 2;
        const cardY = H / 2 + 30;

        targets.forEach((player, i) => {
            const x = startX + i * (cardW + gap);

            const container = this.add.container(x, cardY).setDepth(5);
            container.setAlpha(0);

            // ─── ظل ───
            const shadow = this.add.rectangle(4, 6, cardW, cardH, 0x000000, 0.5);
            shadow.setOrigin(0.5);

            // ─── خلفية البطاقة ───
            const bg = this.add.rectangle(0, 0, cardW, cardH, this.C.card);
            bg.setStrokeStyle(1, this.C.borderDim);
            bg.setOrigin(0.5);

            // ─── شريط علوي داخل البطاقة ───
            const topAccent = this.add.rectangle(0, -cardH / 2 + 2, cardW - 2, 3, this.C.accent, 0);
            topAccent.setOrigin(0.5, 0);

            // ─── أيقونة اللاعب ───
            const avatarBg = this.add.circle(0, -42, 30, 0x1a0a0a);
            avatarBg.setStrokeStyle(1, this.C.borderDim);

            const avatarIcon = this.add.text(0, -42, "👤", {
                fontSize: "28px"
            }).setOrigin(0.5);

            // ─── نبضة ─── 
            const pulse = this.add.circle(0, -42, 34, this.C.accent, 0);
            this.tweens.add({
                targets: pulse,
                alpha: 0.15,
                scaleX: 1.3, scaleY: 1.3,
                duration: 1200,
                yoyo: true, repeat: -1,
                delay: i * 200
            });

            // ─── اسم اللاعب ───
            const name = this.add.text(0, 12, player.username.toUpperCase(), {
                fontSize: "12px",
                color: "#c8b8b8",
                fontFamily: "'Courier New', monospace",
                fontStyle: "bold",
                letterSpacing: 1
            }).setOrigin(0.5);

            // ─── رقم اللاعب ───
            const num = this.add.text(0, 34, `PLAYER ${String(i + 1).padStart(2, "0")}`, {
                fontSize: "10px",
                color: "#442222",
                fontFamily: "'Courier New', monospace",
                letterSpacing: 2
            }).setOrigin(0.5);

            // ─── زر الاستهداف ───
            const btnBg = this.add.rectangle(0, 68, 100, 28, this.C.accent, 0);
            btnBg.setStrokeStyle(1, this.C.accent);
            btnBg.setOrigin(0.5);

            const btnLabel = this.add.text(0, 68, "ELIMINATE", {
                fontSize: "10px",
                color: "#cc2222",
                fontFamily: "'Courier New', monospace",
                letterSpacing: 2
            }).setOrigin(0.5);

            container.add([shadow, bg, topAccent, pulse, avatarBg, avatarIcon, name, num, btnBg, btnLabel]);

            // ─── Interactivity ───
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
                btnLabel.setColor("#ff4444");
                this.tweens.add({ targets: container, scaleX: 1.05, scaleY: 1.05, duration: 150 });
            });

            container.on("pointerout", () => {
                bg.setFillStyle(this.C.card);
                bg.setStrokeStyle(1, this.C.borderDim);
                topAccent.setAlpha(0);
                btnBg.setFillStyle(this.C.accent, 0);
                btnLabel.setColor("#cc2222");
                this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 150 });
            });

            container.on("pointerdown", () => {
                if (this.actionUsed) return;
                this.handleTarget(player, container, bg);
            });

            this.playerCards.push(container);

            // ─── أنيميشن دخول متتابع ───
            this.tweens.add({
                targets: container,
                alpha: 1,
                y: cardY,
                duration: 500,
                delay: 200 + i * 120,
                ease: "Back.easeOut",
                onStart: () => container.setY(cardY + 40)
            });
        });
    }

    // ══════════════════════════════
    //  تحديد الهدف
    // ══════════════════════════════
    private handleTarget(player: any, selected: Phaser.GameObjects.Container, bg: Phaser.GameObjects.Rectangle) {
        this.actionUsed = true;
        this.killedPlayerId = player.id;

        // وميض أحمر
        this.cameras.main.flash(400, 120, 0, 0);
        this.cameras.main.shake(300, 0.008);

        // تعتيم باقي البطاقات
        this.playerCards.forEach(card => {
            if (card !== selected && card?.active) {
                card.disableInteractive();
                this.tweens.add({
                    targets: card,
                    alpha: 0.2,
                    scaleX: 0.92, scaleY: 0.92,
                    duration: 300
                });
            }
        });

        // تكبير البطاقة المختارة
        this.tweens.add({
            targets: selected,
            scaleX: 1.1, scaleY: 1.1,
            duration: 250,
            ease: "Back.easeOut"
        });

        bg.setFillStyle(0x2a0a0a);
        bg.setStrokeStyle(2, this.C.accentGlow);

        // علامة X حمراء
        const mark = this.add.text(selected.x, selected.y - 20, "✕", {
            fontSize: "52px",
            color: "#ff2222",
            fontStyle: "bold",
            fontFamily: "'Georgia', serif"
        }).setOrigin(0.5).setAlpha(0).setDepth(10);

        this.tweens.add({
            targets: mark,
            alpha: 1, scaleX: 1.2, scaleY: 1.2,
            duration: 200,
            yoyo: true, repeat: 1,
            onComplete: () => {
                this.tweens.add({
                    targets: mark,
                    alpha: 0, duration: 400,
                    onComplete: () => mark.destroy()
                });
            }
        });

        // إرسال للسيرفر
        socketService.socket.emit("mafia_kill", player.id);

        // Toast تأكيد
        this.showToast(`Target locked: ${player.username}`, "danger");
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

        this.tweens.add({
            targets: toast,
            alpha: 1, y: H - 50,
            duration: 300, ease: "Cubic.easeOut"
        });
        this.time.delayedCall(2800, () => {
            this.tweens.add({
                targets: toast,
                alpha: 0, y: H - 30,
                duration: 300,
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
            this.cameras.main.fadeOut(400, 8, 8, 16);
            this.time.delayedCall(400, () => {
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
            if (data.id === this.killedPlayerId) {
                this.showToast(`${data.username} has been eliminated`, "danger");
            }
        });
    }

    shutdown() {
        this.cleanupNightChat();
        this.embers.forEach(e => e.gfx.destroy());
        this.embers = [];
        socketService.socket.off("phase_changed");
        socketService.socket.off("player_killed");
        socketService.socket.off("back_to_lobby");
    }
}