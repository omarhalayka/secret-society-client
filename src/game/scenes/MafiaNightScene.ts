import Phaser from "phaser";
import { socketService } from "../../socket";

// ════════════════════════════════════════════════════════
//  MafiaNightScene — Desktop: Phaser cards | Mobile: HTML overlay
// ════════════════════════════════════════════════════════
export default class MafiaNightScene extends Phaser.Scene {

    private players: any[] = [];
    private roomId!: string;
    private actionUsed: boolean = false;
    private playerCards: Phaser.GameObjects.Container[] = [];
    private killedPlayerId: string | null = null;
    private isMobile: boolean = false;
    private isSoloMafia: boolean = false;
    private myPlayer: any = null;

    // جسيمات الجمر
    private embers: Array<{
        gfx: Phaser.GameObjects.Graphics;
        x: number; y: number; vx: number; vy: number;
        life: number; maxLife: number; size: number;
    }> = [];

    private readonly C = {
        bg: 0x080810, surface: 0x0f0f18, card: 0x130a0a,
        cardHover: 0x1f0f0f, borderDim: 0x2a1515, borderBright: 0xcc2222,
        accent: 0xcc2222, accentGlow: 0xff4444,
    };

    constructor() { super("MafiaNightScene"); }

    init(data: any) {
        this.roomId  = data.roomId;
        this.players = data.players || [];
        this.actionUsed    = false;
        this.killedPlayerId = null;
        this.embers = [];
        this.myPlayer = this.players.find(p => p.id === socketService.socket.id) || null;
        socketService.socket.off("phase_changed");
        socketService.socket.off("player_killed");
        socketService.socket.off("back_to_lobby");
        socketService.socket.off("mafia_suggestion");
        socketService.socket.off("mafia_chat_message");
        socketService.socket.off("server_reset");
    }

    create() {
        document.getElementById("mobile-game-ui")?.remove();
        document.getElementById("mobile-voting-overlay")?.remove();
        document.getElementById("mobile-admin-bar")?.remove();

        const W = this.scale.width;
        const H = this.scale.height;
        this.isMobile = W < 700;

        // ─── هل المافيا لحاله؟ ───
        const aliveMafia = this.players.filter(p => p.role === "MAFIA" && p.alive);
        this.isSoloMafia = aliveMafia.length <= 1;

        this.cameras.main.setBackgroundColor("#080810");
        this.cameras.main.fadeIn(700, 8, 8, 16);

        this.drawBackground(W, H);
        this.drawTopBar(W);

        if (this.isMobile) {
            this.createMobileUI(W, H);
        } else {
            this.drawTitle(W);
            this.drawPlayerCards(W, H);
            // chat بس لو في أكثر من مافيا
            if (!this.isSoloMafia && !(this.myPlayer && !this.myPlayer.alive)) {
                this.createDesktopChatPanel();
            }
        }

        this.setupSocketListeners();
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

    // ══════════════════════════════
    //  خلفية
    // ══════════════════════════════
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

    // ══════════════════════════════
    //  Topbar
    // ══════════════════════════════
    private drawTopBar(W: number) {
        this.add.rectangle(0, 0, W, 56, this.C.surface).setOrigin(0).setDepth(2);
        const line = this.add.graphics().setDepth(3);
        line.lineStyle(2, this.C.accent, 0.8);
        line.moveTo(0, 56); line.lineTo(W, 56); line.strokePath();
        this.add.text(20, 28, "🔪  MAFIA", {
            fontSize: "14px", color: "#cc2222",
            fontFamily: "'Courier New', monospace", fontStyle: "bold", letterSpacing: 3
        }).setOrigin(0, 0.5).setDepth(3);
        this.add.text(W / 2, 28, `ROOM  ${this.roomId?.substring(0, 8).toUpperCase()}`, {
            fontSize: "11px", color: "#664444",
            fontFamily: "'Courier New', monospace", letterSpacing: 2
        }).setOrigin(0.5, 0.5).setDepth(3);
        this.add.text(W - 20, 28, "◉  NIGHT PHASE", {
            fontSize: "11px", color: "#664444",
            fontFamily: "'Courier New', monospace", letterSpacing: 2
        }).setOrigin(1, 0.5).setDepth(3);
    }

    // ══════════════════════════════
    //  Desktop: عنوان
    // ══════════════════════════════
    private drawTitle(W: number) {
        const isDead = this.myPlayer && !this.myPlayer.alive;
        const titleY = 110;
        const titleText = isDead ? "YOU ARE ELIMINATED" : "CHOOSE YOUR TARGET";
        const subText   = isDead ? "Watch the mafia coordinate..." : "Chat with your team then suggest a target";
        const title = this.add.text(W / 2, titleY, titleText, {
            fontSize: "32px", color: isDead ? "#664444" : "#f1e8e8",
            fontFamily: "'Georgia', serif", fontStyle: "bold", letterSpacing: 6,
        }).setOrigin(0.5).setDepth(2).setAlpha(0);
        this.tweens.add({ targets: title, alpha: 1, y: titleY - 5, duration: 700, ease: "Cubic.easeOut", delay: 300 });
        const sub = this.add.text(W / 2, titleY + 38, subText, {
            fontSize: "13px", color: "#664444",
            fontFamily: "'Courier New', monospace", letterSpacing: 2
        }).setOrigin(0.5).setDepth(2).setAlpha(0);
        this.tweens.add({ targets: sub, alpha: 1, duration: 600, delay: 500 });
        const divider = this.add.graphics().setDepth(2).setAlpha(0);
        divider.lineStyle(1, this.C.accent, 0.4);
        divider.moveTo(W / 2 - 120, titleY + 58); divider.lineTo(W / 2 + 120, titleY + 58); divider.strokePath();
        this.tweens.add({ targets: divider, alpha: 1, duration: 500, delay: 600 });
        // ملاحظة: createDesktopChatPanel تنادى من create() مباشرة
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
            fontFamily: "'Courier New', monospace",
            boxShadow: "0 0 30px rgba(204,34,34,0.15)",
        });

        // Header
        panel.innerHTML = `
            <div style="padding:10px 14px;border-bottom:1px solid #2a1515;background:rgba(0,0,0,0.3);border-radius:10px 10px 0 0">
                <div style="color:#cc2222;font-size:10px;letter-spacing:3px;font-weight:bold">🔪 MAFIA CHANNEL</div>
            </div>
            <div id="mafia-suggestion-bar-d" style="display:none;padding:6px 12px;background:rgba(204,34,34,0.08);border-bottom:1px solid #2a1515;direction:rtl">
                <span style="color:#664444;font-size:9px">الاقتراح: </span>
                <span id="suggestion-name-d" style="color:#ff4444;font-size:11px;font-weight:bold"></span>
                <span id="suggestion-by-d" style="color:#664444;font-size:9px"></span>
            </div>
            <div id="mafia-chat-box-d" style="flex:1;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:5px">
                <div style="color:#3a1515;font-size:9px;text-align:center;letter-spacing:1px">── mafia channel ──</div>
            </div>
        `;

        // Input
        if (!isDead) {
            const inputDiv = document.createElement("div");
            inputDiv.style.cssText = "display:flex;gap:6px;padding:8px;border-top:1px solid #2a1515";
            inputDiv.innerHTML = `
                <input id="mafia-chat-input-d" type="text" placeholder="Message..."
                    style="flex:1;padding:6px 10px;background:#0a0505;color:#f1e8e8;border:1px solid #2a1515;border-radius:5px;font-size:12px;font-family:'Courier New',monospace;outline:none"/>
                <button id="mafia-chat-send-d" style="padding:6px 10px;border:1px solid #cc2222;border-radius:5px;background:transparent;color:#cc2222;font-size:11px;cursor:pointer;font-family:'Courier New',monospace">▶</button>
            `;
            panel.appendChild(inputDiv);

            const input   = inputDiv.querySelector<HTMLInputElement>("#mafia-chat-input-d")!;
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

    // ─── إضافة رسالة للـ chat (desktop + mobile) ───
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
        msg.innerHTML = `<span style="color:#664444;font-size:9px">${isMine ? "أنت" : from}: </span><span style="color:#f1e8e8">${message}</span>`;
        chatBox.appendChild(msg);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    private updateDesktopSuggestion(suggestedBy: string, targetUsername: string) {
        const bar  = document.getElementById("mafia-suggestion-bar-d");
        const name = document.getElementById("suggestion-name-d");
        const by   = document.getElementById("suggestion-by-d");
        if (bar)  bar.style.display = "block";
        if (name) name.textContent  = targetUsername;
        if (by)   by.textContent    = ` (${suggestedBy})`;
    }

    // ══════════════════════════════
    //  Desktop: بطاقات
    // ══════════════════════════════
    private drawPlayerCards(W: number, H: number) {
        const targets = this.players.filter(p => p.alive && p.id !== socketService.socket.id && p.role !== "MAFIA");
        if (!targets.length) return;

        let cardW = 140, cardH = 180, gap = 24;
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
                    bg.fillGradientStyle(0x2a0a0a, 0x2a0a0a, 0x1a0505, 0x1a0505, 1);
                    bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 12);
                    bg.lineStyle(2, this.C.accentGlow, 1);
                } else if (hover) {
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

            const avatarBg = this.add.circle(0, -cardH * 0.23, Math.floor(cardW * 0.21), 0x1a0a0a); avatarBg.setStrokeStyle(1, this.C.borderDim);
            const avatarIcon = this.add.text(0, -cardH * 0.23, "👤", { fontSize: `${Math.floor(cardW * 0.2)}px` }).setOrigin(0.5);
            const pulse = this.add.circle(0, -cardH * 0.23, Math.floor(cardW * 0.24), this.C.accent, 0);
            this.tweens.add({ targets: pulse, alpha: 0.15, scaleX: 1.3, scaleY: 1.3, duration: 1200, yoyo: true, repeat: -1, delay: i * 200 });
            const name = this.add.text(0, cardH * 0.07, player.username.toUpperCase(), {
                fontSize: `${Math.max(10, Math.floor(cardW * 0.086))}px`,
                color: "#c8b8b8", fontFamily: "'Courier New', monospace", fontStyle: "bold", letterSpacing: 1
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
            
            const btnLabel = this.add.text(0, cardH * 0.38, "ELIMINATE", { fontSize: "10px", color: "#cc2222", fontFamily: "'Courier New', monospace", letterSpacing: 2 }).setOrigin(0.5);
            container.add([shadow, bg, topAccent, pulse, avatarBg, avatarIcon, name, btnBg, btnLabel]);
            container.setInteractive(new Phaser.Geom.Rectangle(-cardW / 2, -cardH / 2, cardW, cardH), Phaser.Geom.Rectangle.Contains);
            container.on("pointerover", () => { if (this.actionUsed) return; drawBg(true, false); topAccent.setAlpha(1); drawBtnBg(true); this.tweens.add({ targets: container, scaleX: 1.05, scaleY: 1.05, y: cardY - 4, duration: 150 }); });
            container.on("pointerout", () => { drawBg(false, false); topAccent.setAlpha(0); drawBtnBg(false); this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, y: cardY, duration: 150 }); });
            container.on("pointerdown", () => { if (this.actionUsed) return; drawBg(false, true); this.handleTarget(player, container, bg, drawBg, drawBtnBg); });
            this.playerCards.push(container);
            this.tweens.add({ targets: container, alpha: 1, y: cardY, duration: 500, delay: 200 + i * 120, ease: "Back.easeOut", onStart: () => container.setY(cardY + 40) });
        });
    }

    private handleTarget(player: any, selected: Phaser.GameObjects.Container, bg: Phaser.GameObjects.Graphics, drawBg: any, drawBtnBg: any) {
        this.killedPlayerId = player.id;
        this.cameras.main.flash(300, 120, 0, 0);

        // reset كل الكروت
        this.playerCards.forEach(card => {
            const cardBtn = card.list[7] as Phaser.GameObjects.Graphics;
            const cardLabel = card.list[8] as Phaser.GameObjects.Text;
            if (cardLabel) { cardLabel.setText("SUGGEST"); cardLabel.setColor("#cc2222"); }
            card.setInteractive(new Phaser.Geom.Rectangle(-100, -90, 200, 180), Phaser.Geom.Rectangle.Contains);
            this.tweens.add({ targets: card, scaleX: 1, scaleY: 1, alpha: 1, duration: 200 });
        });

        // highlight المختار
        drawBg(false, true);
        this.tweens.add({ targets: selected, scaleX: 1.08, scaleY: 1.08, duration: 200, ease: "Back.easeOut" });
        const btnLabel = selected.list[8] as Phaser.GameObjects.Text;
        if (btnLabel) { btnLabel.setText("✓ SUGGESTED"); btnLabel.setColor("#ff4444"); }

        socketService.socket.emit("mafia_kill", player.id);
    }

    // ══════════════════════════════
    //  Mobile UI
    // ══════════════════════════════
    private createMobileUI(W: number, H: number) {
        const ui = document.createElement("div");
        ui.id = "mobile-night-ui";
        Object.assign(ui.style, {
            position: "fixed", top: "56px", left: "0", right: "0", bottom: "0",
            zIndex: "100", backgroundColor: "rgba(8,8,16,0.97)",
            display: "flex", flexDirection: "column",
            fontFamily: "'Courier New', monospace",
        });

        const isDead = this.myPlayer && !this.myPlayer.alive;

        // ─── Header ───
        const header = document.createElement("div");
        Object.assign(header.style, {
            padding: "12px 16px", borderBottom: "1px solid #2a1515",
            backgroundColor: "rgba(0,0,0,0.5)",
        });
        header.innerHTML = isDead
            ? `<div style="color:#664444;font-size:11px;letter-spacing:3px;margin-bottom:4px">☠ ELIMINATED</div>
               <div style="color:#f1e8e8;font-size:15px;font-weight:bold">You have been eliminated</div>
               <div style="color:#664444;font-size:11px;margin-top:3px">Watch the mafia plan...</div>`
            : this.isSoloMafia
            ? `<div style="color:#cc2222;font-size:11px;letter-spacing:3px;font-weight:bold;margin-bottom:4px">🔪 MAFIA NIGHT</div>
               <div style="color:#f1e8e8;font-size:16px;font-weight:bold">Choose Your Target</div>
               <div style="color:#664444;font-size:11px;margin-top:3px">You are the last mafia — choose wisely</div>`
            : `<div style="color:#cc2222;font-size:11px;letter-spacing:3px;font-weight:bold;margin-bottom:4px">🔪 MAFIA NIGHT</div>
               <div style="color:#f1e8e8;font-size:16px;font-weight:bold">Coordinate & Eliminate</div>
               <div style="color:#664444;font-size:11px;margin-top:3px">Chat with your team then lock a target</div>`;
        ui.appendChild(header);

        // ─── اقتراح الضحية الحالي ───
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

        // ─── Body: chat + قائمة الأهداف ───
        const body = document.createElement("div");
        Object.assign(body.style, {
            flex: "1", display: "flex", flexDirection: "column", overflow: "hidden",
        });

        // Chat messages — مخفي لو مافيا لحاله
        const chatBox = document.createElement("div");
        chatBox.id = "mafia-chat-box";
        Object.assign(chatBox.style, {
            flex:           this.isSoloMafia || isDead ? "0" : "1",
            display:        this.isSoloMafia && !isDead ? "none" : "flex",
            overflowY:      "auto",
            padding:        "10px 14px",
            flexDirection:  "column",
            gap:            "6px",
            maxHeight:      isDead ? "100%" : "140px",
        });

        const welcomeMsg = document.createElement("div");
        welcomeMsg.style.cssText = "color:#3a1515;font-size:10px;text-align:center;letter-spacing:1px;padding:6px";
        welcomeMsg.textContent = "── mafia channel ──";
        chatBox.appendChild(welcomeMsg);
        body.appendChild(chatBox);

        // ─── قائمة الأهداف (مخفية بالبداية) ───
        const targetSection = document.createElement("div");
        targetSection.id = "mafia-target-section";
        Object.assign(targetSection.style, {
            borderTop: "1px solid #2a1515", maxHeight: "200px",
            overflowY: "auto", display: isDead ? "none" : "block",
        });

        if (!isDead) {
            const targetHeader = document.createElement("div");
            targetHeader.style.cssText = "padding:8px 14px;color:#664444;font-size:9px;letter-spacing:2px;background:rgba(0,0,0,0.3)";
            targetHeader.textContent = "🎯 CHOOSE TARGET";
            targetSection.appendChild(targetHeader);

            const targets = this.players.filter(p => p.alive && p.id !== socketService.socket.id && p.role !== "MAFIA");

            if (targets.length === 0) {
                const empty = document.createElement("div");
                empty.style.cssText = "color:#664444;text-align:center;padding:16px;font-size:12px";
                empty.textContent = "No targets available";
                targetSection.appendChild(empty);
            } else {
                targets.forEach(player => {
                    const row = document.createElement("div");
                    row.id = `target-row-${player.id}`;
                    Object.assign(row.style, {
                        display: "flex", alignItems: "center", gap: "10px",
                        padding: "12px 16px", borderBottom: "1px solid #1a0a0a",
                        cursor: "pointer", transition: "all 0.2s",
                        background: "linear-gradient(145deg, rgba(30,10,10,0.8), rgba(15,5,5,0.9))",
                        borderRadius: "10px",
                        boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
                        border: "1px solid rgba(255,255,255,0.05)",
                        marginBottom: "8px"
                    });

                    row.innerHTML = `
                        <span style="font-size:22px">👤</span>
                        <span style="flex:1;color:#f1e8e8;font-size:14px;font-weight:bold">${player.username}</span>
                        <button id="kill-btn-${player.id}" style="padding:10px 16px;font-size:10px;font-weight:bold;letter-spacing:2px;border:1px solid rgba(204,34,34,0.5);border-radius:6px;background:linear-gradient(180deg, rgba(204,34,34,0.1), transparent);color:#cc2222;cursor:pointer;font-family:'Courier New',monospace;transition:all 0.2s;box-shadow:0 2px 4px rgba(0,0,0,0.5);touch-action:manipulation">SUGGEST</button>
                    `;

                    const btn = row.querySelector<HTMLButtonElement>(`#kill-btn-${player.id}`)!;
                    btn.addEventListener("click", () => {
                        // تحديث بصري لكل الأزرار
                        targetSection.querySelectorAll<HTMLButtonElement>("button[id^='kill-btn-']").forEach(b => {
                            b.textContent = "SUGGEST";
                            b.style.background = "linear-gradient(180deg, rgba(204,34,34,0.1), transparent)";
                            b.style.color = "#cc2222";
                            b.style.borderColor = "rgba(204,34,34,0.5)";
                            b.style.transform = "scale(1)";
                        });
                        // هاد الزر = locked
                        btn.textContent = "✓ SUGGESTED";
                        btn.style.background = "linear-gradient(180deg, #cc2222, #991111)";
                        btn.style.color = "#fff";
                        btn.style.borderColor = "#ff4444";
                        btn.style.transform = "scale(0.96)";
                        setTimeout(() => btn.style.transform = "scale(1)", 150);

                        socketService.socket.emit("mafia_kill", player.id);
                        this.killedPlayerId = player.id;
                        this.cameras.main.flash(300, 120, 0, 0);
                    });

                    targetSection.appendChild(row);
                });
            }
        }

        body.appendChild(targetSection);
        ui.appendChild(body);

        // ─── Chat Input ───
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

            const input  = chatInput.querySelector<HTMLInputElement>("#mafia-chat-input")!;
            const sendBtn= chatInput.querySelector<HTMLButtonElement>("#mafia-chat-send")!;

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

    // ─── إضافة رسالة للـ chat ───
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
            <div style="color:#664444;font-size:9px;margin-bottom:2px;letter-spacing:1px">${isMine ? "أنت" : from}</div>
            <div style="color:#f1e8e8;font-size:13px">${message}</div>
        `;
        chatBox.appendChild(msg);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    // ─── تحديث اقتراح الضحية ───
    private updateSuggestion(suggestedBy: string, targetUsername: string) {
        const bar = document.getElementById("mafia-suggestion-bar");
        if (!bar) return;
        bar.style.display = "block";
        const nameEl = document.getElementById("suggestion-name");
        const byEl   = document.getElementById("suggestion-by");
        if (nameEl) nameEl.textContent = targetUsername;
        if (byEl)   byEl.textContent   = ` (اقترحه ${suggestedBy})`;
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
        const msgW = Math.min(message.length * 9 + 48, Math.min(420, W - 20));
        const bg = this.add.rectangle(0, 0, msgW, 40, c.bg); bg.setStrokeStyle(1, c.border);
        const text = this.add.text(0, 0, message, { fontSize: "13px", color: c.text, fontFamily: "'Courier New', monospace" }).setOrigin(0.5);
        toast.add([bg, text]);
        toast.setAlpha(0).setY(H - 10);
        this.tweens.add({ targets: toast, alpha: 1, y: H - 60, duration: 300, ease: "Cubic.easeOut" });
        this.time.delayedCall(2800, () => this.tweens.add({ targets: toast, alpha: 0, y: H - 40, duration: 300, onComplete: () => toast.destroy() }));
    }

    // ══════════════════════════════
    //  Socket Listeners
    // ══════════════════════════════
    private setupSocketListeners() {
        socketService.socket.on("phase_changed", (data: any) => {
            if (data.phase === "NIGHT" || data.phase === "NIGHT_REVIEW") return;
            // امسح الـ desktop chat لما ينتهي الليل
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
            this.addMafiaChatMessage("🎯 SYSTEM", `${data.suggestedBy} اقترح قتل ${data.targetUsername}`);
            if (!this.isMobile) {
                this.updateDesktopSuggestion(data.suggestedBy, data.targetUsername);
                this.addDesktopChatMessage("🎯", `${data.suggestedBy} اقترح → ${data.targetUsername}`);
            }
        });
        socketService.socket.on("player_killed", (data: any) => {
            const msg = `${data.username} was killed in the night`;
            this.showToast(msg, "danger");
            this.addNightEventToMobilePanel(msg, "#f87171");
        });
    }

    // ─── helper: نحفظ الـ event عشان GameScene تعرضه لما ترجع ───
    private addNightEventToMobilePanel(msg: string, color: string) {
        // نحفظ في socketService عشان GameScene تعرضه لما تفتح
        socketService.pendingEvents.push({ msg, color });

        // لو الـ panel موجود (موبايل) نضيفه مباشرة
        const panel = document.getElementById("tab-panel-events");
        if (!panel) return;
        const now  = new Date();
        const time = `${now.getHours().toString().padStart(2,"0")}:${now.getMinutes().toString().padStart(2,"0")}`;
        const card = document.createElement("div");
        card.style.cssText = `display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-radius:8px;background:rgba(239,68,68,0.1);border:1px solid #ef444444;border-left:3px solid ${color};animation:eventSlideIn 0.3s ease-out`;
        card.innerHTML = `
            <div style="font-size:18px;min-width:22px;text-align:center;margin-top:1px">🔪</div>
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
        socketService.socket.off("server_reset");
        socketService.socket.off("mafia_chat_message");
        socketService.socket.off("mafia_suggestion");
    }
}