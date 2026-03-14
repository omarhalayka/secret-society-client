import Phaser from "phaser";
import { socketService } from "../../socket";

// ════════════════════════════════════════════════════════
//  GameScene — Desktop + Mobile fully supported
//  Mobile (< 700px): HTML overlay tabs (Players / Events / Chat)
//  Desktop (≥ 700px): Phaser panels (Players | Events | Chat)
// ════════════════════════════════════════════════════════
export default class GameScene extends Phaser.Scene {

    // ─── بيانات اللعبة ───
    private role!: string;
    private roomId!: string;
    private userType: string = "PLAYER";
    private isAdmin: boolean = false;
    private currentPlayers: any[] = [];
    private myVote: string | null = null;
    private isNightSceneActive: boolean = false;

    // ─── Phaser elements (desktop only) ───
    private phaseText!: Phaser.GameObjects.Text;
    private roundText!: Phaser.GameObjects.Text;
    private roleChip!: Phaser.GameObjects.Container;
    private playerRows: Phaser.GameObjects.Container[] = [];
    private chatMessages: Phaser.GameObjects.Text[] = [];
    private eventLogItems: Phaser.GameObjects.Text[] = [];
    private voteEntries: Phaser.GameObjects.GameObject[] = [];
    private voteTitle?: Phaser.GameObjects.Text;
    private votingOverlayContainer?: Phaser.GameObjects.Container;
    private votingCards: Map<string, {
        container: Phaser.GameObjects.Container;
        barFill: Phaser.GameObjects.Rectangle;
        voteLabel: Phaser.GameObjects.Text;
        bg: Phaser.GameObjects.Rectangle;
        topBar: Phaser.GameObjects.Rectangle;
        btnLabel: Phaser.GameObjects.Text;
    }> = new Map();
    private nightResultOverlay?: Phaser.GameObjects.Container;
    private winOverlay?: Phaser.GameObjects.Container;
    private chatStatusText?: Phaser.GameObjects.Text;

    // ─── HTML elements (desktop chat) ───
    private chatInput!: HTMLInputElement;
    private sendBtn!: HTMLButtonElement;
    private adminDrawer?: HTMLDivElement;
    private adminToggleBtn?: HTMLButtonElement;
    private adminDrawerOpen: boolean = false;
    private outsideClickHandler?: (e: MouseEvent) => void;

    // ─── Mobile HTML ───
    private mobileActiveTab: string = "players";
    private mobileEventBuffer: Array<{msg: string; color: string}> = [];

    // ─── تخطيط ───
    private readonly TOPBAR_H = 58;
    private PLAYERS_W: number = 220;
    private CHAT_W: number = 280;
    private W!: number;
    private H!: number;
    private CONTENT_H!: number;
    private EVENTS_W!: number;
    private isMobile: boolean = false;

    // ─── ألوان ───
    private readonly C = {
        bg: 0x0a0d13, surface: 0x111827,
        surfaceAlt: 0x0f1520, border: 0x1e2d45,
        accent: 0x3b82f6, alive: 0x22c55e,
        dead: 0x374151, mafia: 0xef4444,
        doctor: 0x22c55e, detective: 0x3b82f6,
        citizen: 0x94a3b8, admin: 0xf59e0b,
    };

    constructor() { super("GameScene"); }

    init(data: any) {
        this.role = data.role;
        this.roomId = data.roomId;
        this.userType = data.userType || "PLAYER";
        this.isAdmin = this.role === "ADMIN";
        this.myVote = null;
        this.votingCards.clear();
        this.isNightSceneActive = false;
        if (this.isAdmin) socketService.isAdmin = true;
    }

    create() {
        if (!this.role || !this.roomId) { this.scene.start("LobbyScene"); return; }

        this.W = this.scale.width;
        this.H = this.scale.height;
        this.isMobile = this.W < 700;
        this.CONTENT_H = this.H - this.TOPBAR_H;

        if (this.isMobile) {
            this.PLAYERS_W = 0;
            this.CHAT_W = 0;
        }
        this.EVENTS_W = this.W - this.PLAYERS_W - this.CHAT_W;

        this.cleanupAllHTML();
        this.cameras.main.fadeIn(600, 10, 13, 19);
        this.drawBackground();
        this.drawTopBar();

        if (!this.isMobile) {
            this.drawPanels();
            this.drawSectionHeaders();
            this.createDesktopChatInput();
            if (this.isAdmin) this.createAdminDrawer();
        } else {
            this.createMobileTabs();
            if (this.isAdmin) this.createMobileAdminButtons();
        }

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
    //  Panels (desktop)
    // ══════════════════════════════════════
    private drawPanels() {
        const chatX = this.PLAYERS_W + this.EVENTS_W;
        const pH = this.CONTENT_H;
        const pY = this.TOPBAR_H;
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

        // اسم اللعبة
        const titleFontSize = this.isMobile ? "12px" : "16px";
        this.add.text(12, this.TOPBAR_H / 2, "SECRET SOCIETY", {
            fontSize: titleFontSize, color: "#f1f5f9",
            fontFamily: "'Georgia', serif", fontStyle: "bold", letterSpacing: 3
        }).setOrigin(0, 0.5).setDepth(4);

        // الغرفة - مخفية على الهاتف إذا ضيقة
        if (!this.isMobile) {
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
        } else {
            // على الهاتف: phase في المنتصف
            this.phaseText = this.add.text(this.W / 2, this.TOPBAR_H / 2, "◉  WAITING", {
                fontSize: "10px", color: "#64748b",
                fontFamily: "'Courier New', monospace", letterSpacing: 1
            }).setOrigin(0.5, 0.5).setDepth(4);
        }

        this.buildRoleChip();
        if (this.isAdmin && !this.isMobile) this.createAdminToggleBtn();
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
        const chipHex = "#" + chipColor.toString(16).padStart(6, "0");
        if (this.roleChip) this.roleChip.destroy();

        const chipW = this.isMobile ? 110 : 150;
        const fontSize = this.isMobile ? "10px" : "13px";
        const c = this.add.container(this.W - 6, this.TOPBAR_H / 2).setDepth(4);
        const bg = this.add.rectangle(0, 0, chipW, this.isMobile ? 24 : 30, 0x0f1520);
        bg.setStrokeStyle(1, chipColor); bg.setOrigin(1, 0.5);
        const lbl = this.add.text(-8, 0, `${icons[this.role] || "◎"}  ${this.role}`, {
            fontSize, color: chipHex,
            fontFamily: "'Courier New', monospace", fontStyle: "bold", letterSpacing: 2
        }).setOrigin(1, 0.5);
        c.add([bg, lbl]);
        this.roleChip = c;
        this.tweens.add({ targets: bg, alpha: 0.5, duration: 1200, yoyo: true, repeat: -1 });
    }

    // ══════════════════════════════════════
    //  Section Headers (desktop)
    // ══════════════════════════════════════
    private drawSectionHeaders() {
        const chatX = this.PLAYERS_W + this.EVENTS_W;
        [
            { x: 16, label: "PLAYERS" },
            { x: this.PLAYERS_W + 16, label: "EVENT LOG" },
            { x: chatX + 16, label: "CHAT" },
        ].forEach((h, i) => {
            const t = this.add.text(h.x, this.TOPBAR_H + 16, h.label, {
                fontSize: "10px", color: "#3b82f6",
                fontFamily: "'Courier New', monospace", fontStyle: "bold", letterSpacing: 3
            }).setDepth(3).setAlpha(0);
            this.tweens.add({ targets: t, alpha: 1, y: t.y - 4, duration: 400, delay: i * 80 });
        });
        const sepY = this.TOPBAR_H + 34;
        const sep = this.add.graphics().setDepth(3);
        sep.lineStyle(1, this.C.border, 0.4);
        [
            { x: 0, w: this.PLAYERS_W },
            { x: this.PLAYERS_W, w: this.EVENTS_W },
            { x: chatX, w: this.CHAT_W },
        ].forEach(s => { sep.moveTo(s.x + 12, sepY); sep.lineTo(s.x + s.w - 12, sepY); });
        sep.strokePath();

        this.chatStatusText = this.add.text(
            chatX + this.CHAT_W - 14, this.TOPBAR_H + 16,
            "● LIVE", { fontSize: "9px", color: "#22c55e", fontFamily: "'Courier New', monospace", letterSpacing: 1 }
        ).setOrigin(1, 0.5).setDepth(3);
    }

    // ══════════════════════════════════════
    //  Mobile Tabs System
    // ══════════════════════════════════════
    private createMobileTabs() {
        const ui = document.createElement("div");
        ui.id = "mobile-game-ui";
        Object.assign(ui.style, {
            position: "fixed", top: `${this.TOPBAR_H}px`, left: "0", right: "0",
            bottom: "0", zIndex: "100",
            display: "flex", flexDirection: "column",
            backgroundColor: "#0a0d13",
            fontFamily: "'Courier New', monospace",
        });

        // ─── Tab Buttons ───
        const tabBar = document.createElement("div");
        tabBar.id = "mobile-tab-bar";
        Object.assign(tabBar.style, {
            display: "flex", borderBottom: "1px solid #1e2d45",
            backgroundColor: "#0f1520",
        });

        const tabs = [
            { id: "players", icon: "👥", label: "PLAYERS" },
            { id: "events",  icon: "📋", label: "EVENTS"  },
            { id: "chat",    icon: "💬", label: "CHAT"    },
        ];

        tabs.forEach(tab => {
            const btn = document.createElement("button");
            btn.id = `tab-btn-${tab.id}`;
            btn.textContent = `${tab.icon} ${tab.label}`;
            Object.assign(btn.style, {
                flex: "1", padding: "10px 4px", fontSize: "11px",
                fontFamily: "'Courier New', monospace", fontWeight: "bold",
                letterSpacing: "1px", border: "none", borderBottom: "2px solid transparent",
                backgroundColor: "transparent", color: "#64748b",
                cursor: "pointer", transition: "all 0.15s",
            });
            btn.addEventListener("click", () => this.switchMobileTab(tab.id));
            tabBar.appendChild(btn);
        });
        ui.appendChild(tabBar);

        // ─── Tab Panels ───
        // Players Panel
        const playersPanel = document.createElement("div");
        playersPanel.id = "tab-panel-players";
        Object.assign(playersPanel.style, {
            flex: "1", overflowY: "auto", padding: "10px",
            display: "flex", flexDirection: "column", gap: "6px",
        });
        ui.appendChild(playersPanel);

        // Events Panel
        const eventsPanel = document.createElement("div");
        eventsPanel.id = "tab-panel-events";
        Object.assign(eventsPanel.style, {
            flex: "1", overflowY: "auto", padding: "12px",
            display: "none", flexDirection: "column", gap: "8px",
        });
        ui.appendChild(eventsPanel);

        // أفرغ الـ buffer لو فيه أحداث محفوظة من قبل
        this.time.delayedCall(50, () => this.flushMobileEventBuffer());

        // Chat Panel
        const chatPanel = document.createElement("div");
        chatPanel.id = "tab-panel-chat";
        Object.assign(chatPanel.style, {
            flex: "1", display: "none", flexDirection: "column",
        });

        const chatMessages = document.createElement("div");
        chatMessages.id = "mobile-chat-messages";
        Object.assign(chatMessages.style, {
            flex: "1", overflowY: "auto", padding: "10px",
            display: "flex", flexDirection: "column", gap: "6px",
        });
        chatPanel.appendChild(chatMessages);

        // Chat Input Row
        const chatInputRow = document.createElement("div");
        Object.assign(chatInputRow.style, {
            display: "flex", gap: "8px", padding: "8px 10px",
            borderTop: "1px solid #1e2d45",
            backgroundColor: "#0f1520",
        });

        const mobileInput = document.createElement("input");
        mobileInput.id = "mobile-chat-input";
        mobileInput.placeholder = "Message...";
        mobileInput.maxLength = 200;
        Object.assign(mobileInput.style, {
            flex: "1", padding: "10px 12px",
            backgroundColor: "#0a0d13", color: "#f1f5f9",
            border: "1px solid #1e2d45", borderRadius: "4px",
            fontFamily: "'Courier New', monospace", fontSize: "13px",
            outline: "none", WebkitAppearance: "none",
        });
        mobileInput.addEventListener("focus", () => { mobileInput.style.borderColor = "#3b82f6"; });
        mobileInput.addEventListener("blur",  () => { mobileInput.style.borderColor = "#1e2d45"; });

        const mobileSendBtn = document.createElement("button");
        mobileSendBtn.textContent = "➤";
        Object.assign(mobileSendBtn.style, {
            padding: "10px 16px", fontSize: "16px",
            backgroundColor: "#3b82f6", color: "#fff",
            border: "none", borderRadius: "4px",
            cursor: "pointer", flexShrink: "0",
            WebkitAppearance: "none",
            touchAction: "manipulation",
        });

        // ─── دالة الإرسال ───
        const doSend = () => {
            const msg = mobileInput.value.trim();
            if (!msg) return;
            if (!socketService.socket.connected) {
                console.warn("[Chat] Socket not connected");
                return;
            }
            socketService.socket.emit("send_message", msg);
            mobileInput.value = "";
            // لا نعيد focus على iOS عشان ما تنفتح الكيبورد تلقائياً
        };

        mobileInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") { e.preventDefault(); doSend(); }
        });
        // نستخدم pointerup بدل touchend لأنه أكثر موثوقية على iOS
        mobileSendBtn.addEventListener("pointerup", (e) => {
            e.preventDefault();
            doSend();
        });
        // fallback للـ click
        mobileSendBtn.addEventListener("click", (e) => {
            e.preventDefault();
            doSend();
        });

        chatInputRow.appendChild(mobileInput);
        chatInputRow.appendChild(mobileSendBtn);
        chatPanel.appendChild(chatInputRow);
        ui.appendChild(chatPanel);

        document.body.appendChild(ui);

        // activate players tab by default
        this.switchMobileTab("players");
    }

    private switchMobileTab(tabId: string) {
        this.mobileActiveTab = tabId;
        const tabs = ["players", "events", "chat"];
        tabs.forEach(t => {
            const btn   = document.getElementById(`tab-btn-${t}`) as HTMLButtonElement;
            const panel = document.getElementById(`tab-panel-${t}`) as HTMLDivElement;
            if (!btn || !panel) return;
            const active = t === tabId;
            btn.style.color       = active ? "#f1f5f9" : "#64748b";
            btn.style.borderBottomColor = active ? "#3b82f6" : "transparent";
            panel.style.display   = active ? "flex" : "none";
        });
        // reset badge
        const btn = document.getElementById(`tab-btn-${tabId}`);
        if (btn) {
            const labels: Record<string,string> = { players: "👥 PLAYERS", events: "📋 EVENTS", chat: "💬 CHAT" };
            btn.textContent = labels[tabId];
            btn.style.color = "#f1f5f9";
        }
    }

    private showMobileTabBadge(tabId: string, label: string) {
        if (this.mobileActiveTab === tabId) return;
        const btn = document.getElementById(`tab-btn-${tabId}`);
        if (btn) {
            const icons: Record<string,string> = { players: "👥", events: "📋", chat: "💬" };
            btn.textContent = `${icons[tabId]} ● ${label}`;
            btn.style.color = "#22c55e";
        }
    }

    // ══════════════════════════════════════
    //  Players Panel
    // ══════════════════════════════════════
    private drawPlayers(players: any[], phase: string) {
        this.currentPlayers = players;
        if (this.isMobile) {
            this.updateMobilePlayers(players);
            return;
        }
        this.playerRows.forEach(r =>
            this.tweens.add({ targets: r, alpha: 0, duration: 200, onComplete: () => r.destroy() })
        );
        this.playerRows = [];
        const startY = this.TOPBAR_H + 50;
        const isNight = phase === "NIGHT";
        players.forEach((p, i) =>
            this.time.delayedCall(i * 55, () => this.buildPlayerRow(p, startY + i * 44, isNight))
        );
    }

    private updateMobilePlayers(players: any[]) {
        const panel = document.getElementById("tab-panel-players");
        if (!panel) return;
        panel.innerHTML = "";
        players.forEach(p => {
            const row = document.createElement("div");
            const isMe = p.id === socketService.socket.id;
            Object.assign(row.style, {
                display: "flex", alignItems: "center", gap: "10px",
                padding: "10px 12px", borderRadius: "6px",
                backgroundColor: isMe ? "rgba(59,130,246,0.1)" : "rgba(17,24,39,0.6)",
                border: isMe ? "1px solid rgba(59,130,246,0.4)" : "1px solid #1e2d45",
            });

            // avatar circle
            const avatarDiv = document.createElement("div");
            Object.assign(avatarDiv.style, {
                width: "30px", height: "30px", borderRadius: "50%",
                backgroundColor: p.color || "#1e293b",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "15px", flexShrink: "0",
                border: `1px solid ${p.alive ? "#22c55e44" : "#37415144"}`,
                opacity: p.alive ? "1" : "0.4",
            });
            avatarDiv.textContent = p.avatar || "😎";

            const dot = document.createElement("span"); // نبقيها للـ alive indicator
            dot.style.display = "none"; // مش محتاجينها هلق

            const name = document.createElement("span");
            let nameText = p.username;
            if (isMe) nameText += " [YOU]";
            Object.assign(name.style, {
                fontFamily: "'Courier New', monospace", fontSize: "13px",
                color: p.alive ? (isMe ? "#f1f5f9" : "#94a3b8") : "#374151",
                flex: "1", fontWeight: isMe ? "bold" : "normal",
            });
            name.textContent = nameText;

            row.appendChild(avatarDiv);
            row.appendChild(name);

            // ── أظهر الدور فقط لنفسك أو إذا ميت ──
            const showRole = isMe || !p.alive || this.isAdmin ||
                (this.role === "MAFIA" && p.role === "MAFIA") ||
                this.userType === "SPECTATOR";

            if (showRole && p.role) {
                const roleSpan = document.createElement("span");
                const roleColors: Record<string, string> = {
                    MAFIA: "#ef4444", DOCTOR: "#22c55e", DETECTIVE: "#3b82f6",
                    CITIZEN: "#64748b", ADMIN: "#f59e0b",
                };
                Object.assign(roleSpan.style, {
                    fontSize: "10px", fontFamily: "'Courier New', monospace",
                    color: roleColors[p.role] || "#4b5563",
                    opacity: p.alive ? "1" : "0.5",
                });
                roleSpan.textContent = `[${p.role}]`;
                row.appendChild(roleSpan);
            }

            panel.appendChild(row);
        });
    }

    private buildPlayerRow(player: any, y: number, isNight: boolean) {
        const container = this.add.container(0, y).setDepth(3).setAlpha(0);
        const isAlive = player.alive;
        const isMe = player.id === socketService.socket.id;

        const dot = this.add.circle(16, 0, 5, isAlive ? this.C.alive : this.C.dead);
        if (isAlive) {
            this.tweens.add({ targets: dot, alpha: 0.3, duration: 900, yoyo: true, repeat: -1, delay: Math.random() * 600 });
        }

        // ─── أظهر الدور فقط لنفسك أو الأدمن أو الزملاء في المافيا ───
        let tag = "";
        if (this.isAdmin || isMe) tag = `  [${player.role}]`;
        else if (this.role === "MAFIA" && player.role === "MAFIA") tag = "  [MAFIA]";
        else if (this.userType === "SPECTATOR") tag = `  [${player.role}]`;
        else if (!isAlive) tag = `  [${player.role}]`;

        // avatar emoji قبل الاسم
        const avatarEmoji = player.avatar || "😎";
        const avatarText = this.add.text(30, 0, avatarEmoji, {
            fontSize: "14px"
        }).setOrigin(0, 0.5);

        const name = this.add.text(52, 0, `${player.username}${tag}`, {
            fontSize: "13px", color: isAlive ? "#e2e8f0" : "#374151",
            fontFamily: "'Courier New', monospace", fontStyle: isMe ? "bold" : "normal"
        }).setOrigin(0, 0.5);

        const sep = this.add.graphics();
        sep.lineStyle(1, this.C.border, 0.25);
        sep.moveTo(10, 20); sep.lineTo(this.PLAYERS_W - 10, 20); sep.strokePath();
        container.add([sep, dot, avatarText, name]);

        if (isAlive && !this.isAdmin && this.userType !== "SPECTATOR") {
            const btnX = this.PLAYERS_W - 32;
            if (this.role === "MAFIA" && isNight && !isMe)
                this.addActionBtn(container, btnX, 0, "⚔", "#ef4444", () => {
                    socketService.socket.emit("mafia_kill", player.id);
                });
            if (this.role === "DOCTOR" && isNight)
                this.addActionBtn(container, btnX, 0, "✚", "#22c55e", () => {
                    socketService.socket.emit("doctor_save", player.id);
                });
            if (this.role === "DETECTIVE" && isNight && !isMe)
                this.addActionBtn(container, btnX, 0, "🔍", "#3b82f6", () => {
                    socketService.socket.emit("detective_check", player.id);
                });
        }

        this.playerRows.push(container);
        this.tweens.add({
            targets: container, alpha: 1, duration: 300, ease: "Cubic.easeOut",
            onStart: () => container.setX(-10), onComplete: () => container.setX(0)
        });
    }

    private addActionBtn(parent: Phaser.GameObjects.Container, x: number, y: number, icon: string, color: string, cb: () => void) {
        const btn = this.add.text(x, y, icon, {
            fontSize: "15px", color, backgroundColor: "#0f1520", padding: { x: 5, y: 2 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        btn.on("pointerover", () => btn.setScale(1.2));
        btn.on("pointerout", () => btn.setScale(1));
        btn.on("pointerdown", () =>
            this.tweens.add({ targets: btn, scaleX: 0.85, scaleY: 0.85, duration: 70, yoyo: true, onComplete: cb })
        );
        parent.add(btn);
    }

    // ══════════════════════════════════════
    //  Event Log
    // ══════════════════════════════════════
    private addEventLog(msg: string, color: string) {
        if (this.isMobile) {
            this.addMobileEvent(msg, color);
            return;
        }
        const ex = this.PLAYERS_W + 16;
        const baseY = this.TOPBAR_H + 50;
        const lineH = 26;
        const maxL = 14;
        this.eventLogItems.forEach((t, i) =>
            this.tweens.add({ targets: t, y: baseY + i * lineH, duration: 180 })
        );
        const text = this.add.text(ex, baseY + this.eventLogItems.length * lineH + lineH,
            `›  ${msg}`,
            { fontSize: "13px", color, fontFamily: "'Courier New', monospace", wordWrap: { width: this.EVENTS_W - 32 } }
        ).setDepth(3).setAlpha(0);
        this.tweens.add({ targets: text, alpha: 1, y: text.y - lineH, duration: 320, ease: "Back.easeOut" });
        this.eventLogItems.push(text);
        if (this.eventLogItems.length > 14) {
            const old = this.eventLogItems.shift()!;
            this.tweens.add({ targets: old, alpha: 0, duration: 180, onComplete: () => old.destroy() });
        }
    }

    private addMobileEvent(msg: string, color: string) {
        // نخزن الحدث دائماً في الـ buffer
        this.mobileEventBuffer.push({ msg, color });
        if (this.mobileEventBuffer.length > 30) this.mobileEventBuffer.shift();

        const panel = document.getElementById("tab-panel-events");
        if (!panel) return; // panel غير موجود - الحدث محفوظ في buffer

        const el = document.createElement("div");
        Object.assign(el.style, {
            padding: "8px 10px", borderRadius: "4px",
            backgroundColor: "rgba(17,24,39,0.5)",
            borderLeft: `3px solid ${color}`,
            fontFamily: "'Courier New', monospace", fontSize: "12px",
            color: "#cbd5e1",
        });
        el.textContent = `› ${msg}`;
        panel.appendChild(el);
        panel.scrollTop = panel.scrollHeight;
        while (panel.children.length > 30) panel.removeChild(panel.firstChild!);
        this.showMobileTabBadge("events", "NEW");
    }

    private flushMobileEventBuffer() {
        const panel = document.getElementById("tab-panel-events");
        if (!panel || !this.mobileEventBuffer.length) return;
        panel.innerHTML = "";
        this.mobileEventBuffer.forEach(({ msg, color }) => {
            const el = document.createElement("div");
            Object.assign(el.style, {
                padding: "8px 10px", borderRadius: "4px",
                backgroundColor: "rgba(17,24,39,0.5)",
                borderLeft: `3px solid ${color}`,
                fontFamily: "'Courier New', monospace", fontSize: "12px",
                color: "#cbd5e1",
            });
            el.textContent = `› ${msg}`;
            panel.appendChild(el);
        });
        panel.scrollTop = panel.scrollHeight;
    }

    // ══════════════════════════════════════
    //  Chat
    // ══════════════════════════════════════
    private addChatMessage(username: string, message: string, alive?: boolean) {
        if (this.isMobile) {
            this.addMobileChat(username, message, alive !== false);
            return;
        }
        const chatX = this.PLAYERS_W + this.EVENTS_W;
        const baseY = this.TOPBAR_H + 50;
        const lineH = 22;
        const isAlive = alive !== false;
        const isMe = username === this.currentPlayers.find(p => p.id === socketService.socket.id)?.username;
        let msgColor = isAlive ? "#94a3b8" : "#374151";
        if (isMe) msgColor = "#e2e8f0";

        this.chatMessages.forEach((t, i) =>
            this.tweens.add({ targets: t, y: baseY + i * lineH, duration: 180 })
        );
        const text = this.add.text(chatX + 14, baseY + this.chatMessages.length * lineH + lineH,
            `${isAlive ? "" : "☠ "}${username}: ${message}`,
            { fontSize: "12px", color: msgColor, fontFamily: "'Courier New', monospace", wordWrap: { width: this.CHAT_W - 28 } }
        ).setDepth(3).setAlpha(0);
        this.tweens.add({ targets: text, alpha: 1, y: text.y - lineH, duration: 280, ease: "Back.easeOut" });
        this.chatMessages.push(text);
        if (this.chatMessages.length > 15) {
            const old = this.chatMessages.shift()!;
            this.tweens.add({ targets: old, alpha: 0, duration: 180, onComplete: () => old.destroy() });
        }
    }

    private addMobileChat(username: string, message: string, alive: boolean) {
        const msgs = document.getElementById("mobile-chat-messages");
        if (!msgs) return;
        const el = document.createElement("div");
        const isMe = username === this.currentPlayers.find(p => p.id === socketService.socket.id)?.username;
        Object.assign(el.style, {
            padding: "6px 10px", borderRadius: "6px",
            backgroundColor: isMe ? "rgba(59,130,246,0.1)" : "rgba(17,24,39,0.5)",
            border: isMe ? "1px solid rgba(59,130,246,0.3)" : "1px solid transparent",
            fontFamily: "'Courier New', monospace", fontSize: "13px",
        });
        el.innerHTML = `<span style="color:${alive ? (isMe ? "#60a5fa" : "#3b82f6") : "#4b5563"};font-weight:bold">${username}:</span> <span style="color:${alive ? "#cbd5e1" : "#4b5563"}">${message}</span>`;
        msgs.appendChild(el);
        msgs.scrollTop = msgs.scrollHeight;
        while (msgs.children.length > 40) msgs.removeChild(msgs.firstChild!);
        this.showMobileTabBadge("chat", "💬");
    }

    // ══════════════════════════════════════
    //  Desktop Chat Input
    // ══════════════════════════════════════
    private createDesktopChatInput() {
        const chatX = this.PLAYERS_W + this.EVENTS_W;

        this.chatInput = document.createElement("input");
        this.chatInput.id = "desktop-chat-input";
        this.chatInput.placeholder = "Message...";
        this.chatInput.maxLength = 200;
        Object.assign(this.chatInput.style, {
            position: "absolute", left: `${chatX + 12}px`, bottom: "14px",
            width: `${this.CHAT_W - 60}px`, padding: "9px 14px",
            fontSize: "13px", fontFamily: "'Courier New', monospace",
            border: "1px solid #1e2d45", borderRadius: "4px",
            backgroundColor: "#0a0d13", color: "#f1f5f9",
            outline: "none", zIndex: "1000",
        });
        this.chatInput.addEventListener("focus", () => this.chatInput.style.borderColor = "#3b82f6");
        this.chatInput.addEventListener("blur", () => this.chatInput.style.borderColor = "#1e2d45");
        document.body.appendChild(this.chatInput);

        this.sendBtn = document.createElement("button");
        this.sendBtn.id = "desktop-send-btn";
        this.sendBtn.textContent = "➤";
        Object.assign(this.sendBtn.style, {
            position: "absolute", left: `${chatX + this.CHAT_W - 44}px`, bottom: "14px",
            width: "36px", height: "36px", fontSize: "14px",
            border: "1px solid #1e2d45", borderRadius: "4px",
            backgroundColor: "#3b82f6", color: "#fff",
            cursor: "pointer", zIndex: "1000",
        });

        const send = () => {
            const msg = this.chatInput.value.trim();
            if (msg) {
                socketService.socket.emit("send_message", msg);
                this.chatInput.value = "";
            }
        };
        this.sendBtn.addEventListener("click", send);
        this.chatInput.addEventListener("keypress", e => { if (e.key === "Enter") send(); });
        document.body.appendChild(this.sendBtn);
    }

    // ══════════════════════════════════════
    //  Chat UI State
    // ══════════════════════════════════════
    private updateChatUI(phase: string) {
        if (!this.isMobile && this.chatStatusText?.active) {
            const map: Record<string, [string, string]> = {
                NIGHT: ["● NIGHT", "#6366f1"],
                VOTING: ["● VOTING", "#f59e0b"],
            };
            const [txt, clr] = map[phase] || ["● LIVE", "#22c55e"];
            this.chatStatusText.setText(txt).setColor(clr);
        }
        if (this.chatInput) { this.chatInput.disabled = false; this.chatInput.style.opacity = "1"; }
        if (this.sendBtn)   { this.sendBtn.disabled = false;   this.sendBtn.style.opacity = "1"; }
    }

    // ══════════════════════════════════════
    //  Voting Overlay (Desktop)
    // ══════════════════════════════════════
    private showVotingOverlay() {
        this.closeVotingOverlay(false);
        this.myVote = null;
        this.votingCards.clear();
        const alivePlayers = this.currentPlayers.filter(p => p.alive);
        if (!alivePlayers.length) return;

        const overlay = this.add.container(0, 0).setDepth(50);
        const dim = this.add.rectangle(0, 0, this.W, this.H, 0x000000, 0.75).setOrigin(0);
        overlay.add(dim);

        const titleTxt = this.add.text(this.W / 2, 78, "VOTE TO ELIMINATE", {
            fontSize: "32px", color: "#f1f5f9",
            fontFamily: "'Georgia', serif", fontStyle: "bold", letterSpacing: 8
        }).setOrigin(0.5);
        const subTxt = this.add.text(this.W / 2, 120, "Choose who threatens the community", {
            fontSize: "12px", color: "#64748b",
            fontFamily: "'Courier New', monospace", letterSpacing: 2
        }).setOrigin(0.5);
        overlay.add([titleTxt, subTxt]);

        const isSpectator = this.userType === "SPECTATOR";
        const cardW = 148, cardH = 196, gap = 16;
        const perRow = Math.min(alivePlayers.length, 4);
        const rows = Math.ceil(alivePlayers.length / perRow);
        const totalW = perRow * cardW + (perRow - 1) * gap;
        const startX = this.W / 2 - totalW / 2 + cardW / 2;
        const startY = this.H / 2 - (rows * (cardH + gap)) / 2 + cardH / 2 + 18;

        alivePlayers.forEach((player, i) => {
            const col = i % perRow, row = Math.floor(i / perRow);
            const cx = startX + col * (cardW + gap);
            const cy = startY + row * (cardH + gap);
            this.time.delayedCall(60 + i * 70, () => {
                const card = this.buildVotingCard(player, cx, cy, cardW, cardH, isSpectator);
                overlay.add(card);
            });
        });

        overlay.setAlpha(0);
        this.tweens.add({ targets: overlay, alpha: 1, duration: 300 });
        this.votingOverlayContainer = overlay;
    }

    private buildVotingCard(player: any, cx: number, cy: number, cardW: number, cardH: number, isSpectator: boolean): Phaser.GameObjects.Container {
        const isMe = player.id === socketService.socket.id;
        const container = this.add.container(cx, cy + 24).setAlpha(0);

        const shadow = this.add.rectangle(4, 6, cardW, cardH, 0x000000, 0.45).setOrigin(0.5);
        const bg = this.add.rectangle(0, 0, cardW, cardH, 0x0d1117); bg.setStrokeStyle(1, this.C.border); bg.setOrigin(0.5);
        const topBar = this.add.rectangle(0, -(cardH / 2) + 2, cardW - 2, 3, 0xf59e0b, 0); topBar.setOrigin(0.5, 0);
        const avatarBg = this.add.circle(0, -60, 27, 0x0a0d13); avatarBg.setStrokeStyle(1, this.C.border);
        const avatarIcon = this.add.text(0, -60, isMe ? "🧑" : "👤", { fontSize: "24px" }).setOrigin(0.5);
        const pulse = this.add.circle(0, -60, 34, 0xf59e0b, 0);
        this.tweens.add({ targets: pulse, alpha: 0.1, scaleX: 1.3, scaleY: 1.3, duration: 1000, yoyo: true, repeat: -1, delay: Math.random() * 500 });
        const nameTxt = this.add.text(0, -20, player.username.toUpperCase(), {
            fontSize: "11px", color: isMe ? "#fcd34d" : "#e2e8f0",
            fontFamily: "'Courier New', monospace", fontStyle: isMe ? "bold" : "normal", letterSpacing: 1
        }).setOrigin(0.5);
        const youLbl = isMe ? this.add.text(0, -6, "[ YOU ]", { fontSize: "9px", color: "#64748b", fontFamily: "'Courier New', monospace", letterSpacing: 2 }).setOrigin(0.5) : null;
        const barBg = this.add.rectangle(0, 34, cardW - 24, 6, 0x111827).setOrigin(0.5);
        const barFill = this.add.rectangle(-(cardW - 24) / 2, 34, 0, 6, 0xf59e0b, 0.8).setOrigin(0, 0.5);
        const voteLabel = this.add.text(0, 50, "0 votes", { fontSize: "10px", color: "#64748b", fontFamily: "'Courier New', monospace", letterSpacing: 1 }).setOrigin(0.5);
        const btnBg = this.add.rectangle(0, 74, cardW - 24, 26, 0x0a0d13); btnBg.setStrokeStyle(1, isSpectator ? 0x1e2d45 : 0xf59e0b, isSpectator ? 0.3 : 0.45).setOrigin(0.5);
        const btnLabel = this.add.text(0, 74, isSpectator ? "WATCHING" : (isMe ? "—" : "VOTE"), {
            fontSize: "10px", color: isSpectator ? "#334155" : (isMe ? "#374151" : "#f59e0b"),
            fontFamily: "'Courier New', monospace", fontStyle: "bold", letterSpacing: 3
        }).setOrigin(0.5);

        const items: Phaser.GameObjects.GameObject[] = [shadow, bg, topBar, pulse, avatarBg, avatarIcon, nameTxt, barBg, barFill, voteLabel, btnBg, btnLabel];
        if (youLbl) items.push(youLbl);
        container.add(items);

        if (!isSpectator && !isMe) {
            container.setInteractive(new Phaser.Geom.Rectangle(-cardW / 2, -cardH / 2, cardW, cardH), Phaser.Geom.Rectangle.Contains);
            container.on("pointerover", () => { if (this.myVote) return; bg.setFillStyle(0x111827); bg.setStrokeStyle(1, 0xf59e0b); topBar.setAlpha(1); this.tweens.add({ targets: container, scaleX: 1.04, scaleY: 1.04, duration: 120 }); });
            container.on("pointerout", () => { if (this.myVote === player.id) return; bg.setFillStyle(0x0d1117); bg.setStrokeStyle(1, this.C.border); topBar.setAlpha(0); this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 120 }); });
            container.on("pointerdown", () => { if (this.myVote) return; this.castVote(player.id, bg, topBar, btnLabel); });
        }

        this.votingCards.set(player.id, { container, barFill, voteLabel, bg, topBar, btnLabel });
        this.tweens.add({ targets: container, alpha: 1, y: cy, duration: 380, ease: "Back.easeOut" });
        return container;
    }

    private castVote(playerId: string, bg: Phaser.GameObjects.Rectangle, topBar: Phaser.GameObjects.Rectangle, btnLabel: Phaser.GameObjects.Text) {
        this.myVote = playerId;
        socketService.socket.emit("vote", playerId);
        this.votingCards.forEach((card, id) => {
            if (id !== playerId) { card.container.disableInteractive(); this.tweens.add({ targets: card.container, alpha: 0.28, scaleX: 0.94, scaleY: 0.94, duration: 280 }); }
        });
        bg.setFillStyle(0x150c00); bg.setStrokeStyle(2, 0xef4444);
        topBar.setFillStyle(0xef4444); topBar.setAlpha(1);
        btnLabel.setText("VOTED ✓").setColor("#f87171");
        this.cameras.main.flash(220, 50, 20, 0);
    }

    private updateVotingCards(votes: Record<string, number>) {
        if (!this.votingCards.size) return;
        const total = Math.max(Object.values(votes).reduce((a, b) => a + b, 0), 1);
        const maxV = Math.max(...Object.values(votes), 0);
        this.votingCards.forEach((card, id) => {
            const count = votes[id] || 0;
            this.tweens.add({ targets: card.barFill, width: Math.max(1, (count / total) * 124), duration: 360, ease: "Cubic.easeOut" });
            card.voteLabel.setText(`${count} vote${count !== 1 ? "s" : ""}`).setColor(count > 0 ? "#fbbf24" : "#64748b");
            if (count > 0 && count === maxV && this.myVote !== id) { card.bg.setStrokeStyle(1, 0xf59e0b, 0.55); card.topBar.setFillStyle(0xf59e0b); card.topBar.setAlpha(0.45); }
        });
    }

    private closeVotingOverlay(showResult: boolean, result?: { eliminated?: string; tie?: boolean }) {
        // أغلق mobile voting أيضاً
        document.getElementById("mobile-voting-overlay")?.remove();

        if (!this.votingOverlayContainer) return;
        const ov = this.votingOverlayContainer;
        if (showResult && result) {
            const isTie = result.tie;
            const label = isTie ? "TIE — No one eliminated" : `${result.eliminated} eliminated`;
            const bColor = isTie ? 0xfbbf24 : 0xef4444;
            const tColor = isTie ? "#fcd34d" : "#f87171";
            const banner = this.add.container(this.W / 2, this.H / 2).setDepth(55).setAlpha(0);
            const panBg = this.add.rectangle(0, 0, 420, 78, isTie ? 0x0d1000 : 0x130500); panBg.setStrokeStyle(2, bColor);
            const panTxt = this.add.text(0, -12, label, { fontSize: "22px", color: tColor, fontFamily: "'Courier New', monospace", fontStyle: "bold", letterSpacing: 3 }).setOrigin(0.5);
            const panSub = this.add.text(0, 16, "Voting session closed", { fontSize: "11px", color: "#4b5563", fontFamily: "'Courier New', monospace", letterSpacing: 2 }).setOrigin(0.5);
            banner.add([panBg, panTxt, panSub]);
            this.tweens.add({ targets: banner, alpha: 1, duration: 320, ease: "Back.easeOut" });
            this.time.delayedCall(2200, () => {
                this.tweens.add({ targets: [banner, ov], alpha: 0, duration: 380, onComplete: () => { banner.destroy(); ov.destroy(); if (this.votingOverlayContainer === ov) { this.votingOverlayContainer = undefined; this.votingCards.clear(); this.myVote = null; } } });
            });
        } else {
            this.tweens.add({ targets: ov, alpha: 0, duration: 300, onComplete: () => { ov.destroy(); if (this.votingOverlayContainer === ov) { this.votingOverlayContainer = undefined; this.votingCards.clear(); this.myVote = null; } } });
        }
    }

    // ══════════════════════════════════════
    //  Mobile Voting Overlay
    // ══════════════════════════════════════
    private showMobileVoting() {
        document.getElementById("mobile-voting-overlay")?.remove();
        this.myVote = null;
        const alivePlayers = this.currentPlayers.filter(p => p.alive);
        if (!alivePlayers.length) return;

        const overlay = document.createElement("div");
        overlay.id = "mobile-voting-overlay";
        Object.assign(overlay.style, {
            position: "fixed", top: "0", left: "0", right: "0", bottom: "0",
            zIndex: "9999", backgroundColor: "rgba(0,0,0,0.65)",
            display: "flex", flexDirection: "column", alignItems: "center",
            overflowY: "auto", padding: "20px 12px 20px",
            fontFamily: "'Courier New', monospace",
        });

        const title = document.createElement("div");
        title.textContent = "VOTE TO ELIMINATE";
        Object.assign(title.style, {
            color: "#f1f5f9", fontSize: "20px", fontFamily: "'Georgia', serif",
            fontWeight: "bold", letterSpacing: "4px", marginBottom: "6px",
        });
        const sub = document.createElement("div");
        sub.textContent = "Choose who threatens the community";
        Object.assign(sub.style, { color: "#64748b", fontSize: "11px", letterSpacing: "2px", marginBottom: "20px" });
        overlay.appendChild(title);
        overlay.appendChild(sub);

        const grid = document.createElement("div");
        Object.assign(grid.style, {
            display: "grid", gridTemplateColumns: "repeat(2, 1fr)",
            gap: "10px", width: "100%", maxWidth: "420px",
        });

        alivePlayers.forEach(p => {
            const isMe = p.id === socketService.socket.id;
            const card = document.createElement("div");
            Object.assign(card.style, {
                backgroundColor: "#111827", border: "1px solid #1e2d45",
                borderRadius: "8px", padding: "14px 10px",
                display: "flex", flexDirection: "column", alignItems: "center", gap: "8px",
                opacity: isMe ? "0.5" : "1",
            });

            const avatar = document.createElement("div");
            avatar.textContent = isMe ? "🧑" : "👤";
            avatar.style.fontSize = "28px";

            const name = document.createElement("div");
            name.textContent = p.username + (isMe ? " (YOU)" : "");
            Object.assign(name.style, {
                color: "#f1f5f9", fontSize: "12px", fontWeight: "bold",
                textAlign: "center", letterSpacing: "1px",
            });

            const barBg = document.createElement("div");
            Object.assign(barBg.style, { width: "100%", height: "4px", backgroundColor: "#1e2d45", borderRadius: "2px", overflow: "hidden" });
            const barFill = document.createElement("div");
            barFill.id = `mvote-bar-${p.id}`;
            Object.assign(barFill.style, { height: "100%", width: "0%", backgroundColor: "#f59e0b", transition: "width 0.3s" });
            barBg.appendChild(barFill);

            const votesLabel = document.createElement("div");
            votesLabel.id = `mvote-label-${p.id}`;
            votesLabel.textContent = "0 votes";
            Object.assign(votesLabel.style, { color: "#64748b", fontSize: "10px" });

            const voteBtn = document.createElement("button");
            voteBtn.textContent = isMe ? "—" : "VOTE";
            Object.assign(voteBtn.style, {
                padding: "6px 16px", fontSize: "11px", fontWeight: "bold",
                letterSpacing: "2px", border: "1px solid #f59e0b",
                borderRadius: "4px", backgroundColor: "transparent",
                color: "#f59e0b", cursor: isMe ? "default" : "pointer",
                pointerEvents: isMe ? "none" : "auto",
                fontFamily: "'Courier New', monospace",
            });

            if (!isMe) {
                voteBtn.addEventListener("click", () => {
                    if (this.myVote) return;
                    this.myVote = p.id;
                    socketService.socket.emit("vote", p.id);
                    voteBtn.textContent = "✓ VOTED";
                    voteBtn.style.backgroundColor = "#f59e0b";
                    voteBtn.style.color = "#000";
                    card.style.borderColor = "#f59e0b";
                    // disable others
                    overlay.querySelectorAll<HTMLButtonElement>("button").forEach(b => {
                        if (b !== voteBtn) { b.style.opacity = "0.3"; b.style.pointerEvents = "none"; }
                    });
                });
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
    }

    private updateMobileVotes(votes: Record<string, number>) {
        const overlay = document.getElementById("mobile-voting-overlay");
        if (!overlay) return;
        const total = Object.values(votes).reduce((a, b) => a + b, 0);
        Object.entries(votes).forEach(([id, count]) => {
            const bar   = document.getElementById(`mvote-bar-${id}`)   as HTMLDivElement;
            const label = document.getElementById(`mvote-label-${id}`) as HTMLDivElement;
            if (bar)   bar.style.width = total > 0 ? `${(count / total) * 100}%` : "0%";
            if (label) label.textContent = `${count} vote${count !== 1 ? "s" : ""}`;
        });
    }

    // ══════════════════════════════════════
    //  Votes Bar (desktop event log)
    // ══════════════════════════════════════
    private updateVotes(votes: Record<string, number>) {
        this.voteEntries.forEach(obj => { if ((obj as any).destroy) (obj as any).destroy(); });
        this.voteEntries = [];
        this.voteTitle?.destroy(); this.voteTitle = undefined;

        if (this.isMobile) {
            this.updateMobileVotes(votes);
            this.updateVotingCards(votes);
            return;
        }
        if (!Object.keys(votes).length) return;

        const baseX = this.PLAYERS_W + 16;
        let baseY = this.TOPBAR_H + this.CONTENT_H - 180;
        this.voteTitle = this.add.text(baseX, baseY, "VOTES", { fontSize: "10px", color: "#f59e0b", fontFamily: "'Courier New', monospace", letterSpacing: 3 }).setDepth(4);
        baseY += 20;

        for (const id in votes) {
            const p = this.currentPlayers.find(pl => pl.id === id);
            const uname = p ? p.username : id.substring(0, 6);
            const count = votes[id];
            const barW = Math.min(count * 22, this.EVENTS_W - 130);
            const bgBar = this.add.rectangle(baseX, baseY + 8, this.EVENTS_W - 64, 15, 0x111827).setOrigin(0, 0.5).setDepth(3);
            const bar = this.add.rectangle(baseX, baseY + 8, 2, 15, 0xf59e0b, 0.45).setOrigin(0, 0.5).setDepth(4); bar.setStrokeStyle(1, 0xf59e0b, 0.55);
            const lbl = this.add.text(baseX + 8, baseY + 8, `${uname}  ×${count}`, { fontSize: "11px", color: "#fbbf24", fontFamily: "'Courier New', monospace" }).setOrigin(0, 0.5).setDepth(5);
            this.tweens.add({ targets: bar, width: barW, duration: 400, ease: "Cubic.easeOut" });
            this.voteEntries.push(bgBar, bar, lbl);
            baseY += 24;
        }
        this.updateVotingCards(votes);
    }

    // ══════════════════════════════════════
    //  Night Result Overlay
    // ══════════════════════════════════════
    private showNightResultOverlay(data: any) {
        this.nightResultOverlay?.destroy();
        this.nightResultOverlay = undefined;
        if (!["MAFIA", "DOCTOR", "DETECTIVE"].includes(this.role)) return;

        const mafiaTarget = this.currentPlayers.find(p => p.id === data.mafiaTarget);
        const doctorSave  = this.currentPlayers.find(p => p.id === data.doctorSave);
        const victim      = this.currentPlayers.find(p => p.id === data.finalVictim);

        const rows: Array<{ icon: string; label: string; value: string; color: string }> = [];
        if (this.role === "MAFIA") {
            rows.push({ icon: "🔪", label: "Your target", value: mafiaTarget?.username || "—", color: "#f87171" });
            rows.push({ icon: "☠", label: "Outcome", value: victim ? `${victim.username} eliminated` : "Target was saved!", color: victim ? "#f87171" : "#4ade80" });
        }
        if (this.role === "DOCTOR") {
            rows.push({ icon: "✚", label: "You protected", value: doctorSave?.username || "—", color: "#4ade80" });
            rows.push({ icon: "☠", label: "Outcome", value: victim ? `${victim.username} died` : "You saved them! ✓", color: victim ? "#f87171" : "#4ade80" });
        }
        if (this.role === "DETECTIVE") {
            rows.push({ icon: "🔍", label: "Night victim", value: victim ? victim.username : "Nobody died tonight", color: victim ? "#f87171" : "#4ade80" });
        }

        if (this.isMobile) {
            // Mobile: HTML banner
            this.showMobileNightResult(rows);
            return;
        }

        const panelW = 340, panelH = 64 + rows.length * 46 + 24;
        const c = this.add.container(this.W / 2, this.H / 2 - 50).setDepth(48).setAlpha(0);
        const bg = this.add.rectangle(0, 0, panelW, panelH, 0x08090f); bg.setStrokeStyle(2, 0xa855f7); bg.setOrigin(0.5);
        const titleTxt = this.add.text(0, -(panelH / 2) + 22, "🌙  NIGHT RESULTS", { fontSize: "13px", color: "#c084fc", fontFamily: "'Courier New', monospace", fontStyle: "bold", letterSpacing: 3 }).setOrigin(0.5);
        c.add([bg, titleTxt]);
        rows.forEach((row, i) => {
            const rowY = -(panelH / 2) + 58 + i * 46;
            const rowBg = this.add.rectangle(0, rowY, panelW - 24, 36, 0x0d0f18).setOrigin(0.5); rowBg.setStrokeStyle(1, 0x1e2d45);
            const iconT = this.add.text(-(panelW / 2) + 28, rowY, row.icon, { fontSize: "17px" }).setOrigin(0.5);
            const lblT = this.add.text(-(panelW / 2) + 54, rowY - 7, row.label, { fontSize: "9px", color: "#64748b", fontFamily: "'Courier New', monospace", letterSpacing: 2 }).setOrigin(0, 0.5);
            const valT = this.add.text(-(panelW / 2) + 54, rowY + 8, row.value, { fontSize: "13px", color: row.color, fontFamily: "'Courier New', monospace", fontStyle: "bold" }).setOrigin(0, 0.5);
            c.add([rowBg, iconT, lblT, valT]);
        });
        const dismissTxt = this.add.text(0, panelH / 2 - 14, "[ TAP TO DISMISS ]", { fontSize: "9px", color: "#2d3a4a", fontFamily: "'Courier New', monospace", letterSpacing: 2 }).setOrigin(0.5);
        c.add(dismissTxt);
        this.nightResultOverlay = c;
        this.tweens.add({ targets: c, alpha: 1, duration: 420, ease: "Back.easeOut" });
        const dismiss = () => this.tweens.add({ targets: c, alpha: 0, y: c.y - 12, duration: 320, onComplete: () => { c.destroy(); if (this.nightResultOverlay === c) this.nightResultOverlay = undefined; } });
        this.time.delayedCall(8000, dismiss);
        c.setInteractive(new Phaser.Geom.Rectangle(-panelW / 2, -panelH / 2, panelW, panelH), Phaser.Geom.Rectangle.Contains);
        c.on("pointerdown", dismiss);
    }

    private showMobileNightResult(rows: Array<{ icon: string; label: string; value: string; color: string }>) {
        document.getElementById("mobile-night-result")?.remove();
        const banner = document.createElement("div");
        banner.id = "mobile-night-result";
        Object.assign(banner.style, {
            position: "fixed", top: "70px", left: "10px", right: "10px",
            zIndex: "600", padding: "16px",
            backgroundColor: "#0a0d13", border: "1px solid #a855f7",
            borderRadius: "10px", fontFamily: "'Courier New', monospace",
            boxShadow: "0 0 30px rgba(168,85,247,0.3)",
        });

        const titleEl = document.createElement("div");
        titleEl.textContent = "🌙  NIGHT RESULTS";
        Object.assign(titleEl.style, { color: "#c084fc", fontSize: "12px", letterSpacing: "3px", fontWeight: "bold", marginBottom: "12px" });
        banner.appendChild(titleEl);

        rows.forEach(row => {
            const rowEl = document.createElement("div");
            Object.assign(rowEl.style, {
                display: "flex", alignItems: "center", gap: "10px",
                padding: "8px 10px", borderRadius: "4px",
                backgroundColor: "rgba(13,15,24,0.8)",
                border: "1px solid #1e2d45", marginBottom: "6px",
            });
            rowEl.innerHTML = `
                <span style="font-size:18px">${row.icon}</span>
                <div>
                    <div style="color:#64748b;font-size:9px;letter-spacing:2px">${row.label}</div>
                    <div style="color:${row.color};font-size:13px;font-weight:bold">${row.value}</div>
                </div>
            `;
            banner.appendChild(rowEl);
        });

        const dismissHint = document.createElement("div");
        dismissHint.textContent = "TAP TO DISMISS";
        Object.assign(dismissHint.style, { color: "#2d3a4a", fontSize: "9px", letterSpacing: "2px", textAlign: "center", marginTop: "10px" });
        banner.appendChild(dismissHint);

        banner.addEventListener("click", () => banner.remove());
        document.body.appendChild(banner);
        setTimeout(() => banner?.remove(), 9000);
    }

    // ══════════════════════════════════════
    //  Detective Result (desktop)
    // ══════════════════════════════════════
    private showDetectiveResult(data: any) {
        const isMafia = data.role === "MAFIA";
        const color = isMafia ? this.C.mafia : this.C.alive;
        const hex = isMafia ? "#f87171" : "#4ade80";

        if (this.isMobile) {
            const rows = [{
                icon: isMafia ? "⚠" : "✓",
                label: "Investigation Result",
                value: `${data.username} is ${data.role || (isMafia ? "MAFIA" : "INNOCENT")}`,
                color: hex,
            }];
            this.showMobileNightResult(rows);
            return;
        }

        const c = this.add.container(this.W / 2, this.H / 2 - 40).setDepth(45).setAlpha(0);
        const bg = this.add.rectangle(0, 0, 360, 88, isMafia ? 0x1a0505 : 0x051a0a); bg.setStrokeStyle(2, color);
        const title = this.add.text(0, -15, isMafia ? "⚠  MAFIA CONFIRMED" : "✓  INNOCENT CITIZEN", { fontSize: "22px", color: hex, fontFamily: "'Courier New', monospace", fontStyle: "bold", letterSpacing: 4 }).setOrigin(0.5);
        const sub = this.add.text(0, 18, data.username, { fontSize: "13px", color: "#94a3b8", fontFamily: "'Courier New', monospace", letterSpacing: 2 }).setOrigin(0.5);
        c.add([bg, title, sub]);
        this.tweens.add({ targets: c, alpha: 1, duration: 400, ease: "Back.easeOut" });
        this.time.delayedCall(6000, () => this.tweens.add({ targets: c, alpha: 0, duration: 400, onComplete: () => c.destroy() }));
    }

    // ══════════════════════════════════════
    //  Phase Transition
    // ══════════════════════════════════════
    private showPhaseTransition(phase: string) {
        const colorMap: Record<string, string> = {
            NIGHT: "#818cf8", DAY: "#fcd34d", VOTING: "#fbbf24", NIGHT_REVIEW: "#c084fc"
        };
        const color = colorMap[phase] || "#f1f5f9";
        const fontSize = this.isMobile ? "44px" : "68px";
        const ov = this.add.text(this.W / 2, this.H / 2, phase, {
            fontSize, color, fontFamily: "'Georgia', serif", fontStyle: "bold",
            letterSpacing: 12, stroke: "#00000088", strokeThickness: 4
        }).setOrigin(0.5).setAlpha(0).setScale(0.7).setDepth(60);
        this.tweens.add({
            targets: ov, alpha: 0.92, scaleX: 1.08, scaleY: 1.08, duration: 550, ease: "Back.easeOut",
            onComplete: () => this.tweens.add({ targets: ov, alpha: 0, scaleX: 1.4, scaleY: 1.4, duration: 650, delay: 1100, onComplete: () => ov.destroy() })
        });
        this.phaseText?.setText(`◉  ${phase}`).setColor(color);
    }

    // ══════════════════════════════════════
    //  Win Overlay
    // ══════════════════════════════════════
    private showWinOverlay(data: any) {
        this.winOverlay?.destroy();
        this.cameras.main.flash(500, data.winner === "MAFIA" ? 100 : 0, data.winner === "MAFIA" ? 0 : 60, 0);

        if (this.isMobile) {
            this.showMobileWinOverlay(data);
        } else {
            this.showDesktopWinOverlay(data);
        }
    }

    private playWinVideo(winner: string, onFinished: () => void) {
        document.getElementById("win-bg-video")?.remove();

        const src = winner === "MAFIA" ? "/mafia-win.mp4" : "/citizens-win.mp4";

        const vid = document.createElement("video");
        vid.id             = "win-bg-video";
        vid.src            = src;
        vid.autoplay       = true;
        vid.loop           = false;   // لا يلف - يشتغل مرة وحدة
        vid.muted          = false;   // مع الصوت
        vid.volume         = 0.9;
        (vid as any).playsInline = true;
        Object.assign(vid.style, {
            position:      "fixed",
            top:           "0", left: "0",
            width:         "100%", height: "100%",
            objectFit:     "cover",
            zIndex:        "99999",
            opacity:       "0",
            transition:    "opacity 0.8s ease",
            pointerEvents: "none",
        });

        // لما يبدأ - يطلع
        vid.addEventListener("canplay", () => {
            vid.style.opacity = "1";
        });

        // لما يخلص - يختفي وتطلع النتائج
        vid.addEventListener("ended", () => {
            vid.style.transition = "opacity 0.6s ease";
            vid.style.opacity    = "0";
            setTimeout(() => {
                vid.remove();
                onFinished();
            }, 650);
        });

        // لو الفيديو قصير جداً أو خطأ - اطلع النتائج بعد 8 ثواني على الأكثر
        const fallback = setTimeout(() => {
            vid.remove();
            onFinished();
        }, 8000);
        vid.addEventListener("ended",   () => clearTimeout(fallback));
        vid.addEventListener("error",   () => { clearTimeout(fallback); onFinished(); });

        document.body.appendChild(vid);
        vid.play().catch(() => {
            // لو بلوك - اطلع النتائج مباشرة
            vid.remove();
            onFinished();
        });
    }

    private showDesktopWinOverlay(data: any) {
        document.getElementById("mobile-win-overlay")?.remove();
        const isMafia = data.winner === "MAFIA";
        const accent  = isMafia ? "#ef4444" : "#22c55e";

        const overlay = document.createElement("div");
        overlay.id = "mobile-win-overlay"; // نفس الـ ID عشان الـ cleanup يشتغل
        Object.assign(overlay.style, {
            position: "fixed", top: "0", left: "0", right: "0", bottom: "0",
            zIndex: "9999", backgroundColor: "rgba(0,0,0,0.65)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "'Courier New', monospace",
        });

        // ─── Main Card ───
        const card = document.createElement("div");
        Object.assign(card.style, {
            width: "820px", maxWidth: "95vw",
            backgroundColor: isMafia ? "rgba(15,5,5,0.98)" : "rgba(5,15,5,0.98)",
            border: `2px solid ${accent}`,
            borderRadius: "12px", overflow: "hidden",
            boxShadow: `0 0 60px ${accent}55`,
        });

        // ─── Header (كامل العرض) ───
        const header = document.createElement("div");
        Object.assign(header.style, {
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "20px 28px", borderBottom: `1px solid ${accent}33`,
        });
        const leftH = document.createElement("div");
        const iconEl = document.createElement("div");
        iconEl.textContent = isMafia ? "🔪" : "👑";
        iconEl.style.cssText = "font-size:36px;margin-bottom:4px";
        const titleEl = document.createElement("div");
        titleEl.textContent = isMafia ? "MAFIA WINS" : "CITIZENS WIN";
        Object.assign(titleEl.style, {
            color: accent, fontSize: "28px", fontWeight: "bold",
            fontFamily: "'Georgia', serif", letterSpacing: "4px",
        });
        leftH.appendChild(iconEl);
        leftH.appendChild(titleEl);

        const rightH = document.createElement("div");
        rightH.style.cssText = "text-align:right";
        const durEl = document.createElement("div");
        durEl.textContent = data.duration || "";
        durEl.style.cssText = `color:${accent};font-size:20px;font-weight:bold`;
        const roundsEl = document.createElement("div");
        roundsEl.textContent = `${data.rounds || 1} ROUNDS`;
        roundsEl.style.cssText = "color:#475569;font-size:11px;letter-spacing:2px;margin-top:4px";
        rightH.appendChild(durEl);
        rightH.appendChild(roundsEl);
        header.appendChild(leftH);
        header.appendChild(rightH);

        // ─── Body: 3 columns ───
        const body = document.createElement("div");
        Object.assign(body.style, {
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
            gap: "0", minHeight: "300px",
        });

        const roleColors: Record<string, string> = {
            MAFIA: "#ef4444", DOCTOR: "#22c55e",
            DETECTIVE: "#3b82f6", CITIZEN: "#94a3b8", ADMIN: "#f59e0b",
        };

        const makePanelHeader = (label: string) => {
            const el = document.createElement("div");
            el.textContent = label;
            Object.assign(el.style, {
                color: "#475569", fontSize: "10px", letterSpacing: "3px",
                padding: "12px 16px 8px", borderBottom: `1px solid ${accent}22`,
            });
            return el;
        };

        // ─── Column 1: Players ───
        const col1 = document.createElement("div");
        col1.style.cssText = `border-right:1px solid ${accent}22;overflow-y:auto;max-height:340px`;
        col1.appendChild(makePanelHeader("PLAYERS"));
        const col1content = document.createElement("div");
        col1content.style.cssText = "padding:10px";
        (data.roles || []).forEach((r: any) => {
            const row = document.createElement("div");
            Object.assign(row.style, {
                display: "flex", alignItems: "center", gap: "8px",
                padding: "6px 8px", marginBottom: "5px",
                backgroundColor: "rgba(255,255,255,0.03)",
                borderRadius: "6px",
                opacity: r.alive === false ? "0.45" : "1",
            });
            const av = document.createElement("div");
            Object.assign(av.style, {
                width: "30px", height: "30px", borderRadius: "50%",
                backgroundColor: r.color || "#1e293b",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "16px", flexShrink: "0",
                border: `2px solid ${roleColors[r.role] || "#94a3b8"}`,
            });
            av.textContent = r.avatar || "😎";
            const nameEl = document.createElement("span");
            nameEl.textContent = r.username;
            nameEl.style.cssText = "color:#e2e8f0;font-size:12px;font-weight:bold;flex:1";
            const roleEl = document.createElement("span");
            roleEl.textContent = r.role;
            roleEl.style.cssText = `color:${roleColors[r.role] || "#94a3b8"};font-size:9px;letter-spacing:2px`;
            row.appendChild(av); row.appendChild(nameEl); row.appendChild(roleEl);
            col1content.appendChild(row);
        });
        col1.appendChild(col1content);

        // ─── Column 2: Stats ───
        const col2 = document.createElement("div");
        col2.style.cssText = `border-right:1px solid ${accent}22`;
        col2.appendChild(makePanelHeader("STATS"));
        const col2content = document.createElement("div");
        col2content.style.cssText = "padding:10px";
        const kills     = (data.nightKills || []).filter((k: any) => !k.saved).length;
        const saves     = (data.nightKills || []).filter((k: any) => k.saved).length;
        const eliminated = (data.votingEliminations || []).filter((v: any) => !v.tie).length;
        const ties      = (data.votingEliminations || []).filter((v: any) => v.tie).length;
        const makeStatDesktop = (label: string, value: string, color = "#94a3b8") => {
            const row = document.createElement("div");
            Object.assign(row.style, {
                display: "flex", justifyContent: "space-between",
                padding: "8px 10px", marginBottom: "5px",
                backgroundColor: "rgba(255,255,255,0.02)", borderRadius: "5px",
            });
            const l = document.createElement("span");
            l.textContent = label;
            l.style.cssText = "color:#475569;font-size:10px;letter-spacing:1px";
            const v = document.createElement("span");
            v.textContent = value;
            v.style.cssText = `color:${color};font-size:13px;font-weight:bold`;
            row.appendChild(l); row.appendChild(v);
            return row;
        };
        col2content.appendChild(makeStatDesktop("WINNER",        isMafia ? "🔪 MAFIA" : "👑 CITIZENS", accent));
        col2content.appendChild(makeStatDesktop("ROUNDS",        `${data.rounds || 1}`, "#e2e8f0"));
        col2content.appendChild(makeStatDesktop("DURATION",      data.duration || "—", "#e2e8f0"));
        col2content.appendChild(makeStatDesktop("NIGHT KILLS",   `${kills}`, "#ef4444"));
        col2content.appendChild(makeStatDesktop("DOCTOR SAVES",  `${saves}`, "#22c55e"));
        col2content.appendChild(makeStatDesktop("VOTED OUT",     `${eliminated}`, "#f59e0b"));
        col2content.appendChild(makeStatDesktop("VOTE TIES",     `${ties}`, "#64748b"));
        col2.appendChild(col2content);

        // ─── Column 3: Timeline ───
        const col3 = document.createElement("div");
        col3.style.cssText = "overflow-y:auto;max-height:340px";
        col3.appendChild(makePanelHeader("TIMELINE"));
        const col3content = document.createElement("div");
        col3content.style.cssText = "padding:10px";
        const typeColors: Record<string, string> = {
            kill: "#ef4444", save: "#22c55e", vote: "#f59e0b", tie: "#475569", quiet: "#1e3a5f",
        };
        (data.gameLog || []).forEach((entry: any) => {
            const row = document.createElement("div");
            Object.assign(row.style, {
                display: "flex", gap: "8px", padding: "7px 8px", marginBottom: "5px",
                backgroundColor: "rgba(255,255,255,0.02)", borderRadius: "5px",
                borderLeft: `2px solid ${typeColors[entry.type] || "#1e3a5f"}`,
            });
            const iconEl = document.createElement("span");
            iconEl.textContent = entry.icon || "•";
            iconEl.style.cssText = "font-size:12px;flex-shrink:0";
            const textEl = document.createElement("div");
            const roundEl = document.createElement("div");
            roundEl.textContent = `R${entry.round}`;
            roundEl.style.cssText = "color:#374151;font-size:9px;letter-spacing:1px";
            const msgEl = document.createElement("div");
            msgEl.textContent = entry.text;
            msgEl.style.cssText = "color:#94a3b8;font-size:10px;line-height:1.4;margin-top:1px";
            textEl.appendChild(roundEl); textEl.appendChild(msgEl);
            row.appendChild(iconEl); row.appendChild(textEl);
            col3content.appendChild(row);
        });
        col3.appendChild(col3content);

        body.appendChild(col1);
        body.appendChild(col2);
        body.appendChild(col3);

        // ─── Footer ───
        const footer = document.createElement("div");
        footer.textContent = "Waiting for admin to start new game...";
        Object.assign(footer.style, {
            textAlign: "center", padding: "10px",
            color: "#374151", fontSize: "10px", letterSpacing: "1px",
            borderTop: `1px solid ${accent}22`,
        });

        card.appendChild(header);
        card.appendChild(body);
        card.appendChild(footer);
        overlay.appendChild(card);
        document.body.appendChild(overlay);
    }

    private showMobileWinOverlay(data: any) {
        document.getElementById("mobile-win-overlay")?.remove();
        const isMafia    = data.winner === "MAFIA";
        const accent     = isMafia ? "#ef4444" : "#22c55e";
        const bgColor    = isMafia ? "rgba(15,5,5,0.98)" : "rgba(5,15,5,0.98)";

        const overlay = document.createElement("div");
        overlay.id = "mobile-win-overlay";
        Object.assign(overlay.style, {
            position: "fixed", top: "0", left: "0", right: "0", bottom: "0",
            zIndex: "9999", backgroundColor: "rgba(0,0,0,0.95)",
            display: "flex", flexDirection: "column",
            alignItems: "center", overflowY: "auto",
            fontFamily: "'Courier New', monospace",
            padding: "16px",
        });

        // ─── Card ───
        const card = document.createElement("div");
        Object.assign(card.style, {
            width: "100%", maxWidth: "420px",
            backgroundColor: bgColor,
            border: `2px solid ${accent}`,
            borderRadius: "12px",
            boxShadow: `0 0 40px ${accent}44`,
            overflow: "hidden",
            marginTop: "8px",
        });

        // ─── Header ───
        const header = document.createElement("div");
        Object.assign(header.style, {
            textAlign: "center", padding: "20px 16px 12px",
            borderBottom: `1px solid ${accent}33`,
        });
        const icon  = document.createElement("div");
        icon.textContent  = isMafia ? "🔪" : "👑";
        icon.style.cssText = "font-size:44px;margin-bottom:8px";
        const title = document.createElement("div");
        title.textContent = isMafia ? "MAFIA WINS" : "CITIZENS WIN";
        Object.assign(title.style, {
            color: accent, fontSize: "22px", fontWeight: "bold",
            fontFamily: "'Georgia', serif", letterSpacing: "4px",
        });
        const sub = document.createElement("div");
        sub.textContent = `${data.rounds || 1} round${(data.rounds || 1) > 1 ? "s" : ""} · ${data.duration || ""}`;
        sub.style.cssText = `color:#475569;font-size:11px;margin-top:4px;letter-spacing:1px`;
        header.appendChild(icon);
        header.appendChild(title);
        header.appendChild(sub);

        // ─── Tabs ───
        const tabBar = document.createElement("div");
        Object.assign(tabBar.style, {
            display: "flex", borderBottom: `1px solid ${accent}33`,
        });

        const tabContents: Record<string, HTMLElement> = {};

        const createTab = (id: string, label: string) => {
            const btn = document.createElement("button");
            btn.textContent = label;
            Object.assign(btn.style, {
                flex: "1", padding: "10px 0",
                background: "none", border: "none",
                color: "#475569", fontSize: "11px",
                letterSpacing: "2px", cursor: "pointer",
                fontFamily: "'Courier New', monospace",
                transition: "all 0.15s",
            });
            const content = document.createElement("div");
            content.style.cssText = "display:none;padding:14px";
            tabContents[id] = content;

            btn.addEventListener("click", () => {
                Object.keys(tabContents).forEach(k => {
                    tabContents[k].style.display = "none";
                });
                tabBar.querySelectorAll("button").forEach((b: any) => {
                    b.style.color = "#475569";
                    b.style.borderBottom = "2px solid transparent";
                });
                content.style.display = "block";
                btn.style.color = accent;
                btn.style.borderBottom = `2px solid ${accent}`;
            });
            tabBar.appendChild(btn);
            return btn;
        };

        const rolesBtn    = createTab("roles",    "PLAYERS");
        const statsBtn    = createTab("stats",    "STATS");
        const timelineBtn = createTab("timeline", "TIMELINE");

        // ─── Tab: PLAYERS ───
        const roleColors: Record<string, string> = {
            MAFIA: "#ef4444", DOCTOR: "#22c55e",
            DETECTIVE: "#3b82f6", CITIZEN: "#94a3b8", ADMIN: "#f59e0b",
        };
        if (data.roles?.length) {
            data.roles.forEach((r: any) => {
                const row = document.createElement("div");
                Object.assign(row.style, {
                    display: "flex", alignItems: "center", gap: "10px",
                    padding: "8px 10px", marginBottom: "6px",
                    backgroundColor: "rgba(255,255,255,0.03)",
                    borderRadius: "8px",
                    border: `1px solid ${r.alive === false ? "#1f2937" : "rgba(255,255,255,0.05)"}`,
                    opacity: r.alive === false ? "0.55" : "1",
                });

                // avatar circle
                const avatarEl = document.createElement("div");
                Object.assign(avatarEl.style, {
                    width: "34px", height: "34px", borderRadius: "50%",
                    backgroundColor: r.color || "#1e293b",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "18px", flexShrink: "0",
                    border: `2px solid ${roleColors[r.role] || "#94a3b8"}`,
                });
                avatarEl.textContent = r.avatar || "😎";

                const nameEl = document.createElement("span");
                nameEl.textContent = r.username;
                nameEl.style.cssText = "color:#e2e8f0;font-size:13px;font-weight:bold;flex:1";

                const roleEl = document.createElement("span");
                roleEl.textContent = r.role;
                roleEl.style.cssText = `color:${roleColors[r.role] || "#94a3b8"};font-size:10px;letter-spacing:2px`;

                const deadEl = document.createElement("span");
                deadEl.textContent = r.alive === false ? "☠" : "";
                deadEl.style.cssText = "color:#374151;font-size:14px";

                row.appendChild(avatarEl);
                row.appendChild(nameEl);
                row.appendChild(roleEl);
                row.appendChild(deadEl);
                tabContents["roles"].appendChild(row);
            });
        }

        // ─── Tab: STATS ───
        const makeStatRow = (label: string, value: string, color = "#94a3b8") => {
            const row = document.createElement("div");
            Object.assign(row.style, {
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 12px", marginBottom: "6px",
                backgroundColor: "rgba(255,255,255,0.03)",
                borderRadius: "6px", border: "1px solid rgba(255,255,255,0.04)",
            });
            const lbl = document.createElement("span");
            lbl.textContent = label;
            lbl.style.cssText = "color:#475569;font-size:11px;letter-spacing:1px";
            const val = document.createElement("span");
            val.textContent = value;
            val.style.cssText = `color:${color};font-size:13px;font-weight:bold`;
            row.appendChild(lbl); row.appendChild(val);
            return row;
        };

        const kills     = (data.nightKills || []).filter((k: any) => !k.saved).length;
        const saves     = (data.nightKills || []).filter((k: any) => k.saved).length;
        const eliminated = (data.votingEliminations || []).filter((v: any) => !v.tie).length;
        const ties      = (data.votingEliminations || []).filter((v: any) => v.tie).length;

        tabContents["stats"].appendChild(makeStatRow("WINNER",          isMafia ? "🔪 MAFIA" : "👑 CITIZENS", accent));
        tabContents["stats"].appendChild(makeStatRow("ROUNDS PLAYED",   `${data.rounds || 1}`, "#e2e8f0"));
        tabContents["stats"].appendChild(makeStatRow("GAME DURATION",   data.duration || "—", "#e2e8f0"));
        tabContents["stats"].appendChild(makeStatRow("NIGHT KILLS",     `${kills}`, "#ef4444"));
        tabContents["stats"].appendChild(makeStatRow("DOCTOR SAVES",    `${saves}`, "#22c55e"));
        tabContents["stats"].appendChild(makeStatRow("VOTED OUT",       `${eliminated}`, "#f59e0b"));
        tabContents["stats"].appendChild(makeStatRow("VOTE TIES",       `${ties}`, "#64748b"));

        // ─── Tab: TIMELINE ───
        if (data.gameLog?.length) {
            data.gameLog.forEach((entry: any) => {
                const row = document.createElement("div");
                Object.assign(row.style, {
                    display: "flex", alignItems: "flex-start", gap: "10px",
                    padding: "8px 10px", marginBottom: "6px",
                    backgroundColor: "rgba(255,255,255,0.02)",
                    borderRadius: "6px", borderLeft: "2px solid",
                });
                const typeColors: Record<string, string> = {
                    kill: "#ef4444", save: "#22c55e",
                    vote: "#f59e0b", tie: "#475569", quiet: "#1e3a5f",
                };
                row.style.borderLeftColor = typeColors[entry.type] || "#1e3a5f";

                const iconEl = document.createElement("span");
                iconEl.textContent = entry.icon || "•";
                iconEl.style.cssText = "font-size:14px;flex-shrink:0;margin-top:1px";

                const textEl = document.createElement("div");
                const roundLabel = document.createElement("div");
                roundLabel.textContent = `ROUND ${entry.round}`;
                roundLabel.style.cssText = "color:#374151;font-size:9px;letter-spacing:1px;margin-bottom:2px";
                const msgEl = document.createElement("div");
                msgEl.textContent = entry.text;
                msgEl.style.cssText = "color:#94a3b8;font-size:11px;line-height:1.4";

                textEl.appendChild(roundLabel);
                textEl.appendChild(msgEl);
                row.appendChild(iconEl);
                row.appendChild(textEl);
                tabContents["timeline"].appendChild(row);
            });
        } else {
            const empty = document.createElement("div");
            empty.textContent = "No events recorded";
            empty.style.cssText = "color:#374151;font-size:12px;text-align:center;padding:20px";
            tabContents["timeline"].appendChild(empty);
        }

        // ─── Footer ───
        const footer = document.createElement("div");
        Object.assign(footer.style, {
            textAlign: "center", padding: "12px",
            borderTop: `1px solid ${accent}22`,
        });
        const waitEl = document.createElement("div");
        waitEl.textContent = "Waiting for admin to start new game...";
        waitEl.style.cssText = "color:#374151;font-size:10px;letter-spacing:1px";
        footer.appendChild(waitEl);

        // ─── Assemble ───
        card.appendChild(header);
        card.appendChild(tabBar);
        Object.values(tabContents).forEach(tc => card.appendChild(tc));
        card.appendChild(footer);
        overlay.appendChild(card);
        document.body.appendChild(overlay);

        // فعّل PLAYERS tab افتراضياً
        rolesBtn.click();
    }

    // ══════════════════════════════════════
    //  Admin Controls (Desktop)
    // ══════════════════════════════════════
    private createAdminToggleBtn() {
        this.adminToggleBtn = document.createElement("button");
        this.adminToggleBtn.id = "admin-toggle-btn";
        this.adminToggleBtn.innerHTML = "⚙  CONTROL PANEL";
        Object.assign(this.adminToggleBtn.style, {
            position: "absolute", right: "16px", top: "10px",
            padding: "8px 20px", fontSize: "12px",
            fontFamily: "'Courier New', monospace", fontWeight: "bold", letterSpacing: "2px",
            color: "#f59e0b", backgroundColor: "#0d0f14",
            border: "1px solid #f59e0b", borderRadius: "4px",
            cursor: "pointer", zIndex: "9999999",
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
            zIndex: "999999", overflowY: "auto",
            transition: "right 0.35s cubic-bezier(0.4,0,0.2,1)",
            fontFamily: "'Courier New', monospace",
            display: "flex", flexDirection: "column",
        });
        drawer.innerHTML = `
        <style>
            .adr-header{padding:20px 24px 18px;border-bottom:1px solid rgba(30,45,69,0.6);display:flex;align-items:center;justify-content:space-between}
            .adr-title{font-size:13px;color:#f59e0b;letter-spacing:3px;font-weight:bold}
            .adr-close{background:transparent;border:1px solid #1e2d45;color:#64748b;width:32px;height:32px;border-radius:4px;font-size:14px;cursor:pointer}
            .adr-section{padding:20px 24px;border-bottom:1px solid rgba(30,45,69,0.4)}
            .adr-section-title{font-size:9px;color:#3b82f6;letter-spacing:3px;font-weight:bold;margin-bottom:14px}
            .adr-btn-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
            .adr-btn{padding:14px 10px;border-radius:5px;border:1px solid;background:transparent;font-family:'Courier New',monospace;font-size:11px;font-weight:bold;letter-spacing:1px;cursor:pointer}
            .adr-btn-night{color:#818cf8;border-color:#6366f1}.adr-btn-day{color:#fcd34d;border-color:#fbbf24}
            .adr-btn-vote{color:#fbbf24;border-color:#f59e0b}.adr-btn-stopvote{color:#94a3b8;border-color:#4b5563}
            .adr-btn-danger{color:#f87171;border-color:#ef4444;grid-column:1/-1}
            .adr-btn-restart{color:#60a5fa;border-color:#3b82f6;grid-column:1/-1}
            .nr-grid{display:grid;grid-template-columns:auto 1fr;gap:0;background:#0a0e14;border:1px solid #1e2d45;border-radius:6px;overflow:hidden}
            .nr-cell{padding:12px 16px;font-size:12px;border-bottom:1px solid rgba(30,45,69,0.4)}
            .nr-cell:nth-last-child(-n+2){border-bottom:none}
            .nr-label{color:#64748b}.nr-value{font-weight:bold}
            .adr-story-textarea{width:100%;box-sizing:border-box;min-height:100px;background:#0a0e14;color:#e2e8f0;border:1px solid #1e2d45;border-radius:5px;padding:12px;font-family:'Courier New',monospace;font-size:13px;resize:vertical;outline:none}
            .adr-reveal-btn{width:100%;margin-top:10px;padding:12px;background:transparent;color:#c084fc;border:1px solid #a855f7;border-radius:5px;font-family:'Courier New',monospace;font-size:13px;font-weight:bold;cursor:pointer}
            .ns-row{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid rgba(30,45,69,0.4);font-size:12px}
            .ns-row:last-child{border-bottom:none}
            .ns-label{color:#64748b;letter-spacing:1px}
        </style>
        <div class="adr-header">
            <div class="adr-title">👑  ADMIN  CONTROL  PANEL</div>
            <button class="adr-close" id="adr-close-btn">✕</button>
        </div>
        <div class="adr-section">
            <div class="adr-section-title">Phase Controls</div>
            <div class="adr-btn-grid">
                <button class="adr-btn adr-btn-night"    data-event="admin_start_night">🌙 START NIGHT</button>
                <button class="adr-btn adr-btn-day"      data-event="admin_end_night">☀ END NIGHT</button>
                <button class="adr-btn adr-btn-vote"     data-event="admin_start_voting">🗳 START VOTING</button>
                <button class="adr-btn adr-btn-stopvote" data-event="admin_end_voting">⏹ END VOTING</button>
                <button class="adr-btn adr-btn-danger"   data-event="admin_end_game">⚡ FORCE END</button>
                <button class="adr-btn adr-btn-restart"  data-event="restart_game">🔄 RESTART</button>
            </div>
        </div>
        <div class="adr-section" id="adr-status-section" style="display:none">
            <div class="adr-section-title" style="color:#60a5fa">🌙 Night Actions</div>
            <div style="background:#0a0e14;border:1px solid #1e2d45;border-radius:6px;overflow:hidden" id="adr-night-status">
                <div class="ns-row"><span class="ns-label">🔪 Mafia</span><span style="color:#374151">⏳ Waiting...</span></div>
                <div class="ns-row"><span class="ns-label">✚ Doctor</span><span style="color:#374151">⏳ Waiting...</span></div>
                <div class="ns-row"><span class="ns-label">🔍 Detective</span><span style="color:#374151">⏳ Waiting...</span></div>
            </div>
        </div>
        <div class="adr-section" id="adr-night-section" style="display:none">
            <div class="adr-section-title" style="color:#a855f7">🌙 Night Results</div>
            <div class="nr-grid" id="adr-night-grid"></div>
        </div>
        <div class="adr-section" id="adr-story-section" style="display:none">
            <div class="adr-section-title" style="color:#a855f7">📖 Tonight's Story</div>
            <textarea class="adr-story-textarea" id="adr-story-input" placeholder="Write what happened tonight..."></textarea>
            <button class="adr-reveal-btn" id="adr-reveal-btn">📢 REVEAL STORY TO ALL</button>
        </div>`;

        document.body.appendChild(drawer);
        this.adminDrawer = drawer;

        drawer.querySelectorAll<HTMLButtonElement>(".adr-btn[data-event]").forEach(btn => {
            btn.addEventListener("click", () => socketService.socket.emit(btn.dataset.event!));
        });
        drawer.querySelector("#adr-close-btn")?.addEventListener("click", () => this.closeAdminDrawer());
        drawer.querySelector("#adr-reveal-btn")?.addEventListener("click", () => {
            const ta = drawer.querySelector<HTMLTextAreaElement>("#adr-story-input");
            const story = ta?.value.trim() || "The night passed in silence...";
            socketService.socket.emit("admin_reveal_night_results", story);
            (drawer.querySelector("#adr-night-section") as HTMLElement).style.display = "none";
            (drawer.querySelector("#adr-story-section") as HTMLElement).style.display = "none";
        });
        this.outsideClickHandler = (e: MouseEvent) => {
            if (!this.adminDrawerOpen) return;
            const t = e.target as HTMLElement;
            if (this.adminDrawer?.contains(t) || this.adminToggleBtn?.contains(t)) return;
            this.closeAdminDrawer();
        };
        document.addEventListener("click", this.outsideClickHandler);
    }

    // ══════════════════════════════════════
    //  Mobile Admin Buttons
    // ══════════════════════════════════════
    private createMobileAdminButtons() {
        const adminBar = document.createElement("div");
        adminBar.id = "mobile-admin-bar";
        Object.assign(adminBar.style, {
            position: "fixed", bottom: "0", left: "0", right: "0",
            zIndex: "200", backgroundColor: "#080c12",
            borderTop: "1px solid rgba(245,158,11,0.3)",
            padding: "8px", display: "flex", flexWrap: "wrap", gap: "6px",
        });

        const adminBtns = [
            { label: "🌙 NIGHT",   event: "admin_start_night" },
            { label: "☀ DAY",     event: "admin_end_night"   },
            { label: "🗳 VOTE",   event: "admin_start_voting"},
            { label: "⏹ STOP",   event: "admin_end_voting"  },
            { label: "⚡ END",    event: "admin_end_game"    },
            { label: "🔄 RESTART",event: "restart_game"      },
        ];

        adminBtns.forEach(b => {
            const btn = document.createElement("button");
            btn.textContent = b.label;
            Object.assign(btn.style, {
                padding: "8px 10px", fontSize: "10px", fontWeight: "bold",
                fontFamily: "'Courier New', monospace", letterSpacing: "1px",
                border: "1px solid #f59e0b", borderRadius: "4px",
                backgroundColor: "transparent", color: "#f59e0b",
                cursor: "pointer", flex: "1",
            });
            btn.addEventListener("click", () => socketService.socket.emit(b.event));
            adminBar.appendChild(btn);
        });

        document.body.appendChild(adminBar);
    }

    private toggleAdminDrawer() {
        this.adminDrawerOpen = !this.adminDrawerOpen;
        if (this.adminDrawer) this.adminDrawer.style.right = this.adminDrawerOpen ? "0" : "-520px";
        if (this.adminToggleBtn) {
            this.adminToggleBtn.innerHTML = this.adminDrawerOpen ? "✕  CLOSE" : "⚙  CONTROL PANEL";
            this.adminToggleBtn.style.color = this.adminDrawerOpen ? "#ef4444" : "#f59e0b";
            this.adminToggleBtn.style.borderColor = this.adminDrawerOpen ? "#ef4444" : "#f59e0b";
        }
    }

    private closeAdminDrawer() {
        this.adminDrawerOpen = false;
        if (this.adminDrawer) this.adminDrawer.style.right = "-520px";
        if (this.adminToggleBtn) { this.adminToggleBtn.innerHTML = "⚙  CONTROL PANEL"; this.adminToggleBtn.style.color = "#f59e0b"; this.adminToggleBtn.style.borderColor = "#f59e0b"; }
    }

    private updateAdminDrawerPhase(phase: string) {
        if (!this.isAdmin || !this.adminDrawer) return;
        // noop for mobile admin bar, can add phase display if needed
    }

    private updateNightActionStatus(status: any) {
        if (!this.adminDrawer) return;
        const statusEl = this.adminDrawer.querySelector<HTMLElement>("#adr-night-status");
        if (!statusEl) return;

        const render = (done: boolean, username: string | null) =>
            done
                ? `<span style="color:#4ade80">✓ ${username}</span>`
                : `<span style="color:#374151">⏳ Waiting...</span>`;

        statusEl.innerHTML = `
            <div class="ns-row"><span class="ns-label">🔪 Mafia</span>${render(status.mafia.done, status.mafia.username)}</div>
            <div class="ns-row"><span class="ns-label">✚ Doctor</span>${render(status.doctor.done, status.doctor.username)}</div>
            <div class="ns-row"><span class="ns-label">🔍 Detective</span>${render(status.detective.done, status.detective.username)}</div>
        `;

        // نظهر الـ section تلقائياً لو كان مخفي
        const section = this.adminDrawer.querySelector<HTMLElement>("#adr-status-section");
        if (section) section.style.display = "block";
    }

    private showNightReviewInDrawer(data: any) {
        if (!this.isAdmin || !this.adminDrawer) return;
        const mafiaTarget = this.currentPlayers.find(p => p.id === data.mafiaTarget);
        const doctorSave  = this.currentPlayers.find(p => p.id === data.doctorSave);
        const victim      = this.currentPlayers.find(p => p.id === data.finalVictim);
        const grid = this.adminDrawer.querySelector<HTMLElement>("#adr-night-grid");
        if (grid) {
            grid.innerHTML = `
                <span class="nr-cell nr-label">🔪 Mafia Target</span><span class="nr-cell nr-value" style="color:#f87171">${mafiaTarget?.username || "—"}</span>
                <span class="nr-cell nr-label">✚ Doctor Saved</span><span class="nr-cell nr-value" style="color:#4ade80">${doctorSave?.username || "—"}</span>
                <span class="nr-cell nr-label">☠ Final Victim</span><span class="nr-cell nr-value" style="color:${victim ? "#f87171" : "#4ade80"}">${victim ? victim.username : "Protected ✓"}</span>`;
        }
        (this.adminDrawer.querySelector("#adr-night-section") as HTMLElement).style.display = "block";
        (this.adminDrawer.querySelector("#adr-story-section") as HTMLElement).style.display = "block";
        const ta = this.adminDrawer.querySelector<HTMLTextAreaElement>("#adr-story-input");
        if (ta) ta.value = "";
        if (!this.adminDrawerOpen) this.toggleAdminDrawer();
    }

    // ══════════════════════════════════════
    //  Socket Listeners
    // ══════════════════════════════════════
    private setupSocketListeners() {
        const evts = [
            "room_state", "phase_changed", "game_over", "game_started",
            "vote_update", "player_killed", "receive_message",
            "detective_result", "voting_result", "voting_started",
            "night_review", "night_story", "back_to_lobby", "night_action_status"
        ];
        evts.forEach(e => socketService.socket.off(e));

        socketService.socket.on("room_state", (data: any) => {
            this.roundText?.setText(`ROUND ${data.round}`);
            const colorMap: Record<string, string> = {
                NIGHT: "#818cf8", DAY: "#fcd34d", VOTING: "#fbbf24",
                NIGHT_REVIEW: "#c084fc", WAITING: "#64748b"
            };
            this.phaseText?.setText(`◉  ${data.phase}`).setColor(colorMap[data.phase] || "#64748b");
            this.drawPlayers(data.players, data.phase);
            this.updateChatUI(data.phase);

            if (data.phase === "NIGHT" && !this.isAdmin && !this.isNightSceneActive) {
                const nightSceneMap: Record<string, string> = {
                    MAFIA: "MafiaNightScene", DOCTOR: "DoctorNightScene", DETECTIVE: "DetectiveNightScene",
                };
                const targetScene = nightSceneMap[this.role];
                if (targetScene) {
                    this.isNightSceneActive = true;
                    this.cameras.main.fadeOut(500, 10, 13, 19);
                    this.time.delayedCall(500, () => this.scene.start(targetScene, { roomId: this.roomId, players: data.players }));
                    return;
                }
            }
        });

        socketService.socket.on("phase_changed", (data: any) => {
            const nightSceneMap: Record<string, string> = {
                MAFIA: "MafiaNightScene", DOCTOR: "DoctorNightScene", DETECTIVE: "DetectiveNightScene",
            };
            if (data.phase === "NIGHT" && !this.isAdmin) {
                const targetScene = nightSceneMap[this.role];
                if (targetScene) {
                    if (this.isNightSceneActive) return;
                    this.isNightSceneActive = true;
                    this.cameras.main.fadeOut(500, 10, 13, 19);
                    this.time.delayedCall(500, () => this.scene.start(targetScene, { roomId: this.roomId, players: this.currentPlayers }));
                    return;
                }
            }
            // reset حالة الـ night actions للأدمن عند بداية الليل
            if (data.phase === "NIGHT" && this.isAdmin && this.adminDrawer) {
                const statusEl = this.adminDrawer.querySelector<HTMLElement>("#adr-night-status");
                if (statusEl) {
                    statusEl.innerHTML = `
                        <div class="ns-row"><span class="ns-label">🔪 Mafia</span><span style="color:#374151">⏳ Waiting...</span></div>
                        <div class="ns-row"><span class="ns-label">✚ Doctor</span><span style="color:#374151">⏳ Waiting...</span></div>
                        <div class="ns-row"><span class="ns-label">🔍 Detective</span><span style="color:#374151">⏳ Waiting...</span></div>
                    `;
                }
                const section = this.adminDrawer.querySelector<HTMLElement>("#adr-status-section");
                if (section) section.style.display = "block";
            }
            if (data.phase !== "NIGHT") this.isNightSceneActive = false;
            this.showPhaseTransition(data.phase);
            this.roundText?.setText(`ROUND ${data.round}`);
            this.updateChatUI(data.phase);
            socketService.socket.emit("request_room_state");
        });

        socketService.socket.on("voting_started", () => {
            this.showPhaseTransition("VOTING");
            socketService.socket.emit("request_room_state");
            const myPlayer = this.currentPlayers.find(p => p.id === socketService.socket.id);
            const isAlivePlayer = myPlayer?.alive && this.userType === "PLAYER" && !this.isAdmin;
            if (isAlivePlayer) {
                this.time.delayedCall(300, () => {
                    if (this.isMobile) this.showMobileVoting();
                    else this.showVotingOverlay();
                });
            }
        });

        socketService.socket.on("vote_update", (v: any) => {
            this.updateVotes(v);
        });

        socketService.socket.on("voting_result", (data: any) => {
            const msg = data.tie ? "TIE — no one eliminated" : `${data.eliminated} was eliminated by vote`;
            this.addEventLog(msg, data.tie ? "#fbbf24" : "#f87171");
            this.cameras.main.shake(data.tie ? 150 : 350, 0.006);
            this.closeVotingOverlay(true, { eliminated: data.eliminated, tie: data.tie });
        });

        socketService.socket.on("player_killed", (data: any) => {
            this.addEventLog(`${data.username} was killed in the night`, "#f87171");
            this.cameras.main.shake(250, 0.006);
        });

        socketService.socket.on("detective_result", (data: any) => this.showDetectiveResult(data));

        socketService.socket.on("receive_message", (data: any) => {
            this.addChatMessage(data.username, data.message, data.alive);
        });

        socketService.socket.on("night_review", (data: any) => {
            // night_review بوصل للأدمن بس — الـ clients ما يشوفوا النتائج
            if (this.isAdmin) {
                this.showNightReviewInDrawer(data);
            }
        });

        socketService.socket.on("night_action_status", (status: any) => {
            if (!this.isAdmin) return;
            this.updateNightActionStatus(status);
        });

        socketService.socket.on("night_story", (data: any) => {
            this.addEventLog(`📖  ${data.story}`, "#c084fc");
        });

        socketService.socket.on("game_over", (data: any) => this.showWinOverlay(data));

        socketService.socket.on("back_to_lobby", () => {
            this.winOverlay?.destroy(); this.winOverlay = undefined;
            document.getElementById("mobile-win-overlay")?.remove();
            this.addEventLog("⟳  New game starting...", "#3b82f6");
        });

        socketService.socket.on("game_started", (data: any) => {
            let newUserType = "PLAYER";
            if (data.role === "ADMIN") { newUserType = "ADMIN"; socketService.isAdmin = true; }
            else if (data.role === "SPECTATOR") newUserType = "SPECTATOR";
            this.scene.start("GameScene", { role: data.role, roomId: data.roomId, userType: newUserType });
        });
    }

    // ══════════════════════════════════════
    //  Cleanup
    // ══════════════════════════════════════
    private cleanupAllHTML() {
        document.getElementById("mobile-game-ui")?.remove();
        document.getElementById("mobile-voting-overlay")?.remove();
        document.getElementById("mobile-night-result")?.remove();
        document.getElementById("mobile-win-overlay")?.remove();
        document.getElementById("mobile-admin-bar")?.remove();
        document.getElementById("lobby-username")?.remove();
        document.getElementById("admin-toggle-btn")?.remove();
        document.getElementById("admin-drawer")?.remove();
        document.getElementById("desktop-chat-input")?.remove();
        document.getElementById("desktop-send-btn")?.remove();
        document.getElementById("win-bg-video")?.remove();
        if (this.outsideClickHandler) document.removeEventListener("click", this.outsideClickHandler);
    }

    shutdown() {
        this.cleanupAllHTML();
        this.votingOverlayContainer?.destroy();
        this.nightResultOverlay?.destroy();
        const evts = [
            "room_state", "phase_changed", "game_over", "game_started",
            "vote_update", "player_killed", "receive_message",
            "detective_result", "voting_result", "voting_started",
            "night_review", "night_story", "back_to_lobby", "night_action_status"
        ];
        evts.forEach(e => socketService.socket.off(e));
        this.tweens.killAll();
    }
}