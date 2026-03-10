import Phaser from "phaser";
import { socketService } from "../../socket";

export default class GameScene extends Phaser.Scene {

    // ─── بيانات اللعبة ───
    private role!: string;
    private roomId!: string;
    private userType: string = "PLAYER";
    private isAdmin: boolean = false;
    private currentPlayers: any[] = [];
    private actionUsed: boolean = false;
    private isNightSceneActive: boolean = false;

    // ─── عناصر Phaser ───
    private phaseText!: Phaser.GameObjects.Text;
    private roundText!: Phaser.GameObjects.Text;
    private roleChip!: Phaser.GameObjects.Container;
    private playerRows: Phaser.GameObjects.Container[] = [];
    private chatMessages: Phaser.GameObjects.Text[] = [];
    private voteEntries: Array<Phaser.GameObjects.GameObject> = [];
    private voteTitle?: Phaser.GameObjects.Text;
    private detectiveResult?: Phaser.GameObjects.Container;
    private winOverlay?: Phaser.GameObjects.Container;
    private eventLogItems: Phaser.GameObjects.Text[] = [];

    // ─── Voting Overlay (Phaser objects داخل نفس الـ scene) ───
    // BUG FIX #1: التصويت صار overlay داخل GameScene بدل scene منفصلة
    private votingOverlayContainer?: Phaser.GameObjects.Container;
    private votingCards: Map<string, {
        container: Phaser.GameObjects.Container;
        barFill:   Phaser.GameObjects.Rectangle;
        voteLabel: Phaser.GameObjects.Text;
        bg:        Phaser.GameObjects.Rectangle;
        topBar:    Phaser.GameObjects.Rectangle;
        btnLabel:  Phaser.GameObjects.Text;
    }> = new Map();
    private myVote: string | null = null;

    // ─── Night Result Overlay (للمافيا/دكتور/محقق) ───
    // BUG FIX #3: نتائج الليل تطلع لهذه الأدوار
    private nightResultOverlay?: Phaser.GameObjects.Container;

    // ─── HTML Elements ───
    private chatInput!: HTMLInputElement;
    private sendBtn!: HTMLButtonElement;
    private chatStatusText?: Phaser.GameObjects.Text; // مؤشر حالة الشات
    private adminDrawer?: HTMLDivElement;
    private adminToggleBtn?: HTMLButtonElement;
    private adminDrawerOpen: boolean = false;
    private outsideClickHandler?: (e: MouseEvent) => void;

    // ─── تخطيط ───
    private readonly TOPBAR_H  = 58;
    private PLAYERS_W: number = 220;
    private CHAT_W:    number = 280;
    private W!: number;
    private H!: number;
    private CONTENT_H!: number;
    private EVENTS_W!: number;

    // ─── ألوان ───
    private readonly C = {
        bg:          0x0a0d13, surface:     0x111827,
        surfaceAlt:  0x0f1520, border:      0x1e2d45,
        accent:      0x3b82f6, alive:       0x22c55e,
        dead:        0x374151, mafia:       0xef4444,
        doctor:      0x22c55e, detective:   0x3b82f6,
        citizen:     0x94a3b8, admin:       0xf59e0b,
        night:       0x6366f1, day:         0xfbbf24,
        voting:      0xf59e0b, nightReview: 0xa855f7,
    };

    constructor() { super("GameScene"); }

    init(data: any) {
        this.role      = data.role;
        this.roomId    = data.roomId;
        this.userType  = data.userType || "PLAYER";
        this.isAdmin   = this.role === "ADMIN";
        this.myVote    = null;
        this.votingCards.clear();
        if (this.isAdmin) socketService.isAdmin = true;
    }

    create() {
        if (!this.role || !this.roomId) { this.scene.start("LobbyScene"); return; }

        this.W = this.scale.width;
        this.H = this.scale.height;

        // ── على الهاتف: نخفي الجانبين ونعرض tabs ──
        if (this.W < 700) {
            this.PLAYERS_W = 0;
            this.CHAT_W    = 0;
        } else {
            this.PLAYERS_W = 220;
            this.CHAT_W    = 280;
        }
        this.CONTENT_H = this.H - this.TOPBAR_H;
        this.EVENTS_W  = this.W - this.PLAYERS_W - this.CHAT_W;

        this.cleanupHTML();
        this.cameras.main.fadeIn(600, 10, 13, 19);
        this.drawBackground();
        if (this.W >= 700) this.drawPanels();
        this.drawTopBar();
        if (this.W >= 700) this.drawSectionHeaders();
        this.createChatInput();
        this.createMobileTabs();
        if (this.isAdmin) this.createAdminDrawer();
        this.setupSocketListeners();
        socketService.socket.emit("request_room_state");
    }

    // ══════════════════════════════════════
    //  خلفية
    // ══════════════════════════════════════
    private drawBackground() {
        this.add.rectangle(0, 0, this.W, this.H, this.C.bg).setOrigin(0).setDepth(0);
        const g = this.add.graphics().setDepth(0);
        g.lineStyle(1, 0x0f1520, 1);
        for (let x = 0; x < this.W; x += 48) { g.moveTo(x, 0); g.lineTo(x, this.H); }
        for (let y = 0; y < this.H; y += 48) { g.moveTo(0, y); g.lineTo(this.W, y); }
        g.strokePath();
    }

    // ══════════════════════════════════════
    //  الـ Panels الثلاث
    // ══════════════════════════════════════
    private drawPanels() {
        const pY = this.TOPBAR_H, pH = this.CONTENT_H;
        const chatX = this.PLAYERS_W + this.EVENTS_W;
        this.add.rectangle(0, pY, this.PLAYERS_W, pH, this.C.surface).setOrigin(0).setDepth(1);
        this.strokeRect(0, pY, this.PLAYERS_W, pH, this.C.border);
        this.add.rectangle(this.PLAYERS_W, pY, this.EVENTS_W, pH, this.C.surfaceAlt).setOrigin(0).setDepth(1);
        this.strokeRect(this.PLAYERS_W, pY, this.EVENTS_W, pH, this.C.border);
        this.add.rectangle(chatX, pY, this.CHAT_W, pH, this.C.surface).setOrigin(0).setDepth(1);
        this.strokeRect(chatX, pY, this.CHAT_W, pH, this.C.border);
    }

    private strokeRect(x: number, y: number, w: number, h: number, color: number) {
        const g = this.add.graphics().setDepth(2);
        g.lineStyle(1, color, 0.5);
        g.strokeRect(x, y, w, h);
    }

    // ══════════════════════════════════════
    //  TopBar
    // ══════════════════════════════════════
    private drawTopBar() {
        this.add.rectangle(0, 0, this.W, this.TOPBAR_H, this.C.surface).setOrigin(0).setDepth(3);
        const line = this.add.graphics().setDepth(4);
        line.lineStyle(2, this.C.accent, 0.4);
        line.moveTo(0, this.TOPBAR_H); line.lineTo(this.W, this.TOPBAR_H);
        line.strokePath();

        this.add.text(20, this.TOPBAR_H / 2, "SECRET SOCIETY", {
            fontSize: "16px", color: "#f1f5f9",
            fontFamily: "'Georgia', serif", fontStyle: "bold", letterSpacing: 3
        }).setOrigin(0, 0.5).setDepth(4);

        this.add.text(this.W / 2, this.TOPBAR_H / 2,
            `ROOM  ${this.roomId?.substring(0, 8).toUpperCase()}`, {
            fontSize: "11px", color: "#64748b",
            fontFamily: "'Courier New', monospace", letterSpacing: 2
        }).setOrigin(0.5, 0.5).setDepth(4);

        this.phaseText = this.add.text(this.W / 2 + 130, this.TOPBAR_H / 2, "◉  WAITING", {
            fontSize: "11px", color: "#64748b",
            fontFamily: "'Courier New', monospace", letterSpacing: 2
        }).setOrigin(0, 0.5).setDepth(4);

        this.roundText = this.add.text(this.W / 2 + 270, this.TOPBAR_H / 2, "ROUND 1", {
            fontSize: "11px", color: "#64748b",
            fontFamily: "'Courier New', monospace", letterSpacing: 2
        }).setOrigin(0, 0.5).setDepth(4);

        // شارة للمشاهدين بدل Role Chip
        if (this.userType === "SPECTATOR") {
            const specBadge = this.add.container(this.W - 20, this.TOPBAR_H / 2).setDepth(4);
            const specBg = this.add.rectangle(0, 0, 150, 28, 0x0f1520);
            specBg.setStrokeStyle(1, 0x3b82f6, 0.6); specBg.setOrigin(1, 0.5);
            const specLbl = this.add.text(-10, 0, "👁  SPECTATOR MODE", {
                fontSize: "10px", color: "#3b82f6",
                fontFamily: "'Courier New', monospace", fontStyle: "bold", letterSpacing: 1
            }).setOrigin(1, 0.5);
            specBadge.add([specBg, specLbl]);
            this.tweens.add({ targets: specBg, alpha: 0.5, duration: 1400, yoyo: true, repeat: -1 });
        }

        this.buildRoleChip();
        if (this.isAdmin) this.createAdminToggleBtn();
    }

    private buildRoleChip() {
        const colors: Record<string, number> = {
            ADMIN: this.C.admin, MAFIA: this.C.mafia, DETECTIVE: this.C.detective,
            DOCTOR: this.C.doctor, CITIZEN: this.C.citizen, SPECTATOR: 0x64748b
        };
        const icons: Record<string, string> = {
            ADMIN: "👑", MAFIA: "🔪", DETECTIVE: "🔍",
            DOCTOR: "✚", CITIZEN: "◎", SPECTATOR: "👁"
        };
        const chipColor = colors[this.role] || 0x64748b;
        const chipHex   = "#" + chipColor.toString(16).padStart(6, "0");
        const chipX     = this.isAdmin ? this.W - 200 : this.W - 20;
        if (this.roleChip) this.roleChip.destroy();
        const c  = this.add.container(chipX, this.TOPBAR_H / 2).setDepth(4);
        const bg = this.add.rectangle(0, 0, 150, 30, 0x0f1520);
        bg.setStrokeStyle(1, chipColor); bg.setOrigin(1, 0.5);
        const lbl = this.add.text(-10, 0, `${icons[this.role] || "◎"}  ${this.role}`, {
            fontSize: "13px", color: chipHex,
            fontFamily: "'Courier New', monospace", fontStyle: "bold", letterSpacing: 2
        }).setOrigin(1, 0.5);
        c.add([bg, lbl]);
        this.roleChip = c;
        this.tweens.add({ targets: bg, alpha: 0.5, duration: 1200, yoyo: true, repeat: -1 });
    }

    // ══════════════════════════════════════
    //  Section Headers
    // ══════════════════════════════════════
    private drawSectionHeaders() {
        const chatX = this.PLAYERS_W + this.EVENTS_W;
        [
            { x: 16,               label: "PLAYERS"   },
            { x: this.PLAYERS_W + 16, label: "EVENT LOG" },
            { x: chatX + 16,       label: "CHAT"      },
        ].forEach((h, i) => {
            const t = this.add.text(h.x, this.TOPBAR_H + 16, h.label, {
                fontSize: "10px", color: "#3b82f6",
                fontFamily: "'Courier New', monospace", fontStyle: "bold", letterSpacing: 3
            }).setDepth(3).setAlpha(0);
            this.tweens.add({ targets: t, alpha: 1, y: t.y - 4, duration: 400, delay: i * 80 });
        });
        const sepY = this.TOPBAR_H + 34;
        const sep  = this.add.graphics().setDepth(3);
        sep.lineStyle(1, this.C.border, 0.4);
        [
            { x: 0,              w: this.PLAYERS_W },
            { x: this.PLAYERS_W, w: this.EVENTS_W  },
            { x: chatX,          w: this.CHAT_W    },
        ].forEach(s => { sep.moveTo(s.x + 12, sepY); sep.lineTo(s.x + s.w - 12, sepY); });
        sep.strokePath();

        // ─── مؤشر حالة الشات (LIVE / NIGHT) ───
        this.chatStatusText = this.add.text(
            chatX + this.CHAT_W - 14,
            this.TOPBAR_H + 16,
            "● LIVE",
            {
                fontSize: "9px", color: "#22c55e",
                fontFamily: "'Courier New', monospace", letterSpacing: 1
            }
        ).setOrigin(1, 0.5).setDepth(3);
    }

    // ══════════════════════════════════════
    //  اللاعبين
    // ══════════════════════════════════════
    private drawPlayers(players: any[], phase: string) {
        this.playerRows.forEach(r =>
            this.tweens.add({ targets: r, alpha: 0, duration: 200, onComplete: () => r.destroy() })
        );
        this.playerRows = [];
        this.currentPlayers = players;
        this.updateMobilePlayers(players);
        if (this.W < 700) return;
        const startY  = this.TOPBAR_H + 50;
        const isNight = phase === "NIGHT";
        // BUG FIX #2: المشاهد ما يشوف أزرار الأكشن
        const isVote  = phase === "VOTING";
        players.forEach((p, i) =>
            this.time.delayedCall(i * 55, () => this.buildPlayerRow(p, startY + i * 44, isNight, isVote))
        );
    }

    private buildPlayerRow(player: any, y: number, isNight: boolean, isVoting: boolean) {
        const container = this.add.container(0, y).setDepth(3).setAlpha(0);
        const isAlive   = player.alive;
        const isMe      = player.id === socketService.socket.id;

        const dot = this.add.circle(16, 0, 5, isAlive ? this.C.alive : this.C.dead);
        if (isAlive) {
            this.tweens.add({ targets: dot, alpha: 0.3, duration: 900, yoyo: true, repeat: -1, delay: Math.random() * 600 });
        }

        let tag = "";
        if (this.isAdmin || isMe)                                  tag = `  [${player.role}]`;
        else if (this.role === "MAFIA" && player.role === "MAFIA") tag = "  [MAFIA]";
        // BUG FIX #2: المشاهد يشوف أدوار الكل
        else if (this.userType === "SPECTATOR")                    tag = `  [${player.role}]`;

        const name = this.add.text(30, 0, `${player.username}${tag}`, {
            fontSize: "13px", color: isAlive ? "#e2e8f0" : "#374151",
            fontFamily: "'Courier New', monospace", fontStyle: isMe ? "bold" : "normal"
        }).setOrigin(0, 0.5);

        const sep = this.add.graphics();
        sep.lineStyle(1, this.C.border, 0.25);
        sep.moveTo(10, 20); sep.lineTo(this.PLAYERS_W - 10, 20); sep.strokePath();
        container.add([sep, dot, name]);

        // BUG FIX #2: المشاهد ما عنده أزرار — فقط اللاعبين الفعليين
        if (isAlive && !this.isAdmin && this.userType !== "SPECTATOR") {
            const btnX = this.PLAYERS_W - 32;
            if (this.role === "MAFIA"     && isNight && !isMe)
                this.addActionBtn(container, btnX, 0, "⚔", "#ef4444", () => {
                    if (!this.actionUsed) { this.actionUsed = true; socketService.socket.emit("mafia_kill", player.id); }
                });
            if (this.role === "DOCTOR"    && isNight)
                this.addActionBtn(container, btnX, 0, "✚", "#22c55e", () => {
                    if (!this.actionUsed) { this.actionUsed = true; socketService.socket.emit("doctor_save", player.id); }
                });
            if (this.role === "DETECTIVE" && isNight && !isMe)
                this.addActionBtn(container, btnX, 0, "🔍", "#3b82f6", () => {
                    if (!this.actionUsed) { this.actionUsed = true; socketService.socket.emit("detective_check", player.id); }
                });
            // ملاحظة: زر التصويت 🗳 حُذف من هنا — التصويت صار بالـ Voting Overlay الكامل
        }

        this.playerRows.push(container);
        this.tweens.add({
            targets: container, alpha: 1, duration: 300, ease: "Cubic.easeOut",
            onStart: () => container.setX(-10), onComplete: () => container.setX(0)
        });
    }

    private addActionBtn(
        parent: Phaser.GameObjects.Container,
        x: number, y: number,
        icon: string, color: string,
        cb: () => void
    ) {
        const btn = this.add.text(x, y, icon, {
            fontSize: "15px", color, backgroundColor: "#0f1520", padding: { x: 5, y: 2 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        btn.on("pointerover", () => btn.setScale(1.2));
        btn.on("pointerout",  () => btn.setScale(1));
        btn.on("pointerdown", () =>
            this.tweens.add({ targets: btn, scaleX: 0.85, scaleY: 0.85, duration: 70, yoyo: true, onComplete: cb })
        );
        parent.add(btn);
    }

    // ══════════════════════════════════════
    //  VOTING OVERLAY — كامل داخل GameScene
    //  BUG FIX #1: بطاقات تطلع في المنتصف
    // ══════════════════════════════════════
    private showVotingOverlay() {
        // امسح أي overlay قديم
        this.closeVotingOverlay(false);
        this.myVote = null;
        this.votingCards.clear();

        const alivePlayers = this.currentPlayers.filter(p => p.alive);
        if (alivePlayers.length === 0) return;

        const overlay = this.add.container(0, 0).setDepth(50);

        // Dim
        const dim = this.add.rectangle(0, 0, this.W, this.H, 0x000000, 0.75).setOrigin(0);
        overlay.add(dim);

        // العنوان
        const titleTxt = this.add.text(this.W / 2, 78, "VOTE TO ELIMINATE", {
            fontSize: "32px", color: "#f1f5f9",
            fontFamily: "'Georgia', serif", fontStyle: "bold", letterSpacing: 8
        }).setOrigin(0.5);

        const subTxt = this.add.text(this.W / 2, 120, "Choose who threatens the community", {
            fontSize: "12px", color: "#64748b",
            fontFamily: "'Courier New', monospace", letterSpacing: 2
        }).setOrigin(0.5);

        const divG = this.add.graphics();
        divG.lineStyle(1, 0xf59e0b, 0.3);
        divG.moveTo(this.W / 2 - 140, 138);
        divG.lineTo(this.W / 2 + 140, 138);
        divG.strokePath();

        // BUG FIX #2: المشاهد يشوف البطاقات بدون زر تصويت
        const isSpectator = this.userType === "SPECTATOR";
        if (isSpectator) {
            const specLbl = this.add.text(this.W / 2, 152, "[ SPECTATOR — VIEWING ONLY ]", {
                fontSize: "10px", color: "#334155",
                fontFamily: "'Courier New', monospace", letterSpacing: 3
            }).setOrigin(0.5);
            overlay.add(specLbl);
        }

        overlay.add([titleTxt, subTxt, divG]);

        // حساب positions البطاقات
        const cardW  = 148;
        const cardH  = 196;
        const gap    = 16;
        const perRow = Math.min(alivePlayers.length, 4);
        const rows   = Math.ceil(alivePlayers.length / perRow);
        const totalW = perRow * cardW + (perRow - 1) * gap;
        const startX = this.W / 2 - totalW / 2 + cardW / 2;
        const startY = this.H / 2 - (rows * (cardH + gap)) / 2 + cardH / 2 + 18;

        alivePlayers.forEach((player, i) => {
            const col = i % perRow;
            const row = Math.floor(i / perRow);
            const cx  = startX + col * (cardW + gap);
            const cy  = startY + row * (cardH + gap);
            this.time.delayedCall(60 + i * 70, () => {
                const card = this.buildVotingCard(player, cx, cy, cardW, cardH, isSpectator);
                overlay.add(card);
            });
        });

        overlay.setAlpha(0);
        this.tweens.add({ targets: overlay, alpha: 1, duration: 300 });
        this.votingOverlayContainer = overlay;
    }

    private buildVotingCard(
        player: any, cx: number, cy: number,
        cardW: number, cardH: number,
        isSpectator: boolean
    ): Phaser.GameObjects.Container {
        const isMe = player.id === socketService.socket.id;
        const container = this.add.container(cx, cy + 24).setAlpha(0);

        // ظل
        const shadow = this.add.rectangle(4, 6, cardW, cardH, 0x000000, 0.45).setOrigin(0.5);
        // خلفية
        const bg = this.add.rectangle(0, 0, cardW, cardH, 0x0d1117);
        bg.setStrokeStyle(1, this.C.border); bg.setOrigin(0.5);
        // شريط علوي (يظهر على hover/vote)
        const topBar = this.add.rectangle(0, -(cardH / 2) + 2, cardW - 2, 3, 0xf59e0b, 0);
        topBar.setOrigin(0.5, 0);
        // أيقونة
        const avatarBg = this.add.circle(0, -60, 27, 0x0a0d13);
        avatarBg.setStrokeStyle(1, this.C.border);
        const avatarIcon = this.add.text(0, -60, isMe ? "🧑" : "👤", { fontSize: "24px" }).setOrigin(0.5);
        // نبضة
        const pulse = this.add.circle(0, -60, 34, 0xf59e0b, 0);
        this.tweens.add({ targets: pulse, alpha: 0.1, scaleX: 1.3, scaleY: 1.3, duration: 1000, yoyo: true, repeat: -1, delay: Math.random() * 500 });
        // اسم
        const nameTxt = this.add.text(0, -20, player.username.toUpperCase(), {
            fontSize: "11px", color: isMe ? "#fcd34d" : "#e2e8f0",
            fontFamily: "'Courier New', monospace",
            fontStyle: isMe ? "bold" : "normal", letterSpacing: 1
        }).setOrigin(0.5);
        // YOU
        const youLbl = isMe ? this.add.text(0, -6, "[ YOU ]", {
            fontSize: "9px", color: "#64748b",
            fontFamily: "'Courier New', monospace", letterSpacing: 2
        }).setOrigin(0.5) : null;
        // شريط أصوات
        const barBg   = this.add.rectangle(0, 34, cardW - 24, 6, 0x111827).setOrigin(0.5);
        const barFill = this.add.rectangle(-(cardW - 24) / 2, 34, 0, 6, 0xf59e0b, 0.8).setOrigin(0, 0.5);
        // عداد
        const voteLabel = this.add.text(0, 50, "0 votes", {
            fontSize: "10px", color: "#64748b",
            fontFamily: "'Courier New', monospace", letterSpacing: 1
        }).setOrigin(0.5);
        // زر VOTE
        const btnBg = this.add.rectangle(0, 74, cardW - 24, 26, 0x0a0d13);
        btnBg.setStrokeStyle(1, isSpectator ? 0x1e2d45 : 0xf59e0b, isSpectator ? 0.3 : 0.45).setOrigin(0.5);
        const btnLabel = this.add.text(0, 74,
            isSpectator ? "WATCHING" : (isMe ? "—" : "VOTE"), {
            fontSize: "10px",
            color: isSpectator ? "#334155" : (isMe ? "#374151" : "#f59e0b"),
            fontFamily: "'Courier New', monospace", fontStyle: "bold", letterSpacing: 3
        }).setOrigin(0.5);

        const items: Phaser.GameObjects.GameObject[] = [shadow, bg, topBar, pulse, avatarBg, avatarIcon, nameTxt, barBg, barFill, voteLabel, btnBg, btnLabel];
        if (youLbl) items.push(youLbl);
        container.add(items);

        // Interactivity — فقط للاعب فعلي، وليس على نفسه
        if (!isSpectator && !isMe) {
            container.setInteractive(
                new Phaser.Geom.Rectangle(-cardW / 2, -cardH / 2, cardW, cardH),
                Phaser.Geom.Rectangle.Contains
            );
            container.on("pointerover", () => {
                if (this.myVote) return;
                bg.setFillStyle(0x111827);
                bg.setStrokeStyle(1, 0xf59e0b);
                topBar.setAlpha(1);
                btnBg.setFillStyle(0x1a1200);
                btnLabel.setColor("#fcd34d");
                this.tweens.add({ targets: container, scaleX: 1.04, scaleY: 1.04, duration: 120 });
            });
            container.on("pointerout", () => {
                if (this.myVote === player.id) return;
                bg.setFillStyle(0x0d1117);
                bg.setStrokeStyle(1, this.C.border);
                topBar.setAlpha(0);
                btnBg.setFillStyle(0x0a0d13);
                btnLabel.setColor("#f59e0b");
                this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 120 });
            });
            container.on("pointerdown", () => {
                if (this.myVote) return;
                this.castVote(player.id, bg, topBar, btnLabel);
            });
        }

        // تخزين reference
        this.votingCards.set(player.id, { container, barFill, voteLabel, bg, topBar, btnLabel });

        // أنيميشن دخول
        this.tweens.add({ targets: container, alpha: 1, y: cy, duration: 380, ease: "Back.easeOut" });
        return container;
    }

    private castVote(
        playerId: string,
        bg: Phaser.GameObjects.Rectangle,
        topBar: Phaser.GameObjects.Rectangle,
        btnLabel: Phaser.GameObjects.Text
    ) {
        this.myVote = playerId;
        socketService.socket.emit("vote", playerId);

        // تعتيم باقي البطاقات
        this.votingCards.forEach((card, id) => {
            if (id !== playerId) {
                card.container.disableInteractive();
                this.tweens.add({ targets: card.container, alpha: 0.28, scaleX: 0.94, scaleY: 0.94, duration: 280 });
            }
        });

        // تمييز البطاقة المختارة
        bg.setFillStyle(0x150c00);
        bg.setStrokeStyle(2, 0xef4444);
        topBar.setFillStyle(0xef4444); topBar.setAlpha(1);
        btnLabel.setText("VOTED ✓").setColor("#f87171");
        this.cameras.main.flash(220, 50, 20, 0);
    }

    private updateVotingCards(votes: Record<string, number>) {
        if (this.votingCards.size === 0) return;
        const total  = Math.max(Object.values(votes).reduce((a, b) => a + b, 0), 1);
        const maxV   = Math.max(...Object.values(votes), 0);
        const maxBarW = 124;

        this.votingCards.forEach((card, playerId) => {
            const count   = votes[playerId] || 0;
            const targetW = Math.max(1, (count / total) * maxBarW);
            this.tweens.add({ targets: card.barFill, width: targetW, duration: 360, ease: "Cubic.easeOut" });
            card.voteLabel.setText(`${count} vote${count !== 1 ? "s" : ""}`);
            card.voteLabel.setColor(count > 0 ? "#fbbf24" : "#64748b");
            // أعلى شخص بالأصوات يتلمّع
            if (count > 0 && count === maxV && this.myVote !== playerId) {
                card.bg.setStrokeStyle(1, 0xf59e0b, 0.55);
                card.topBar.setFillStyle(0xf59e0b); card.topBar.setAlpha(0.45);
            }
        });
    }

    private closeVotingOverlay(showResult: boolean, result?: { eliminated?: string; tie?: boolean }) {
        if (!this.votingOverlayContainer) return;
        const ov = this.votingOverlayContainer;

        if (showResult && result) {
            const isTie  = result.tie;
            const label  = isTie ? "TIE — No one eliminated" : `${result.eliminated} eliminated`;
            const bColor = isTie ? 0xfbbf24 : 0xef4444;
            const tColor = isTie ? "#fcd34d" : "#f87171";

            const banner = this.add.container(this.W / 2, this.H / 2).setDepth(55).setAlpha(0);
            const panBg  = this.add.rectangle(0, 0, 420, 78, isTie ? 0x0d1000 : 0x130500);
            panBg.setStrokeStyle(2, bColor);
            const panTxt = this.add.text(0, -12, label, {
                fontSize: "22px", color: tColor,
                fontFamily: "'Courier New', monospace", fontStyle: "bold", letterSpacing: 3
            }).setOrigin(0.5);
            const panSub = this.add.text(0, 16, "Voting session closed", {
                fontSize: "11px", color: "#4b5563",
                fontFamily: "'Courier New', monospace", letterSpacing: 2
            }).setOrigin(0.5);
            banner.add([panBg, panTxt, panSub]);
            this.tweens.add({ targets: banner, alpha: 1, duration: 320, ease: "Back.easeOut" });

            this.time.delayedCall(2200, () => {
                this.tweens.add({
                    targets: [banner, ov], alpha: 0, duration: 380,
                    onComplete: () => {
                        banner.destroy();
                        ov.destroy();
                        if (this.votingOverlayContainer === ov) {
                            this.votingOverlayContainer = undefined;
                            this.votingCards.clear();
                            this.myVote = null;
                        }
                    }
                });
            });
        } else {
            this.tweens.add({
                targets: ov, alpha: 0, duration: 300,
                onComplete: () => {
                    ov.destroy();
                    if (this.votingOverlayContainer === ov) {
                        this.votingOverlayContainer = undefined;
                        this.votingCards.clear();
                        this.myVote = null;
                    }
                }
            });
        }
    }

    // ══════════════════════════════════════
    //  NIGHT RESULT OVERLAY
    //  BUG FIX #3: نتائج الليل للمافيا/دكتور/محقق
    // ══════════════════════════════════════
    private showNightResultOverlay(data: any) {
        this.nightResultOverlay?.destroy();
        this.nightResultOverlay = undefined;

        // فقط هذه الأدوار — الـ citizen ما يشوف
        if (!["MAFIA", "DOCTOR", "DETECTIVE"].includes(this.role)) return;

        const mafiaTarget = this.currentPlayers.find(p => p.id === data.mafiaTarget);
        const doctorSave  = this.currentPlayers.find(p => p.id === data.doctorSave);
        const victim      = this.currentPlayers.find(p => p.id === data.finalVictim);

        // صفوف المعلومات حسب الدور
        const rows: Array<{ icon: string; label: string; value: string; color: string }> = [];

        if (this.role === "MAFIA") {
            rows.push({ icon: "🔪", label: "Your target",  value: mafiaTarget?.username || "—",  color: "#f87171" });
            rows.push({ icon: "☠",  label: "Outcome",      value: victim ? `${victim.username} eliminated` : "Target was saved!",  color: victim ? "#f87171" : "#4ade80" });
        }
        if (this.role === "DOCTOR") {
            rows.push({ icon: "✚",  label: "You protected", value: doctorSave?.username || "—",   color: "#4ade80" });
            rows.push({ icon: "☠",  label: "Outcome",       value: victim ? `${victim.username} died` : "You saved them! ✓", color: victim ? "#f87171" : "#4ade80" });
        }
        if (this.role === "DETECTIVE") {
            rows.push({ icon: "🔍", label: "Night victim",  value: victim ? victim.username : "Nobody died tonight", color: victim ? "#f87171" : "#4ade80" });
        }

        const panelW = 340;
        const panelH = 64 + rows.length * 46 + 24;
        const c = this.add.container(this.W / 2, this.H / 2 - 50).setDepth(48).setAlpha(0);

        const bg = this.add.rectangle(0, 0, panelW, panelH, 0x08090f);
        bg.setStrokeStyle(2, 0xa855f7); bg.setOrigin(0.5);

        const titleTxt = this.add.text(0, -(panelH / 2) + 22, "🌙  NIGHT RESULTS", {
            fontSize: "13px", color: "#c084fc",
            fontFamily: "'Courier New', monospace", fontStyle: "bold", letterSpacing: 3
        }).setOrigin(0.5);

        c.add([bg, titleTxt]);

        rows.forEach((row, i) => {
            const rowY  = -(panelH / 2) + 58 + i * 46;
            const rowBg = this.add.rectangle(0, rowY, panelW - 24, 36, 0x0d0f18).setOrigin(0.5);
            rowBg.setStrokeStyle(1, 0x1e2d45);
            const iconT = this.add.text(-(panelW / 2) + 28, rowY, row.icon, { fontSize: "17px" }).setOrigin(0.5);
            const lblT  = this.add.text(-(panelW / 2) + 54, rowY - 7, row.label, {
                fontSize: "9px", color: "#64748b",
                fontFamily: "'Courier New', monospace", letterSpacing: 2
            }).setOrigin(0, 0.5);
            const valT  = this.add.text(-(panelW / 2) + 54, rowY + 8, row.value, {
                fontSize: "13px", color: row.color,
                fontFamily: "'Courier New', monospace", fontStyle: "bold"
            }).setOrigin(0, 0.5);
            c.add([rowBg, iconT, lblT, valT]);
        });

        // dismiss label
        const dismissTxt = this.add.text(0, panelH / 2 - 14, "[ TAP TO DISMISS ]", {
            fontSize: "9px", color: "#2d3a4a",
            fontFamily: "'Courier New', monospace", letterSpacing: 2
        }).setOrigin(0.5);
        c.add(dismissTxt);

        this.nightResultOverlay = c;
        this.tweens.add({ targets: c, alpha: 1, duration: 420, ease: "Back.easeOut" });

        const dismiss = () => {
            this.tweens.add({
                targets: c, alpha: 0, y: c.y - 12, duration: 320,
                onComplete: () => {
                    c.destroy();
                    if (this.nightResultOverlay === c) this.nightResultOverlay = undefined;
                }
            });
        };
        this.time.delayedCall(8000, dismiss);
        c.setInteractive(new Phaser.Geom.Rectangle(-panelW / 2, -panelH / 2, panelW, panelH), Phaser.Geom.Rectangle.Contains);
        c.on("pointerdown", dismiss);
    }

    // ══════════════════════════════════════
    //  Chat
    // ══════════════════════════════════════

    // تحديث مؤشر الشات حسب الـ phase
    private updateChatUI(phase: string) {
        const isNight = phase === "NIGHT" || phase === "NIGHT_REVIEW";
        // الشات مفتوح دائماً للكل — بس نوضّح الـ phase بصرياً
        if (this.chatStatusText?.active) {
            if (isNight) {
                this.chatStatusText.setText("● NIGHT");
                this.chatStatusText.setColor("#6366f1");
            } else if (phase === "VOTING") {
                this.chatStatusText.setText("● VOTING");
                this.chatStatusText.setColor("#f59e0b");
            } else {
                this.chatStatusText.setText("● LIVE");
                this.chatStatusText.setColor("#22c55e");
            }
        }
        // الـ input يبقى مفعّل دائماً
        if (this.chatInput) {
            this.chatInput.disabled = false;
            this.chatInput.style.opacity = "1";
        }
        if (this.sendBtn) {
            this.sendBtn.disabled = false;
            this.sendBtn.style.opacity = "1";
        }
    }

    private createChatInput() {
        const chatX = this.PLAYERS_W + this.EVENTS_W;

        this.chatInput = document.createElement("input");
        this.chatInput.id = "game-chat-input";
        this.chatInput.placeholder = "Message...";
        this.chatInput.maxLength = 120;
        Object.assign(this.chatInput.style, {
            position: "absolute", left: `${chatX + 12}px`, bottom: "14px",
            display: this.W < 700 ? "none" : "block",
            width: `${this.CHAT_W - 60}px`, padding: "9px 14px",
            fontSize: "13px", fontFamily: "'Courier New', monospace",
            border: "1px solid #1e2d45", borderRadius: "4px",
            backgroundColor: "#0a0d13", color: "#f1f5f9",
            outline: "none", zIndex: "1000", transition: "border-color 0.2s"
        });
        this.chatInput.addEventListener("focus", () => this.chatInput.style.borderColor = "#3b82f6");
        this.chatInput.addEventListener("blur",  () => this.chatInput.style.borderColor = "#1e2d45");
        document.body.appendChild(this.chatInput);

        this.sendBtn = document.createElement("button");
        this.sendBtn.textContent = "➤";
        Object.assign(this.sendBtn.style, {
            position: "absolute", left: `${chatX + this.CHAT_W - 44}px`, bottom: "14px",
            display: this.W < 700 ? "none" : "block",
            width: "36px", height: "36px", fontSize: "14px",
            border: "1px solid #1e2d45", borderRadius: "4px",
            backgroundColor: "#3b82f6", color: "#fff",
            cursor: "pointer", zIndex: "1000", transition: "background 0.15s"
        });
        this.sendBtn.addEventListener("mouseenter", () => this.sendBtn.style.backgroundColor = "#60a5fa");
        this.sendBtn.addEventListener("mouseleave", () => this.sendBtn.style.backgroundColor = "#3b82f6");

        // BUG FIX #4: send مضمون يشتغل
        const send = () => {
            const msg = this.chatInput.value.trim();
            if (msg.length > 0) {
                socketService.socket.emit("send_message", msg);
                this.chatInput.value = "";
            }
        };
        this.sendBtn.addEventListener("click", send);
        this.chatInput.addEventListener("keypress", e => { if (e.key === "Enter") send(); });
        document.body.appendChild(this.sendBtn);
    }

    // BUG FIX #4: alive قد يكون undefined — معاملته كـ true
    private addChatMessage(username: string, message: string, alive?: boolean) {
        this.addMobileChat(username, message, alive !== false);
        if (this.W < 700) return;
        const chatX  = this.PLAYERS_W + this.EVENTS_W;
        const baseY  = this.TOPBAR_H + 50;
        const lineH  = 22;
        const maxMsg = 15;
        const isAlive = alive !== false; // undefined = alive

        // لون خاص للأدمن والمشاهد
        const isMe = username === this.currentPlayers.find(p => p.id === socketService.socket.id)?.username;
        let msgColor = isAlive ? "#94a3b8" : "#374151";
        if (isMe) msgColor = "#e2e8f0"; // رسائلك أوضح

        this.chatMessages.forEach((t, i) =>
            this.tweens.add({ targets: t, y: baseY + i * lineH, duration: 180 })
        );

        const text = this.add.text(
            chatX + 14,
            baseY + this.chatMessages.length * lineH + lineH,
            `${isAlive ? "" : "☠ "}${username}: ${message}`,
            {
                fontSize: "12px",
                color: msgColor,
                fontFamily: "'Courier New', monospace",
                wordWrap: { width: this.CHAT_W - 28 }
            }
        ).setDepth(3).setAlpha(0);

        this.tweens.add({ targets: text, alpha: 1, y: text.y - lineH, duration: 280, ease: "Back.easeOut" });
        this.chatMessages.push(text);

        if (this.chatMessages.length > maxMsg) {
            const old = this.chatMessages.shift()!;
            this.tweens.add({ targets: old, alpha: 0, duration: 180, onComplete: () => old.destroy() });
        }
    }

    // ══════════════════════════════════════
    //  Event Log
    // ══════════════════════════════════════
    private addEventLog(msg: string, color: string) {
        this.addMobileEvent(msg);
        if (this.W < 700) return;
        const ex    = this.PLAYERS_W + 16;
        const baseY = this.TOPBAR_H + 50;
        const lineH = 26;
        const maxL  = 14;

        this.eventLogItems.forEach((t, i) =>
            this.tweens.add({ targets: t, y: baseY + i * lineH, duration: 180 })
        );

        const text = this.add.text(
            ex,
            baseY + this.eventLogItems.length * lineH + lineH,
            `›  ${msg}`,
            { fontSize: "13px", color, fontFamily: "'Courier New', monospace", wordWrap: { width: this.EVENTS_W - 32 } }
        ).setDepth(3).setAlpha(0);

        this.tweens.add({ targets: text, alpha: 1, y: text.y - lineH, duration: 320, ease: "Back.easeOut" });
        this.eventLogItems.push(text);

        if (this.eventLogItems.length > maxL) {
            const old = this.eventLogItems.shift()!;
            this.tweens.add({ targets: old, alpha: 0, duration: 180, onComplete: () => old.destroy() });
        }
    }

    // ══════════════════════════════════════
    //  Phase Transition
    // ══════════════════════════════════════
    private showPhaseTransition(phase: string) {
        const colorMap: Record<string, string> = {
            NIGHT: "#818cf8", DAY: "#fcd34d", VOTING: "#fbbf24", NIGHT_REVIEW: "#c084fc"
        };
        const color = colorMap[phase] || "#f1f5f9";
        const ov = this.add.text(this.W / 2, this.H / 2, phase, {
            fontSize: "68px", color,
            fontFamily: "'Georgia', serif", fontStyle: "bold",
            letterSpacing: 12, stroke: "#00000088", strokeThickness: 4
        }).setOrigin(0.5).setAlpha(0).setScale(0.7).setDepth(60);
        this.tweens.add({
            targets: ov, alpha: 0.92, scaleX: 1.08, scaleY: 1.08,
            duration: 550, ease: "Back.easeOut",
            onComplete: () => this.tweens.add({
                targets: ov, alpha: 0, scaleX: 1.4, scaleY: 1.4,
                duration: 650, delay: 1100,
                onComplete: () => ov.destroy()
            })
        });
        this.phaseText?.setText(`◉  ${phase}`);
        this.phaseText?.setColor(color);
    }

    // ══════════════════════════════════════
    //  Votes (أشرطة في Event Log)
    // ══════════════════════════════════════
    private updateVotes(votes: Record<string, number>) {
        this.voteEntries.forEach(obj => { if ((obj as any).destroy) (obj as any).destroy(); });
        this.voteEntries = [];
        this.voteTitle?.destroy(); this.voteTitle = undefined;
        if (Object.keys(votes).length === 0) return;

        const baseX = this.PLAYERS_W + 16;
        let   baseY = this.TOPBAR_H + this.CONTENT_H - 180;

        this.voteTitle = this.add.text(baseX, baseY, "VOTES", {
            fontSize: "10px", color: "#f59e0b",
            fontFamily: "'Courier New', monospace", letterSpacing: 3
        }).setDepth(4);
        baseY += 20;

        for (const id in votes) {
            const p     = this.currentPlayers.find(pl => pl.id === id);
            const uname = p ? p.username : id.substring(0, 6);
            const count = votes[id];
            const barW  = Math.min(count * 22, this.EVENTS_W - 130);
            const bgBar = this.add.rectangle(baseX, baseY + 8, this.EVENTS_W - 64, 15, 0x111827).setOrigin(0, 0.5).setDepth(3);
            const bar   = this.add.rectangle(baseX, baseY + 8, 2, 15, 0xf59e0b, 0.45).setOrigin(0, 0.5).setDepth(4);
            bar.setStrokeStyle(1, 0xf59e0b, 0.55);
            const lbl   = this.add.text(baseX + 8, baseY + 8, `${uname}  ×${count}`, {
                fontSize: "11px", color: "#fbbf24", fontFamily: "'Courier New', monospace"
            }).setOrigin(0, 0.5).setDepth(5);
            this.tweens.add({ targets: bar, width: barW, duration: 400, ease: "Cubic.easeOut" });
            this.voteEntries.push(bgBar, bar, lbl);
            baseY += 24;
        }

        // تحديث البطاقات في الـ Overlay أيضاً
        this.updateVotingCards(votes);
    }

    // ══════════════════════════════════════
    //  Detective Result
    // ══════════════════════════════════════
    private showDetectiveResult(data: any) {
        this.detectiveResult?.destroy();
        const isMafia = data.role === "MAFIA";
        const color   = isMafia ? this.C.mafia : this.C.alive;
        const hex     = isMafia ? "#f87171" : "#4ade80";
        const c = this.add.container(this.W / 2, this.H / 2 - 40).setDepth(45).setAlpha(0);
        const bg = this.add.rectangle(0, 0, 360, 88, isMafia ? 0x1a0505 : 0x051a0a);
        bg.setStrokeStyle(2, color);
        const title = this.add.text(0, -15, isMafia ? "⚠  MAFIA CONFIRMED" : "✓  INNOCENT CITIZEN", {
            fontSize: "22px", color: hex,
            fontFamily: "'Courier New', monospace", fontStyle: "bold", letterSpacing: 4
        }).setOrigin(0.5);
        const sub = this.add.text(0, 18, data.username, {
            fontSize: "13px", color: "#94a3b8",
            fontFamily: "'Courier New', monospace", letterSpacing: 2
        }).setOrigin(0.5);
        c.add([bg, title, sub]);
        this.detectiveResult = c;
        this.tweens.add({ targets: c, alpha: 1, duration: 400, ease: "Back.easeOut" });
        this.time.delayedCall(6000, () =>
            this.tweens.add({
                targets: c, alpha: 0, duration: 400,
                onComplete: () => { c.destroy(); if (this.detectiveResult === c) this.detectiveResult = undefined; }
            })
        );
    }

    // ══════════════════════════════════════
    //  Win Overlay
    // ══════════════════════════════════════
    private showWinOverlay(data: any) {
        this.winOverlay?.destroy();
        const isMafia = data.winner === "MAFIA";
        const color   = isMafia ? this.C.mafia : this.C.alive;
        const hex     = isMafia ? "#f87171" : "#4ade80";
        const c = this.add.container(this.W / 2, this.H / 2).setDepth(100).setAlpha(0);
        const dimBg = this.add.rectangle(0, 0, this.W, this.H, 0x000000, 0.75).setOrigin(0.5);
        const panel = this.add.rectangle(0, 0, 500, 320, isMafia ? 0x0f0505 : 0x050f05);
        panel.setStrokeStyle(2, color);
        const titleText = this.add.text(0, -100,
            `${isMafia ? "🔪" : "👑"}  ${isMafia ? "MAFIA WINS" : "CITIZENS WIN"}  ${isMafia ? "🔪" : "👑"}`,
            { fontSize: "38px", color: hex, fontFamily: "'Georgia', serif", fontStyle: "bold", letterSpacing: 6 }
        ).setOrigin(0.5);
        const rolesStr = data.roles
            ? data.roles.map((r: any) => `${r.username}  →  ${r.role}`).join("\n")
            : "";
        const rolesText = this.add.text(0, 30, rolesStr, {
            fontSize: "14px", color: "#94a3b8",
            fontFamily: "'Courier New', monospace", align: "center", lineSpacing: 8
        }).setOrigin(0.5);
        c.add([dimBg, panel, titleText, rolesText]);
        this.winOverlay = c;
        this.cameras.main.flash(500, isMafia ? 100 : 0, isMafia ? 0 : 60, 0);
        this.tweens.add({ targets: c, alpha: 1, duration: 600 });
        this.tweens.add({ targets: titleText, scaleX: 1.05, scaleY: 1.05, duration: 900, yoyo: true, repeat: -1 });
    }

    // ══════════════════════════════════════
    //  Admin Drawer
    // ══════════════════════════════════════
    private createAdminToggleBtn() {
        this.adminToggleBtn = document.createElement("button");
        this.adminToggleBtn.id = "admin-toggle-btn";
        this.adminToggleBtn.innerHTML = "⚙  CONTROL PANEL";
        Object.assign(this.adminToggleBtn.style, {
            position: "absolute", right: "16px", top: "10px",
            padding: "8px 20px", fontSize: "12px",
            fontFamily: "'Courier New', monospace",
            fontWeight: "bold", letterSpacing: "2px",
            color: "#f59e0b", backgroundColor: "#0d0f14",
            border: "1px solid #f59e0b", borderRadius: "4px",
            cursor: "pointer", zIndex: "2000", transition: "all 0.2s", userSelect: "none",
        });
        this.adminToggleBtn.addEventListener("mouseenter", () => {
            this.adminToggleBtn!.style.backgroundColor = "#1a1400";
            this.adminToggleBtn!.style.boxShadow = "0 0 14px rgba(245,158,11,0.3)";
        });
        this.adminToggleBtn.addEventListener("mouseleave", () => {
            this.adminToggleBtn!.style.backgroundColor = "#0d0f14";
            this.adminToggleBtn!.style.boxShadow = "none";
        });
        this.adminToggleBtn.addEventListener("click", () => this.toggleAdminDrawer());
        document.body.appendChild(this.adminToggleBtn);
    }

    private createAdminDrawer() {
        const drawer = document.createElement("div");
        drawer.id = "admin-drawer";
        Object.assign(drawer.style, {
            position: "fixed", top: "0", right: "-520px",
            width: "500px", height: "100vh",
            backgroundColor: "#080c12",
            borderLeft: "1px solid rgba(245,158,11,0.25)",
            boxShadow: "-8px 0 40px rgba(0,0,0,0.6)",
            zIndex: "1500", overflowY: "auto",
            transition: "right 0.35s cubic-bezier(0.4,0,0.2,1)",
            fontFamily: "'Courier New', monospace",
            display: "flex", flexDirection: "column",
        });
        drawer.innerHTML = `
        <style>
            #admin-drawer::-webkit-scrollbar{width:4px}
            #admin-drawer::-webkit-scrollbar-track{background:#080c12}
            #admin-drawer::-webkit-scrollbar-thumb{background:#1e2d45;border-radius:2px}
            .adr-header{padding:20px 24px 18px;border-bottom:1px solid rgba(30,45,69,0.6);display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:#080c12;z-index:10}
            .adr-title{font-size:13px;color:#f59e0b;letter-spacing:3px;font-weight:bold}
            .adr-subtitle{font-size:10px;color:#334155;letter-spacing:1px;margin-top:4px}
            .adr-close{background:transparent;border:1px solid #1e2d45;color:#64748b;width:32px;height:32px;border-radius:4px;font-size:14px;cursor:pointer;transition:all 0.15s;display:flex;align-items:center;justify-content:center}
            .adr-close:hover{border-color:#ef4444;color:#ef4444}
            .adr-section{padding:20px 24px 18px;border-bottom:1px solid rgba(30,45,69,0.4)}
            .adr-section-title{font-size:9px;color:#3b82f6;letter-spacing:3px;font-weight:bold;margin-bottom:14px;text-transform:uppercase}
            .adr-phase-badge{display:flex;align-items:center;gap:12px;background:#0f1520;border:1px solid #1e2d45;border-radius:6px;padding:12px 18px}
            .adr-phase-dot{width:12px;height:12px;border-radius:50%;background:#64748b;flex-shrink:0;transition:all 0.3s}
            .adr-phase-label{font-size:16px;font-weight:bold;color:#64748b;letter-spacing:3px;transition:color 0.3s}
            .adr-btn-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
            .adr-btn{padding:14px 10px;border-radius:5px;border:1px solid;background:transparent;font-family:'Courier New',monospace;font-size:11px;font-weight:bold;letter-spacing:1px;cursor:pointer;transition:all 0.15s;text-align:center;line-height:1.4}
            .adr-btn:hover{filter:brightness(1.25);transform:translateY(-1px);box-shadow:0 4px 14px rgba(0,0,0,0.5)}
            .adr-btn:active{transform:scale(0.97)}
            .adr-btn-night{color:#818cf8;border-color:#6366f1}.adr-btn-night:hover{background:rgba(99,102,241,0.08)}
            .adr-btn-day{color:#fcd34d;border-color:#fbbf24}.adr-btn-day:hover{background:rgba(251,191,36,0.08)}
            .adr-btn-vote{color:#fbbf24;border-color:#f59e0b}.adr-btn-vote:hover{background:rgba(245,158,11,0.08)}
            .adr-btn-stopvote{color:#94a3b8;border-color:#4b5563}.adr-btn-stopvote:hover{background:rgba(75,85,99,0.12)}
            .adr-btn-danger{color:#f87171;border-color:#ef4444;grid-column:1/-1}.adr-btn-danger:hover{background:rgba(239,68,68,0.08)}
            .adr-btn-restart{color:#60a5fa;border-color:#3b82f6;grid-column:1/-1}.adr-btn-restart:hover{background:rgba(59,130,246,0.08)}
            .nr-grid{display:grid;grid-template-columns:auto 1fr;gap:0;background:#0a0e14;border:1px solid #1e2d45;border-radius:6px;overflow:hidden}
            .nr-cell{padding:12px 16px;font-size:12px;letter-spacing:1px;border-bottom:1px solid rgba(30,45,69,0.4)}
            .nr-cell:nth-last-child(-n+2){border-bottom:none}
            .nr-label{color:#64748b;white-space:nowrap}
            .nr-value{font-weight:bold}
            .adr-story-textarea{width:100%;box-sizing:border-box;min-height:120px;background:#0a0e14;color:#e2e8f0;border:1px solid #1e2d45;border-radius:5px;padding:14px 16px;font-family:'Courier New',monospace;font-size:13px;line-height:1.7;resize:vertical;outline:none;transition:border-color 0.2s}
            .adr-story-textarea:focus{border-color:#a855f7;box-shadow:0 0 0 3px rgba(168,85,247,0.1)}
            .adr-story-textarea::placeholder{color:#1e3045}
            .adr-reveal-btn{width:100%;margin-top:12px;padding:14px;background:transparent;color:#c084fc;border:1px solid #a855f7;border-radius:5px;font-family:'Courier New',monospace;font-size:13px;font-weight:bold;letter-spacing:2px;cursor:pointer;transition:all 0.2s}
            .adr-reveal-btn:hover{background:rgba(168,85,247,0.08);box-shadow:0 0 18px rgba(168,85,247,0.25)}
        </style>
        <div class="adr-header">
            <div><div class="adr-title">👑  ADMIN  CONTROL  PANEL</div><div class="adr-subtitle">Full game control &amp; management</div></div>
            <button class="adr-close" id="adr-close-btn">✕</button>
        </div>
        <div class="adr-section">
            <div class="adr-section-title">Current Phase</div>
            <div class="adr-phase-badge">
                <div class="adr-phase-dot" id="adr-phase-dot"></div>
                <span class="adr-phase-label" id="adr-phase-label">WAITING</span>
            </div>
        </div>
        <div class="adr-section">
            <div class="adr-section-title">Phase Controls</div>
            <div class="adr-btn-grid">
                <button class="adr-btn adr-btn-night"    data-event="admin_start_night">🌙  START NIGHT</button>
                <button class="adr-btn adr-btn-day"      data-event="admin_end_night">☀  END NIGHT</button>
                <button class="adr-btn adr-btn-vote"     data-event="admin_start_voting">🗳  START VOTING</button>
                <button class="adr-btn adr-btn-stopvote" data-event="admin_end_voting">⏹  END VOTING</button>
            </div>
        </div>
        <div class="adr-section">
            <div class="adr-section-title">Danger Zone</div>
            <div class="adr-btn-grid">
                <button class="adr-btn adr-btn-danger"  data-event="admin_end_game">⚡  FORCE END GAME</button>
                <button class="adr-btn adr-btn-restart" data-event="restart_game">🔄  RESTART GAME</button>
            </div>
        </div>
        <div class="adr-section" id="adr-night-section" style="display:none">
            <div class="adr-section-title" style="color:#a855f7">🌙  Night Results</div>
            <div class="nr-grid" id="adr-night-grid"></div>
        </div>
        <div class="adr-section" id="adr-story-section" style="display:none">
            <div class="adr-section-title" style="color:#a855f7">📖  Tonight's Story</div>
            <textarea class="adr-story-textarea" id="adr-story-input"
                placeholder="Write what happened tonight...&#10;The citizens will read your words when you reveal."></textarea>
            <button class="adr-reveal-btn" id="adr-reveal-btn">📢  REVEAL STORY TO ALL PLAYERS</button>
        </div>`;

        document.body.appendChild(drawer);
        this.adminDrawer = drawer;

        drawer.querySelectorAll<HTMLButtonElement>(".adr-btn[data-event]").forEach(btn => {
            btn.addEventListener("click", () => {
                socketService.socket.emit(btn.dataset.event!);
                btn.style.opacity = "0.6";
                setTimeout(() => { btn.style.opacity = "1"; }, 220);
            });
        });
        drawer.querySelector("#adr-close-btn")?.addEventListener("click", () => this.closeAdminDrawer());
        drawer.querySelector("#adr-reveal-btn")?.addEventListener("click", () => {
            const ta    = drawer.querySelector<HTMLTextAreaElement>("#adr-story-input");
            const story = ta?.value.trim() || "The night passed in silence...";
            socketService.socket.emit("admin_reveal_night_results", story);
            const ns = drawer.querySelector<HTMLElement>("#adr-night-section");
            const ss = drawer.querySelector<HTMLElement>("#adr-story-section");
            if (ns) ns.style.display = "none";
            if (ss) ss.style.display = "none";
        });
        this.outsideClickHandler = (e: MouseEvent) => {
            if (!this.adminDrawerOpen) return;
            const t = e.target as HTMLElement;
            if (this.adminDrawer?.contains(t) || this.adminToggleBtn?.contains(t)) return;
            this.closeAdminDrawer();
        };
        document.addEventListener("click", this.outsideClickHandler);
    }

    private toggleAdminDrawer() {
        this.adminDrawerOpen = !this.adminDrawerOpen;
        if (this.adminDrawer) this.adminDrawer.style.right = this.adminDrawerOpen ? "0" : "-520px";
        if (this.adminToggleBtn) {
            this.adminToggleBtn.innerHTML     = this.adminDrawerOpen ? "✕  CLOSE PANEL" : "⚙  CONTROL PANEL";
            this.adminToggleBtn.style.color       = this.adminDrawerOpen ? "#ef4444" : "#f59e0b";
            this.adminToggleBtn.style.borderColor = this.adminDrawerOpen ? "#ef4444" : "#f59e0b";
        }
    }

    private closeAdminDrawer() {
        this.adminDrawerOpen = false;
        if (this.adminDrawer) this.adminDrawer.style.right = "-520px";
        if (this.adminToggleBtn) {
            this.adminToggleBtn.innerHTML         = "⚙  CONTROL PANEL";
            this.adminToggleBtn.style.color       = "#f59e0b";
            this.adminToggleBtn.style.borderColor = "#f59e0b";
        }
    }

    private updateAdminDrawerPhase(phase: string) {
        if (!this.isAdmin || !this.adminDrawer) return;
        const colorMap: Record<string, string> = {
            NIGHT: "#818cf8", DAY: "#fcd34d", VOTING: "#fbbf24",
            NIGHT_REVIEW: "#c084fc", WAITING: "#64748b", GAME_OVER: "#f87171"
        };
        const color = colorMap[phase] || "#64748b";
        const dot   = this.adminDrawer.querySelector<HTMLElement>("#adr-phase-dot");
        const label = this.adminDrawer.querySelector<HTMLElement>("#adr-phase-label");
        if (dot)   { dot.style.background = color; dot.style.boxShadow = `0 0 10px ${color}88`; }
        if (label) { label.style.color = color; label.textContent = phase; }
    }

    private showNightReviewInDrawer(data: any) {
        if (!this.isAdmin || !this.adminDrawer) return;
        const mafiaTarget = this.currentPlayers.find(p => p.id === data.mafiaTarget);
        const doctorSave  = this.currentPlayers.find(p => p.id === data.doctorSave);
        const victim      = this.currentPlayers.find(p => p.id === data.finalVictim);
        const grid = this.adminDrawer.querySelector<HTMLElement>("#adr-night-grid");
        if (grid) {
            grid.innerHTML = `
                <span class="nr-cell nr-label">🔪  Mafia Target</span>
                <span class="nr-cell nr-value" style="color:#f87171">${mafiaTarget?.username || "—"}</span>
                <span class="nr-cell nr-label">✚  Doctor Saved</span>
                <span class="nr-cell nr-value" style="color:#4ade80">${doctorSave?.username || "—"}</span>
                <span class="nr-cell nr-label">☠  Final Victim</span>
                <span class="nr-cell nr-value" style="color:${victim ? "#f87171" : "#4ade80"}">${victim ? victim.username : "Protected ✓"}</span>`;
        }
        const ns = this.adminDrawer.querySelector<HTMLElement>("#adr-night-section");
        const ss = this.adminDrawer.querySelector<HTMLElement>("#adr-story-section");
        const ta = this.adminDrawer.querySelector<HTMLTextAreaElement>("#adr-story-input");
        if (ns) ns.style.display = "block";
        if (ss) ss.style.display = "block";
        if (ta) ta.value = "";
        if (!this.adminDrawerOpen) this.toggleAdminDrawer();
        this.updateAdminDrawerPhase("NIGHT_REVIEW");
    }

    // ══════════════════════════════════════
    //  Socket Listeners
    // ══════════════════════════════════════
    private setupSocketListeners() {
        const evts = [
            "room_state", "phase_changed", "game_over", "game_started",
            "vote_update", "player_killed", "receive_message",
            "detective_result", "voting_result", "voting_started",
            "night_review", "night_story", "back_to_lobby"
        ];
        evts.forEach(e => socketService.socket.off(e));

        socketService.socket.on("room_state", (data: any) => {
            this.roundText?.setText(`ROUND ${data.round}`);
            const colorMap: Record<string, string> = {
                NIGHT: "#818cf8", DAY: "#fcd34d", VOTING: "#fbbf24",
                NIGHT_REVIEW: "#c084fc", WAITING: "#64748b"
            };
            this.phaseText?.setText(`◉  ${data.phase}`);
            this.phaseText?.setColor(colorMap[data.phase] || "#64748b");
            this.drawPlayers(data.players, data.phase);
            this.updateAdminDrawerPhase(data.phase);
            this.updateChatUI(data.phase);

            // ✅ FIX: لو room_state وصل وـ phase=NIGHT
            // ننقل لـ NightScene مباشرة (حالة: phase_changed فاتنا لأننا كنا في restart)
            if (data.phase === "NIGHT" && !this.isAdmin && !this.isNightSceneActive) {
                const nightSceneMap: Record<string, string> = {
                    MAFIA:     "MafiaNightScene",
                    DOCTOR:    "DoctorNightScene",
                    DETECTIVE: "DetectiveNightScene",
                };
                const targetScene = nightSceneMap[this.role];
                if (targetScene) {
                    this.isNightSceneActive = true;
                    this.cameras.main.fadeOut(500, 10, 13, 19);
                    this.time.delayedCall(500, () => {
                        this.scene.start(targetScene, {
                            roomId:  this.roomId,
                            players: data.players
                        });
                    });
                    return;
                }
            }
        });

        socketService.socket.on("phase_changed", (data: any) => {
            // فقط الأدوار اللي عندها NightScene تنتقل
            // CITIZEN يبقى في GameScene ولا يروح لأي مشهد ليلي
            const nightSceneMap: Record<string, string> = {
                MAFIA:     "MafiaNightScene",
                DOCTOR:    "DoctorNightScene",
                DETECTIVE: "DetectiveNightScene",
            };

            if (data.phase === "NIGHT" && !this.isAdmin) {
                const targetScene = nightSceneMap[this.role];
                if (targetScene) {
                    // دور عنده مشهد ليلي — ينتقل إليه
                    if (this.isNightSceneActive) return;
                    this.isNightSceneActive = true;
                    this.cameras.main.fadeOut(500, 10, 13, 19);
                    this.time.delayedCall(500, () => {
                        this.scene.start(targetScene, {
                            roomId: this.roomId,
                            players: this.currentPlayers
                        });
                    });
                    return;
                }
                // CITIZEN / SPECTATOR — يبقى هنا، فقط يُظهر الـ transition
            }

            if (data.phase !== "NIGHT") this.isNightSceneActive = false;
            this.showPhaseTransition(data.phase);
            this.roundText?.setText(`ROUND ${data.round}`);
            if (data.phase !== "NIGHT") this.actionUsed = false;
            this.updateAdminDrawerPhase(data.phase);
            this.updateChatUI(data.phase); // تحديث مؤشر الشات
            socketService.socket.emit("request_room_state");
        });

        socketService.socket.on("voting_started", () => {
            this.showPhaseTransition("VOTING");
            socketService.socket.emit("request_room_state");
            // فقط اللاعبين الأحياء يشوفون الـ overlay — الأدمن والمشاهد لا
            const myPlayer = this.currentPlayers.find(p => p.id === socketService.socket.id);
            const isAlivePlayer = myPlayer?.alive && this.userType === "PLAYER" && !this.isAdmin;
            if (isAlivePlayer) {
                if (this.W < 700) {
                    this.time.delayedCall(300, () => this.showMobileVoting());
                } else {
                    this.time.delayedCall(300, () => this.showVotingOverlay());
                }
            }
        });

        socketService.socket.on("vote_update", (v: any) => {
            this.updateVotes(v);
            this.updateMobileVotes(v);
        });

        socketService.socket.on("voting_result", (data: any) => {
            this.closeMobileVoting();
            const msg = data.tie
                ? "TIE — no one eliminated"
                : `${data.eliminated} was eliminated by vote`;
            this.addEventLog(msg, data.tie ? "#fbbf24" : "#f87171");
            this.cameras.main.shake(data.tie ? 150 : 350, 0.006);
            // يغلق الـ overlay للاعبين (لو ما كان مفتوحاً ما يصير شي)
            this.closeVotingOverlay(true, { eliminated: data.eliminated, tie: data.tie });
        });

        socketService.socket.on("player_killed", (data: any) => {
            this.addEventLog(`${data.username} was killed in the night`, "#f87171");
            this.cameras.main.shake(250, 0.006);
        });

        socketService.socket.on("detective_result", (data: any) => this.showDetectiveResult(data));

        // BUG FIX #4: receive_message مع alive optional
        socketService.socket.on("receive_message", (data: any) => {
            this.addChatMessage(data.username, data.message, data.alive);
        });

        // BUG FIX #3: night_review للأدمن (drawer) + للمافيا/دكتور/محقق (overlay)
        socketService.socket.on("night_review", (data: any) => {
            this.showNightReviewInDrawer(data);   // للأدمن فقط
            this.showNightResultOverlay(data);     // للمافيا/دكتور/محقق فقط
        });

        socketService.socket.on("night_story", (data: any) => {
            this.addEventLog(`📖  ${data.story}`, "#c084fc");
        });

        socketService.socket.on("game_over", (data: any) => this.showWinOverlay(data));

        // back_to_lobby — يُخفي winOverlay ويجهّز الـ scene للـ restart
        socketService.socket.on("back_to_lobby", () => {
            // إخفاء win overlay فوراً
            if (this.winOverlay) {
                this.winOverlay.destroy();
                this.winOverlay = undefined;
            }
            // رسالة انتظار في الـ event log
            this.addEventLog("⟳  New game starting...", "#3b82f6");
        });

        socketService.socket.on("game_started", (data: any) => {
            // حدّد userType من data.role
            let newUserType = "PLAYER";
            if (data.role === "ADMIN")          { newUserType = "ADMIN"; socketService.isAdmin = true; }
            else if (data.role === "SPECTATOR") { newUserType = "SPECTATOR"; }

            // ✅ FIX: restart فوري بدون delay — عشان ما نضيع الـ phase_changed=NIGHT
            this.scene.start("GameScene", {
                role:     data.role,
                roomId:   data.roomId,
                userType: newUserType
            });
        });
    }

    // ══════════════════════════════════════
    //  Cleanup
    // ══════════════════════════════════════
    private cleanupHTML() {
        this.cleanupMobileTabs();
        document.getElementById("lobby-username")?.remove();
        document.getElementById("admin-toggle-btn")?.remove();
        document.getElementById("admin-drawer")?.remove();
        if (this.outsideClickHandler) document.removeEventListener("click", this.outsideClickHandler);
        this.chatInput?.remove();
        this.sendBtn?.remove();
    }

    shutdown() {
        this.cleanupHTML();
        this.votingOverlayContainer?.destroy();
        this.nightResultOverlay?.destroy();
        const evts = [
            "room_state", "phase_changed", "game_over", "game_started",
            "vote_update", "player_killed", "receive_message",
            "detective_result", "voting_result", "voting_started",
            "night_review", "night_story", "back_to_lobby"
        ];
        evts.forEach(e => socketService.socket.off(e));
        this.tweens.killAll();
    }
    // ══════════════════════════════════════
    //  MOBILE TABS (HTML overlay)
    // ══════════════════════════════════════
    private mobileTabs?: HTMLDivElement;
    private mobileActiveTab: string = "events";

    private createMobileTabs() {
        if (this.W >= 700) return;

        const TOPBAR = this.TOPBAR_H;
        const container = document.createElement("div");
        container.id = "mobile-game-ui";
        Object.assign(container.style, {
            position: "fixed",
            top: `${TOPBAR}px`, left: "0", right: "0", bottom: "0",
            zIndex: "500",
            display: "flex", flexDirection: "column",
            backgroundColor: "#0a0d13",
        });
        document.body.appendChild(container);
        this.mobileTabs = container;

        // ── Tab Buttons ──
        const tabBar = document.createElement("div");
        Object.assign(tabBar.style, {
            display: "flex", borderBottom: "1px solid #1e2d45",
            backgroundColor: "#111827", flexShrink: "0",
        });

        const tabs = [
            { id: "players", label: "👥 PLAYERS" },
            { id: "events",  label: "📋 EVENTS"  },
            { id: "chat",    label: "💬 CHAT"    },
        ];

        tabs.forEach(tab => {
            const btn = document.createElement("button");
            btn.id = `tab-btn-${tab.id}`;
            btn.textContent = tab.label;
            Object.assign(btn.style, {
                flex: "1", padding: "10px 4px",
                fontSize: "11px", fontFamily: "'Courier New', monospace",
                fontWeight: "bold", letterSpacing: "1px",
                border: "none", cursor: "pointer",
                color: tab.id === "events" ? "#3b82f6" : "#4b5563",
                backgroundColor: tab.id === "events" ? "#0a0d13" : "transparent",
                borderBottom: tab.id === "events" ? "2px solid #3b82f6" : "2px solid transparent",
                transition: "all 0.2s",
            });
            btn.onclick = () => this.switchMobileTab(tab.id);
            tabBar.appendChild(btn);
        });
        container.appendChild(tabBar);

        // ── Tab Contents ──
        const makePanel = (id: string) => {
            const p = document.createElement("div");
            p.id = `tab-panel-${id}`;
            Object.assign(p.style, {
                flex: "1", overflowY: "auto", padding: "10px",
                display: id === "events" ? "flex" : "none",
                flexDirection: "column", gap: "4px",
                fontFamily: "'Courier New', monospace", fontSize: "12px",
                color: "#94a3b8",
            });
            container.appendChild(p);
            return p;
        };

        makePanel("players");
        makePanel("events");

        // Chat panel with input
        const chatPanel = document.createElement("div");
        chatPanel.id = "tab-panel-chat";
        Object.assign(chatPanel.style, {
            flex: "1", display: "none", flexDirection: "column",
        });

        const chatMessages = document.createElement("div");
        chatMessages.id = "mobile-chat-messages";
        Object.assign(chatMessages.style, {
            flex: "1", overflowY: "auto", padding: "10px",
            fontFamily: "'Courier New', monospace", fontSize: "12px",
            color: "#94a3b8", display: "flex", flexDirection: "column", gap: "4px",
        });
        chatPanel.appendChild(chatMessages);

        const chatInputRow = document.createElement("div");
        Object.assign(chatInputRow.style, {
            display: "flex", padding: "8px", gap: "8px",
            borderTop: "1px solid #1e2d45", backgroundColor: "#111827",
        });

        const mobileInput = document.createElement("input");
        mobileInput.placeholder = "Message...";
        mobileInput.maxLength = 120;
        mobileInput.id = "mobile-chat-input";
        Object.assign(mobileInput.style, {
            flex: "1", padding: "8px 12px",
            backgroundColor: "#0a0d13", color: "#f1f5f9",
            border: "1px solid #1e2d45", borderRadius: "4px",
            fontFamily: "'Courier New', monospace", fontSize: "13px",
            outline: "none",
        });
        const doSend = () => {
            const msg = mobileInput.value.trim();
            if (msg) {
                socketService.socket.emit("send_message", { message: msg });
                mobileInput.value = "";
            }
        };
        mobileInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") doSend();
        });

        const mobileSendBtn = document.createElement("button");
        mobileSendBtn.textContent = "➤";
        Object.assign(mobileSendBtn.style, {
            padding: "8px 14px", backgroundColor: "#3b82f6", color: "#fff",
            border: "none", borderRadius: "4px", fontSize: "14px", cursor: "pointer",
        });
        mobileSendBtn.onclick = () => doSend();

        chatInputRow.appendChild(mobileInput);
        chatInputRow.appendChild(mobileSendBtn);
        chatPanel.appendChild(chatInputRow);
        container.appendChild(chatPanel);
    }

    private switchMobileTab(tabId: string) {
        if (!this.mobileTabs) return;
        this.mobileActiveTab = tabId;
        ["players", "events", "chat"].forEach(id => {
            const panel = document.getElementById(`tab-panel-${id}`);
            const btn   = document.getElementById(`tab-btn-${id}`) as HTMLButtonElement;
            if (!panel || !btn) return;
            const active = id === tabId;
            panel.style.display = active ? "flex" : "none";
            btn.style.color = active ? "#3b82f6" : "#4b5563";
            btn.style.backgroundColor = active ? "#0a0d13" : "transparent";
            btn.style.borderBottom = active ? "2px solid #3b82f6" : "2px solid transparent";
        });
    }

    private updateMobilePlayers(players: any[]) {
        if (this.W >= 700) return;
        const panel = document.getElementById("tab-panel-players");
        if (!panel) return;
        panel.innerHTML = "";
        players.forEach(p => {
            const row = document.createElement("div");
            const isMe = p.id === socketService.socket.id;
            Object.assign(row.style, {
                display: "flex", alignItems: "center", gap: "8px",
                padding: "8px 10px", borderRadius: "4px",
                backgroundColor: isMe ? "rgba(59,130,246,0.1)" : "rgba(17,24,39,0.6)",
                border: isMe ? "1px solid rgba(59,130,246,0.3)" : "1px solid transparent",
                marginBottom: "4px",
            });
            const dot = document.createElement("span");
            dot.textContent = p.alive ? "●" : "○";
            dot.style.color = p.alive ? "#22c55e" : "#374151";
            dot.style.fontSize = "10px";

            const name = document.createElement("span");
            name.textContent = p.username + (isMe ? " [YOU]" : "");
            Object.assign(name.style, {
                fontFamily: "'Courier New', monospace", fontSize: "13px",
                color: p.alive ? (isMe ? "#f1f5f9" : "#94a3b8") : "#374151",
                flex: "1",
            });

            const role = document.createElement("span");
            role.textContent = p.role && p.alive ? `[${p.role}]` : "";
            Object.assign(role.style, {
                fontSize: "10px", color: "#4b5563",
                fontFamily: "'Courier New', monospace",
            });

            row.appendChild(dot);
            row.appendChild(name);
            row.appendChild(role);
            panel.appendChild(row);
        });
    }

    private addMobileEvent(msg: string) {
        if (this.W >= 700) return;
        const panel = document.getElementById("tab-panel-events");
        if (!panel) return;
        const el = document.createElement("div");
        el.textContent = `› ${msg}`;
        Object.assign(el.style, {
            padding: "6px 8px", borderLeft: "2px solid #1e2d45",
            marginBottom: "2px", opacity: "0",
            transition: "opacity 0.3s", fontSize: "12px",
            fontFamily: "'Courier New', monospace", color: "#94a3b8",
        });
        panel.appendChild(el);
        requestAnimationFrame(() => { el.style.opacity = "1"; });
        panel.scrollTop = panel.scrollHeight;
        // أضف badge على الـ tab إذا مش مفتوح
        if (this.mobileActiveTab !== "events") {
            const btn = document.getElementById("tab-btn-events");
            if (btn && !btn.textContent?.includes("●")) {
                btn.textContent = "● EVENTS";
                btn.style.color = "#f59e0b";
            }
        }
    }

    private addMobileChat(username: string, message: string, alive: boolean) {
        if (this.W >= 700) return;
        const msgs = document.getElementById("mobile-chat-messages");
        if (!msgs) return;
        const el = document.createElement("div");
        const isMe = false; // username comparison not needed here
        el.innerHTML = `<span style="color:${alive ? "#3b82f6" : "#4b5563"}">${username}:</span> ${message}`;
        Object.assign(el.style, {
            padding: "4px 8px", borderRadius: "3px",
            backgroundColor: "rgba(17,24,39,0.4)",
            fontFamily: "'Courier New', monospace", fontSize: "12px",
            color: alive ? "#cbd5e1" : "#4b5563",
        });
        msgs.appendChild(el);
        msgs.scrollTop = msgs.scrollHeight;
        while (msgs.children.length > 30) msgs.removeChild(msgs.firstChild!);
        // badge على chat tab
        if (this.mobileActiveTab !== "chat") {
            const btn = document.getElementById("tab-btn-chat");
            if (btn && !btn.textContent?.includes("●")) {
                btn.textContent = "● CHAT";
                btn.style.color = "#22c55e";
            }
        }
    }

    private cleanupMobileTabs() {
        document.getElementById("mobile-game-ui")?.remove();
    }


    // ══════════════════════════════════════
    //  MOBILE VOTING OVERLAY (HTML)
    // ══════════════════════════════════════
    private mobileVotingEl?: HTMLDivElement;

    private showMobileVoting() {
        this.closeMobileVoting();
        this.myVote = null;

        const alivePlayers = this.currentPlayers.filter(p => p.alive);
        if (alivePlayers.length === 0) return;

        const myPlayer = this.currentPlayers.find(p => p.id === socketService.socket.id);
        const isMe = (p: any) => p.id === socketService.socket.id;

        const overlay = document.createElement("div");
        overlay.id = "mobile-voting-overlay";
        Object.assign(overlay.style, {
            position: "fixed", top: "0", left: "0", right: "0", bottom: "0",
            zIndex: "2000", backgroundColor: "rgba(0,0,0,0.92)",
            display: "flex", flexDirection: "column", alignItems: "center",
            overflowY: "auto", padding: "20px 12px",
        });

        // العنوان
        const title = document.createElement("div");
        title.textContent = "VOTE TO ELIMINATE";
        Object.assign(title.style, {
            color: "#f1f5f9", fontSize: "20px",
            fontFamily: "'Georgia', serif", fontWeight: "bold",
            letterSpacing: "4px", marginBottom: "6px", textAlign: "center",
        });
        const sub = document.createElement("div");
        sub.textContent = "Choose who threatens the community";
        Object.assign(sub.style, {
            color: "#64748b", fontSize: "11px",
            fontFamily: "'Courier New', monospace",
            letterSpacing: "2px", marginBottom: "20px",
        });
        overlay.appendChild(title);
        overlay.appendChild(sub);

        // Grid اللاعبين
        const grid = document.createElement("div");
        Object.assign(grid.style, {
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "12px", width: "100%", maxWidth: "420px",
        });

        alivePlayers.forEach(p => {
            const card = document.createElement("div");
            card.id = `mvote-card-${p.id}`;
            const isMePlayer = isMe(p);
            Object.assign(card.style, {
                backgroundColor: "#111827",
                border: "1px solid #1e2d45",
                borderRadius: "8px", padding: "16px 10px",
                display: "flex", flexDirection: "column",
                alignItems: "center", gap: "8px",
                cursor: isMePlayer ? "default" : "pointer",
                transition: "border-color 0.2s, background 0.2s",
                opacity: isMePlayer ? "0.5" : "1",
            });

            const avatar = document.createElement("div");
            avatar.textContent = isMePlayer ? "😐" : "👤";
            avatar.style.fontSize = "32px";

            const name = document.createElement("div");
            name.textContent = p.username + (isMePlayer ? " (YOU)" : "");
            Object.assign(name.style, {
                color: "#f1f5f9", fontSize: "13px",
                fontFamily: "'Courier New', monospace",
                fontWeight: "bold", textAlign: "center",
            });

            // Vote bar
            const barBg = document.createElement("div");
            Object.assign(barBg.style, {
                width: "100%", height: "4px",
                backgroundColor: "#1e2d45", borderRadius: "2px", overflow: "hidden",
            });
            const barFill = document.createElement("div");
            barFill.id = `mvote-bar-${p.id}`;
            Object.assign(barFill.style, {
                height: "100%", width: "0%",
                backgroundColor: "#f59e0b", transition: "width 0.3s",
            });
            barBg.appendChild(barFill);

            const votesLabel = document.createElement("div");
            votesLabel.id = `mvote-label-${p.id}`;
            votesLabel.textContent = "0 votes";
            Object.assign(votesLabel.style, {
                color: "#64748b", fontSize: "10px",
                fontFamily: "'Courier New', monospace",
            });

            const voteBtn = document.createElement("button");
            voteBtn.id = `mvote-btn-${p.id}`;
            voteBtn.textContent = isMePlayer ? "—" : "VOTE";
            Object.assign(voteBtn.style, {
                padding: "6px 16px", fontSize: "11px",
                fontFamily: "'Courier New', monospace",
                fontWeight: "bold", letterSpacing: "2px",
                border: "1px solid #f59e0b",
                borderRadius: "4px",
                backgroundColor: "transparent",
                color: "#f59e0b", cursor: isMePlayer ? "default" : "pointer",
                pointerEvents: isMePlayer ? "none" : "auto",
            });

            if (!isMePlayer) {
                voteBtn.onclick = () => {
                    if (this.myVote) return;
                    this.myVote = p.id;
                    socketService.socket.emit("vote", { targetId: p.id });
                    voteBtn.textContent = "✓ VOTED";
                    voteBtn.style.backgroundColor = "#f59e0b";
                    voteBtn.style.color = "#000";
                    card.style.borderColor = "#f59e0b";
                };
            }

            card.appendChild(avatar);
            card.appendChild(name);
            card.appendChild(barBg);
            card.appendChild(votesLabel);
            card.appendChild(voteBtn);
            grid.appendChild(card);
        });

        overlay.appendChild(grid);
        document.body.appendChild(overlay);
        this.mobileVotingEl = overlay;
    }

    private updateMobileVotes(votes: Record<string, number>) {
        if (!this.mobileVotingEl) return;
        const total = Object.values(votes).reduce((a, b) => a + b, 0);
        const alivePlayers = this.currentPlayers.filter(p => p.alive);
        alivePlayers.forEach(p => {
            const count = votes[p.id] || 0;
            const bar = document.getElementById(`mvote-bar-${p.id}`) as HTMLDivElement;
            const label = document.getElementById(`mvote-label-${p.id}`) as HTMLDivElement;
            if (bar) bar.style.width = total > 0 ? `${(count / total) * 100}%` : "0%";
            if (label) label.textContent = `${count} vote${count !== 1 ? "s" : ""}`;
        });
    }

    private closeMobileVoting() {
        document.getElementById("mobile-voting-overlay")?.remove();
        this.mobileVotingEl = undefined;
    }


}