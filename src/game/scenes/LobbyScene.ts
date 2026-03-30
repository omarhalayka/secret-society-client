import Phaser from "phaser";
import { socketService } from "../../socket";
import { audioManager } from "../../AudioManager";
import { ar } from "../../i18n";

// â”€â”€â”€ ÙƒÙ„Ù…Ø© Ø³Ø± Ø§Ù„Ø£Ø¯Ù…Ù† â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ØºÙŠÙ‘Ø±Ù‡Ø§ Ù„Ø£ÙŠ ÙƒÙ„Ù…Ø© ØªØ¨ØºØ§Ù‡Ø§
const ADMIN_PASSWORD = "123123321123";

export default class LobbyScene extends Phaser.Scene {

    private usernameInput!: HTMLInputElement;
    private selectedType: string = "spectator";
    private sessionPasswordReady: boolean = false;
    private roleBtnW: number = 0; // Ø¹Ø±Ø¶ Ø²Ø± Ø§Ù„Ù€ role â€” Ù„Ù„Ø§Ø³ØªØ®Ø¯Ø§Ù… ÙÙŠ unlockPlayerButton
    private roleBtnH: number = 64;
    private queueStatusText!: Phaser.GameObjects.Text;
    private playerCountInterval?: number;
    private joinButton!: Phaser.GameObjects.Container;
    private joinBtnLabel!: Phaser.GameObjects.Text;
    private roleButtons: { [key: string]: Phaser.GameObjects.Container } = {};

    private particles: Array<{
        gfx: Phaser.GameObjects.Graphics;
        x: number; y: number; vx: number; vy: number;
        radius: number; alpha: number;
        pulseSpeed: number; pulseOffset: number;
    }> = [];

    private readonly C = {
        bg: 0x060810,
        card: 0x0d1117,
        cardBorder: 0x21262d,
        accent: 0x3b82f6,
        accentHover: 0x60a5fa,
        player: 0x22c55e,
        spectator: 0x8b5cf6,
        admin: 0xf59e0b,
    };

    constructor() { super("LobbyScene"); }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    //  CREATE
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    create() {
        // â”€â”€â”€ ØªØ­Ù‚Ù‚ Ù…Ù† Ø¬Ù„Ø³Ø© Ù…Ø­ÙÙˆØ¸Ø© Ø£ÙˆÙ„Ø§Ù‹ â”€â”€â”€
        const saved = socketService.getSavedSession();
        if (saved) {
            this.tryRejoin(saved);
            return;
        }

        this.setupSessionListeners();
        this.showSplashScreen();
    }

    private setupSessionListeners() {
        // â”€â”€â”€ Ø³Ø¬Ù‘Ù„ ÙƒÙ„ session listeners Ù…Ø±Ø© ÙˆØ§Ø­Ø¯Ø© ÙÙ‚Ø· â”€â”€â”€
        socketService.socket.off("session_password_ready");
        socketService.socket.off("session_password_set");
        socketService.socket.off("session_reset");
        socketService.socket.off("server_reset");
        socketService.socket.off("player_count_updated");

        socketService.socket.on("session_password_ready", (data: any) => {
            this.sessionPasswordReady = !!data.ready;
            if (data.ready) this.unlockPlayerButton();
        });

        socketService.socket.on("session_password_set", (data: any) => {
            if (data.password) {
                this.sessionPasswordReady = true;
                this.showToast(ar.lobby.passwordSet(data.password), "success");
            } else {
                this.sessionPasswordReady = false;
                this.showToast(ar.lobby.noPassword, "info");
            }
        });

        socketService.socket.on("session_reset", (data: any) => {
            (this as any)._pendingPlayerPassword = null;
            this.selectedType = "spectator";
            const playerBtn = this.roleButtons["player"];
            if (playerBtn) {
                playerBtn.setAlpha(0.4);
                playerBtn.disableInteractive();
                const icon = playerBtn.getData("icon") as Phaser.GameObjects.Text;
                if (icon) icon.setText("ðŸ”’");
            }
            const roles = [
                { key: "player", colHex: 0x22c55e, hex: "#22c55e" },
                { key: "spectator", colHex: 0x8b5cf6, hex: "#8b5cf6" },
                { key: "admin", colHex: 0xf59e0b, hex: "#f59e0b" },
            ];
            this.activateRole("spectator", roles);
            if (this.joinButton?.active) {
                this.joinBtnLabel?.setText(ar.lobby.joinQueue);
                this.joinButton.setAlpha(1);
                this.joinButton.setInteractive(
                    new Phaser.Geom.Rectangle(-172, -24, 344, 48),
                    Phaser.Geom.Rectangle.Contains
                );
            }
            this.showToast(data.message || "ØªÙ… ØªØºÙŠÙŠØ± ÙƒÙ„Ù…Ø© Ø§Ù„Ø³Ø± â€” Ø£Ø¯Ø®Ù„ Ø§Ù„ÙƒÙ„Ù…Ø© Ø§Ù„Ø¬Ø¯ÙŠØ¯Ø©", "error");
        });

        socketService.socket.on("server_reset", () => {
            socketService.reset();
            (this as any)._pendingPlayerPassword = null;
            this.showToast("ðŸ”„ Server reset by admin", "info");
            this.time.delayedCall(800, () => { this.scene.restart(); });
        });

        socketService.socket.on("player_count_updated", (data: any) => {
            (this as any)._requiredPlayers = data.required || 6;
            if (this.queueStatusText?.active) {
                this.queueStatusText.setText(`â—  0 / ${data.required} in queue`).setColor("#3b4a5c");
            }
        });
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    //  REJOIN â€” Ù…Ø­Ø§ÙˆÙ„Ø© Ø§Ù„Ø±Ø¬ÙˆØ¹ Ù„Ø¬Ù„Ø³Ø© Ù…Ø­ÙÙˆØ¸Ø©
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    private tryRejoin(saved: { roomId: string; username: string; role: string }) {
        const W = this.scale.width;
        const H = this.scale.height;
        this.cameras.main.setBackgroundColor("#060810");
        this.add.rectangle(0, 0, W, H, 0x060810).setOrigin(0);

        const msg = this.add.text(W / 2, H / 2 - 20, ar.lobby.reconnecting, {
            fontSize: "18px", color: "#3b82f6",
            fontFamily: "'Courier New', monospace", letterSpacing: 3,
        }).setOrigin(0.5);
        const sub = this.add.text(W / 2, H / 2 + 20, ar.lobby.welcomeBack(saved.username), {
            fontSize: "12px", color: "#4a5568",
            fontFamily: "'Courier New', monospace",
        }).setOrigin(0.5);

        socketService.saveUsername(saved.username);

        // â”€â”€â”€ cleanup Ø£ÙŠ listeners Ù‚Ø¯ÙŠÙ…Ø© â”€â”€â”€
        socketService.socket.off("rejoin_failed");
        socketService.socket.off("game_started");

        const goToLobby = () => {
            socketService.clearSession();
            msg.setColor("#ef4444");
            sub.setText(ar.lobby.startingNewSession);
            this.time.delayedCall(1200, () => {
                if (msg.active) msg.destroy();
                if (sub.active) sub.destroy();
                this.setupSessionListeners();
                this.showSplashScreen();
            });
        };

        const attemptRejoin = () => {
            socketService.socket.emit("rejoin_game", {
                roomId: saved.roomId,
                username: saved.username,
                role: saved.role,
            });

            // timeout â€” Ù„Ùˆ Ù…Ø§ Ø±Ø¯ Ø§Ù„Ø³ÙŠØ±ÙØ± Ø®Ù„Ø§Ù„ 5 Ø«ÙˆØ§Ù†ÙŠ
            const timeout = this.time.delayedCall(5000, () => {
                socketService.socket.off("rejoin_failed");
                socketService.socket.off("game_started");
                msg.setText(ar.lobby.connectionTimeout);
                goToLobby();
            });

            socketService.socket.once("rejoin_failed", () => {
                timeout.remove();
                msg.setText("Session expired");
                goToLobby();
            });

            socketService.socket.once("game_started", (data: any) => {
                timeout.remove();
                socketService.isAdmin = data.role === "ADMIN";
                socketService.role = data.role;
                socketService.roomId = data.roomId;
                this.scene.start("GameScene", {
                    role: data.role,
                    roomId: data.roomId,
                    userType: data.role === "ADMIN" ? "ADMIN" : "PLAYER",
                });
            });
        };

        if (socketService.socket.connected) {
            attemptRejoin();
        } else {
            socketService.socket.once("connect", attemptRejoin);
            // Ù„Ùˆ Ù…Ø§ Ø§ØªØµÙ„ Ø®Ù„Ø§Ù„ 6 Ø«ÙˆØ§Ù†ÙŠ
            this.time.delayedCall(6000, () => {
                if (!socketService.socket.connected) {
                    msg.setText(ar.lobby.cannotConnect);
                    goToLobby();
                }
            });
        }
    }

    private showSplashScreen() {
        const W = this.scale.width;
        const H = this.scale.height;

        this.cameras.main.setBackgroundColor("#060810");

        // Ø®Ù„ÙÙŠØ© Ø³ÙˆØ¯Ø§Ø¡
        const bg = this.add.rectangle(W / 2, H / 2, W, H, 0x000000).setDepth(0);

        // ØµÙˆØ±Ø© Ø§Ù„Ù€ splash
        const img = this.add.image(W / 2, H / 2, "welcome")
            .setDepth(1).setAlpha(0);

        // ØªÙ†Ø§Ø³Ø¨ Ø§Ù„ØµÙˆØ±Ø© - contain Ø¹Ù„Ù‰ Ø§Ù„Ø¯ÙŠØ³ÙƒØªÙˆØ¨ØŒ cover Ø¹Ù„Ù‰ Ø§Ù„Ù‡Ø§ØªÙ
        const isMobile = W < 700;
        const scaleX = W / img.width;
        const scaleY = H / img.height;
        img.setScale(isMobile ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY) * 0.85);

        // fade in Ø§Ù„ØµÙˆØ±Ø©
        this.tweens.add({ targets: img, alpha: 1, duration: 900, delay: 200 });

        // â”€â”€â”€ Ø²Ø± HTML Ø¹Ø´Ø§Ù† Ø§Ù„Ù†Øµ Ø§Ù„Ø¹Ø±Ø¨ÙŠ ÙŠØ·Ù„Ø¹ ØµØ­ (RTL) â”€â”€â”€
        const btn = document.createElement("button");
        btn.id = "splash-btn";
        btn.textContent = "Ø§Ù„Ø¯Ø®ÙˆÙ„ Ø¥Ù„Ù‰ Ø§Ù„Ù…Ù†Ø¸Ù…Ø© Ø§Ù„Ø³ÙˆØ¯Ø§Ø¡";
        Object.assign(btn.style, {
            position: "fixed",
            bottom: "60px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: "2000",
            padding: "14px 36px",
            fontSize: "20px",
            fontFamily: "'Georgia', serif",
            fontWeight: "bold",
            color: "#ffffff",
            background: "#3b82f6",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            direction: "rtl",
            letterSpacing: "1px",
            opacity: "0",
            transition: "opacity 0.6s ease, transform 0.15s ease, background 0.2s ease",
            boxShadow: "0 4px 20px rgba(59,130,246,0.4)",
        });
        btn.addEventListener("mouseover", () => { btn.style.background = "#60a5fa"; });
        btn.addEventListener("mouseout", () => { btn.style.background = "#3b82f6"; });
        btn.addEventListener("mousedown", () => { btn.style.transform = "translateX(-50%) scale(0.96)"; });
        document.body.appendChild(btn);

        // Ø£Ù†Ø´Ø¦ Ø²Ø± Ø§Ù„Ù€ mute ÙÙˆØ±Ø§Ù‹ (Ù…Ø³ØªÙ‚Ù„ Ø¹Ù† Ø§Ù„Ù…ÙˆØ³ÙŠÙ‚Ù‰)
        audioManager.createMuteButton();

        // fade in Ø§Ù„Ø²Ø± Ø¨Ø¹Ø¯ Ø§Ù„ØµÙˆØ±Ø©
        this.time.delayedCall(900, () => { btn.style.opacity = "1"; });

        let entered = false;
        const enterLobby = () => {
            if (entered) return;
            entered = true;
            audioManager.play();

            // â”€â”€â”€ Ø£Ù†Ø´Ø¦ Ø§Ù„ÙÙŠØ¯ÙŠÙˆ ÙˆØ´ØºÙ‘Ù„Ù‡ Ù…Ø¨Ø§Ø´Ø±Ø© Ø¶Ù…Ù† user gesture â”€â”€â”€
            document.getElementById("lobby-bg-video")?.remove();
            const vid = document.createElement("video");
            vid.id = "lobby-bg-video";
            vid.src = "/bg-desktop.mp4"; // Ù†ÙØ³ Ø§Ù„ÙÙŠØ¯ÙŠÙˆ Ù„Ù„ÙƒÙ„ Ø¹Ø´Ø§Ù† ÙŠØ´ØªØºÙ„ Ø¹Ù„Ù‰ Ø§Ù„Ø£Ù†Ø¯Ø±ÙˆÙŠØ¯
            vid.loop = true;
            vid.muted = true;
            vid.preload = "auto";
            (vid as any).playsInline = true;
            vid.setAttribute("muted", "");
            vid.setAttribute("playsinline", "");
            Object.assign(vid.style, {
                position: "fixed", top: "0", left: "0",
                width: "100%", height: "100%",
                objectFit: "cover", zIndex: "1",
                opacity: "0", transition: "opacity 1.5s ease",
                pointerEvents: "none",
            });
            const showVideo = () => { vid.style.opacity = "0.55"; };
            vid.addEventListener("canplay", showVideo, { once: true });
            vid.addEventListener("playing", showVideo, { once: true });
            vid.addEventListener("loadeddata", showVideo, { once: true });
            document.body.insertBefore(vid, document.body.firstChild);
            // Ø´ØºÙ‘Ù„ Ù…Ø¨Ø§Ø´Ø±Ø© â€” Ù‡Ù†Ø§ Ø¶Ù…Ù† user gesture chain Ø¨Ù†Ø¬Ø­ Ø¹Ù„Ù‰ ÙƒÙ„ Ø§Ù„Ù…ØªØµÙØ­Ø§Øª
            vid.play().catch(() => { });

            btn.style.opacity = "0";
            this.tweens.add({ targets: [bg, img], alpha: 0, duration: 450 });
            this.time.delayedCall(500, () => {
                this.cleanupAllLobbyHTML();
                this.initLobby();
            });
        };

        btn.addEventListener("click", enterLobby);

        // fallback: Ø£ÙŠ Ø¶ØºØ·Ø© Ø¹Ù„Ù‰ Ø§Ù„Ø´Ø§Ø´Ø© ØªØ´ØºÙ‘Ù„ Ø§Ù„Ù„ÙˆØ¨ÙŠ
        const onFirstClick = (e: Event) => {
            document.removeEventListener("pointerdown", onFirstClick);
            document.removeEventListener("touchstart", onFirstClick);
            enterLobby();
        };
        this.time.delayedCall(1000, () => {
            document.addEventListener("pointerdown", onFirstClick, { once: true });
            document.addEventListener("touchstart", onFirstClick, { once: true, passive: true });
        });
    }

    private initLobby() {
        const W = this.scale.width;
        const H = this.scale.height;
        const isMobile = W < 700;

        this.cameras.main.fadeIn(500, 6, 8, 16);
        this.cameras.main.setBackgroundColor(0x00000000);
        this.cleanupAllLobbyHTML();
        this.startBgVideo();
        this.drawBackground(W, H);

        if (isMobile) {
            this.buildMobileLayout(W, H);
        } else {
            this.buildDesktopLayout(W, H);
        }

        this.setupSocketEvents();
        this.playerCountInterval = window.setInterval(() => {
            socketService.socket.emit("request_queue_status");
        }, 3000);
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    //  DESKTOP LAYOUT
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    private buildDesktopLayout(W: number, H: number) {
        const cy = H / 2;

        // â”€â”€â”€ Ø§Ù„Ù‚Ø³Ù…Ø©: 55% ÙŠØ³Ø§Ø± (hero) | 45% ÙŠÙ…ÙŠÙ† (form card) â”€â”€â”€
        const heroW = Math.floor(W * 0.55);   // Ø¹Ø±Ø¶ Ù…Ù†Ø·Ù‚Ø© Ø§Ù„Ù€ hero
        const formW = W - heroW;              // Ø¹Ø±Ø¶ Ù…Ù†Ø·Ù‚Ø© Ø§Ù„ÙÙˆØ±Ù…
        const heroCx = heroW / 2;             // Ù…Ø±ÙƒØ² Ø§Ù„Ù€ hero
        const formCx = heroW + formW / 2;     // Ù…Ø±ÙƒØ² Ø§Ù„ÙÙˆØ±Ù…

        // â”€â”€â”€ Ø¨Ø·Ø§Ù‚Ø© Ø§Ù„ÙÙˆØ±Ù… â”€â”€â”€
        const cardPad = 40;
        const cardW = formW - cardPad * 2;
        const cardH = Math.min(H - 80, 460);
        const cardTop = cy - cardH / 2;

        // Ø¨Ø·Ø§Ù‚Ø© Ø´ÙØ§ÙØ© - backdrop blur Ø¨Ø¯Ù„ Ø§Ù„Ù„ÙˆÙ† Ø§Ù„ØµÙ„Ø¨
        this.add.rectangle(formCx, cy, cardW + 6, cardH + 6, 0x3b82f6, 0.08).setDepth(1);
        const card = this.add.rectangle(formCx, cy, cardW, cardH, 0x060810, 0.94).setDepth(2);
        card.setStrokeStyle(1, this.C.cardBorder);

        // Ø´Ø±ÙŠØ· Ù„ÙˆÙ†ÙŠ Ø£Ø¹Ù„Ù‰ Ø§Ù„Ø¨Ø·Ø§Ù‚Ø©
        this.add.rectangle(formCx, cardTop + 2, cardW - 2, 3, this.C.accent)
            .setOrigin(0.5, 0).setDepth(3);

        // Ø®Ø· Ø±Ø£Ø³ÙŠ ÙØ§ØµÙ„ Ø¨ÙŠÙ† Ø§Ù„Ù‚Ø³Ù…ÙŠÙ†
        const sepLine = this.add.graphics().setDepth(1);
        sepLine.lineStyle(1, this.C.cardBorder, 0.6);
        sepLine.moveTo(heroW, H * 0.1);
        sepLine.lineTo(heroW, H * 0.9);
        sepLine.strokePath();

        // â”€â”€â”€ Ù…Ø­ØªÙˆÙ‰ Ø§Ù„Ø¨Ø·Ø§Ù‚Ø© â”€â”€â”€
        const pad = 28;
        const fL = formCx - cardW / 2 + pad;   // Ø­Ø§ÙØ© ÙŠØ³Ø§Ø±
        let posY = cardTop + 30;

        // Ø¹Ù†ÙˆØ§Ù† ØµØºÙŠØ± Ø¯Ø§Ø®Ù„ Ø§Ù„Ø¨Ø·Ø§Ù‚Ø©
        // Ø¹Ù†ÙˆØ§Ù† ØµØºÙŠØ± Ø£Ø¹Ù„Ù‰ Ø§Ù„Ø¨Ø·Ø§Ù‚Ø© - HTML Ø¹Ø´Ø§Ù† RTL
        const cardTagEl = document.createElement("div");
        cardTagEl.id = "lobby-card-tag";
        cardTagEl.textContent = "Ø§Ù„Ù…Ù†Ø¸Ù…Ø© Ø§Ù„Ø³ÙˆØ¯Ø§Ø¡";
        Object.assign(cardTagEl.style, {
            position: "fixed",
            top: `${posY}px`,
            left: `${fL}px`,
            direction: "rtl",
            fontSize: "10px",
            color: "#3b82f6",
            fontFamily: "'Courier New', monospace",
            letterSpacing: "2px",
            pointerEvents: "none",
            zIndex: "10",
        });
        document.body.appendChild(cardTagEl);
        posY += 28;

        // USERNAME
        this.addFieldLabel(fL, posY, "USERNAME");
        posY += 18;
        this.createUsernameInput(fL, posY, cardW - pad * 2);
        posY += 56; // Ø§Ø±ØªÙØ§Ø¹ Ø§Ù„Ù€ input (44px) + gap (12px)

        // JOIN AS
        this.addFieldLabel(fL, posY, "JOIN  AS");
        posY += 18;
        this.createRoleButtons(formCx, posY + 32, cardW - pad * 2);
        posY += 90; // Ø§Ø±ØªÙØ§Ø¹ Ø§Ù„Ø£Ø²Ø±Ø§Ø± (64px) + gap (26px)

        // JOIN BUTTON
        const btnY = cardTop + cardH - 72;
        this.createJoinButton(formCx, btnY, cardW - pad * 2);

        // Queue status
        this.queueStatusText = this.add.text(formCx, cardTop + cardH - 32,
            "â—  0 / 6 in queue", {
            fontSize: "11px", color: "#3b4a5c",
            fontFamily: "'Courier New', monospace", letterSpacing: 1
        }).setOrigin(0.5).setDepth(3);

        // fade in
        card.setAlpha(0);
        this.tweens.add({ targets: card, alpha: 1, duration: 600, delay: 150 });

        // â”€â”€â”€ Hero ÙŠØ³Ø§Ø± â”€â”€â”€
        this.buildDesktopHero(heroCx, cy, heroW);
    }

    private buildDesktopHero(cx: number, cy: number, heroW: number) {
        // â”€â”€â”€ Ø£ÙŠÙ‚ÙˆÙ†Ø© Ù…Ø§Ø³Ø© â”€â”€â”€
        const s = Math.min(heroW * 0.06, 24); // Ø­Ø¬Ù… Ù…ØªÙ†Ø§Ø³Ø¨ Ù…Ø¹ Ø§Ù„Ø¹Ø±Ø¶
        const icon = this.add.graphics().setDepth(2).setAlpha(0);
        icon.fillStyle(this.C.accent, 1);
        icon.fillTriangle(cx - s, cy - s * 3.2, cx + s, cy - s * 3.2, cx, cy - s * 1.5);
        icon.fillTriangle(cx - s, cy - s * 1.2, cx + s, cy - s * 1.2, cx, cy - s * 2.9);
        this.tweens.add({ targets: icon, alpha: 0.85, duration: 800, delay: 100 });

        // Ø®Ø· Ø¹Ù„ÙˆÙŠ Ø²Ø®Ø±ÙÙŠ
        const lineW = Math.min(heroW * 0.3, 120);
        const g1 = this.add.graphics().setDepth(2);
        g1.lineStyle(1, this.C.accent, 0.22);
        g1.moveTo(cx - lineW / 2, cy - s * 4.2); g1.lineTo(cx + lineW / 2, cy - s * 4.2); g1.strokePath();

        // â”€â”€â”€ Ø§Ù„Ø¹Ù†ÙˆØ§Ù† Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠ (HTML Ø¹Ø´Ø§Ù† RTL ÙŠØ´ØªØºÙ„ ØµØ­) â”€â”€â”€
        const titleSize = Math.min(Math.floor(heroW * 0.055), 28);
        const titleEl = document.createElement("div");
        titleEl.id = "lobby-hero-title";
        titleEl.textContent = "Ø§Ù„Ù…Ù†Ø¸Ù…Ø© Ø§Ù„Ø³ÙˆØ¯Ø§Ø¡";
        Object.assign(titleEl.style, {
            position: "fixed",
            top: `${cy - 10 - titleSize}px`,
            left: `${cx - heroW * 0.4}px`,
            width: `${heroW * 0.8}px`,
            textAlign: "center",
            direction: "rtl",
            fontSize: `${titleSize}px`,
            fontFamily: "'Georgia', serif",
            fontWeight: "bold",
            color: "#f1f5f9",
            lineHeight: "1.2",
            pointerEvents: "none",
            zIndex: "10",
            opacity: "0",
            transition: "opacity 0.7s ease",
        });
        document.body.appendChild(titleEl);
        this.time.delayedCall(200, () => { titleEl.style.opacity = "1"; });
        // placeholder Ø´ÙØ§Ù ÙÙŠ Phaser Ù„Ù„Ù€ spacing
        const t1 = this.add.rectangle(cx, cy - 10, 10, titleSize * 2.4, 0x000000, 0).setDepth(2);

        // subtitle
        const t2 = this.add.text(cx, cy + titleSize + 22, "MULTIPLAYER  Â·  SOCIAL DEDUCTION", {
            fontSize: "10px", color: "#3b82f6",
            fontFamily: "'Courier New', monospace", letterSpacing: 3
        }).setOrigin(0.5).setDepth(2).setAlpha(0);
        this.tweens.add({ targets: t2, alpha: 1, duration: 600, delay: 400 });

        // Ø®Ø· Ø³ÙÙ„ÙŠ Ø²Ø®Ø±ÙÙŠ
        const g2 = this.add.graphics().setDepth(2);
        g2.lineStyle(1, this.C.accent, 0.12);
        g2.moveTo(cx - lineW / 2, cy + titleSize + 50); g2.lineTo(cx + lineW / 2, cy + titleSize + 50); g2.strokePath();

        // Ø¬Ù…Ù„Ø© italics
        const t3 = this.add.text(cx, cy + titleSize + 68, "Deceive.  Deduce.  Survive.", {
            fontSize: "13px", color: "#2d3748",
            fontFamily: "'Georgia', serif", fontStyle: "italic"
        }).setOrigin(0.5).setDepth(2).setAlpha(0);
        this.tweens.add({ targets: t3, alpha: 1, duration: 600, delay: 550 });

        // â”€â”€â”€ Features â”€â”€â”€
        const baseY = cy + titleSize + 108;
        [
            { ico: "ðŸ”ª", text: "Hidden Roles" },
            { ico: "ðŸ—³ï¸", text: "Strategic Voting" },
            { ico: "ðŸŒ™", text: "Night Elimination" },
        ].forEach((item, i) => {
            const f = this.add.text(cx, baseY + i * 32, `${item.ico}  ${item.text}`, {
                fontSize: "12px", color: "#1a2535",
                fontFamily: "'Courier New', monospace", letterSpacing: 1
            }).setOrigin(0.5).setDepth(2).setAlpha(0);
            this.tweens.add({ targets: f, alpha: 1, duration: 500, delay: 650 + i * 100 });
        });
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    //  MOBILE LAYOUT
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    private buildMobileLayout(W: number, H: number) {
        const cx = W / 2;
        const pad = 16; // padding Ø¬Ø§Ù†Ø¨ÙŠ

        // â”€â”€â”€ Ø±Ø£Ø³ â”€â”€â”€
        const headerH = 108;

        // Ø£ÙŠÙ‚ÙˆÙ†Ø© Ù…Ø§Ø³Ø© ØµØºÙŠØ±Ø©
        const icon = this.add.graphics().setDepth(2);
        icon.fillStyle(this.C.accent, 0.9);
        icon.fillTriangle(cx - 10, 28, cx + 10, 28, cx, 44);
        icon.fillTriangle(cx - 10, 50, cx + 10, 50, cx, 34);

        // Ø§Ù„Ø¹Ù†ÙˆØ§Ù† Ø§Ù„Ø¹Ø±Ø¨ÙŠ ÙƒÙ€ HTML Ø¹Ø´Ø§Ù† RTL
        const mTitleEl = document.createElement("div");
        mTitleEl.id = "lobby-mobile-title";
        mTitleEl.textContent = "Ø§Ù„Ù…Ù†Ø¸Ù…Ø© Ø§Ù„Ø³ÙˆØ¯Ø§Ø¡";
        Object.assign(mTitleEl.style, {
            position: "fixed",
            top: "46px",
            left: "0",
            right: "0",
            textAlign: "center",
            direction: "rtl",
            fontSize: "20px",
            fontFamily: "'Georgia', serif",
            fontWeight: "bold",
            color: "#f1f5f9",
            letterSpacing: "2px",
            pointerEvents: "none",
            zIndex: "10",
        });
        document.body.appendChild(mTitleEl);

        this.add.text(cx, 86, "MULTIPLAYER  Â·  SOCIAL DEDUCTION", {
            fontSize: "8px", color: "#3b82f6",
            fontFamily: "'Courier New', monospace", letterSpacing: 2
        }).setOrigin(0.5).setDepth(2);

        // â”€â”€â”€ Ø§Ù„Ø¨Ø·Ø§Ù‚Ø© â”€â”€â”€
        const cardW = W - pad * 2;
        const cardH = H - headerH - pad;
        const cardCX = cx;
        const cardCY = headerH + cardH / 2;
        const cardT = headerH; // Ø£Ø¹Ù„Ù‰ Ø§Ù„Ø¨Ø·Ø§Ù‚Ø©

        // Ø¨Ø·Ø§Ù‚Ø© Ø´ÙØ§ÙØ© Ù…Ø¹ HTML blur overlay
        const card = this.add.rectangle(cardCX, cardCY, cardW, cardH, 0x060810, 0.94).setDepth(1);
        card.setStrokeStyle(1, this.C.cardBorder);

        // Ø´Ø±ÙŠØ· Ù„ÙˆÙ†ÙŠ Ø£Ø¹Ù„Ù‰
        this.add.rectangle(cardCX, cardT + 2, cardW - 2, 3, this.C.accent)
            .setOrigin(0.5, 0).setDepth(2);

        // â”€â”€â”€ Ù…Ø­ØªÙˆÙ‰ Ø§Ù„Ø¨Ø·Ø§Ù‚Ø© (positioning Ø¹Ù…ÙˆØ¯ÙŠ Ø«Ø§Ø¨Øª) â”€â”€â”€
        const fL = cardCX - cardW / 2 + 18;
        let posY = cardT + 24;

        // USERNAME
        this.addFieldLabel(fL, posY, "USERNAME");
        posY += 17;
        this.createUsernameInput(fL, posY, cardW - 36);
        posY += 58; // input height 44px + gap 14px

        // JOIN AS
        this.addFieldLabel(fL, posY, "JOIN  AS");
        posY += 18;
        this.createRoleButtons(cardCX, posY + 32, cardW - 36);
        // Ø£Ø²Ø±Ø§Ø± Ø§Ù„Ø¯ÙˆØ± Ø§Ø±ØªÙØ§Ø¹Ù‡Ø§ 64px

        // JOIN BUTTON - Ù…Ù† Ø£Ø³ÙÙ„ Ø§Ù„Ø¨Ø·Ø§Ù‚Ø©
        const btnY = cardT + cardH - 68;
        const queueY = cardT + cardH - 30;

        this.createJoinButton(cardCX, btnY, cardW - 36);

        this.queueStatusText = this.add.text(cardCX, queueY,
            "â—  0 / 6 in queue", {
            fontSize: "11px", color: "#3b4a5c",
            fontFamily: "'Courier New', monospace", letterSpacing: 1
        }).setOrigin(0.5).setDepth(3);
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    //  FIELD HELPERS
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    private addFieldLabel(x: number, y: number, label: string) {
        this.add.text(x, y, label, {
            fontSize: "9px", color: "#4a5568",
            fontFamily: "'Courier New', monospace", letterSpacing: 3
        }).setDepth(3);
    }

    private createUsernameInput(x: number, y: number, width: number) {
        document.getElementById("lobby-username")?.remove();
        this.usernameInput = document.createElement("input");
        this.usernameInput.id = "lobby-username";
        this.usernameInput.type = "text";
        this.usernameInput.placeholder = "Your name...";
        this.usernameInput.maxLength = 20;
        this.usernameInput.autocomplete = "off";
        Object.assign(this.usernameInput.style, {
            position: "absolute", left: `${x}px`, top: `${y}px`,
            width: `${width}px`, padding: "11px 14px", fontSize: "14px",
            fontFamily: "'Courier New', monospace", borderRadius: "6px",
            border: "1px solid #21262d", backgroundColor: "#010409", color: "#f1f5f9",
            outline: "none", zIndex: "1000", letterSpacing: "1px",
            transition: "border-color 0.2s, box-shadow 0.2s",
        });
        this.usernameInput.addEventListener("focus", () => {
            this.usernameInput.style.borderColor = "#3b82f6";
            this.usernameInput.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.15)";
        });
        this.usernameInput.addEventListener("blur", () => {
            this.usernameInput.style.borderColor = "#21262d";
            this.usernameInput.style.boxShadow = "none";
        });
        this.usernameInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") this.handleJoin();
        });
        document.body.appendChild(this.usernameInput);
    }

    private createRoleButtons(cx: number, cy: number, totalW: number) {
        const roles = [
            { key: "player", label: "PLAYER", icon: "âš”", colHex: 0x22c55e, hex: "#22c55e" },
            { key: "spectator", label: "SPECTATOR", icon: "ðŸ‘", colHex: 0x8b5cf6, hex: "#8b5cf6" },
            { key: "admin", label: "ADMIN", icon: "ðŸ”’", colHex: 0xf59e0b, hex: "#f59e0b" },
        ];
        const gap = 8;
        const btnW = (totalW - gap * 2) / 3;
        const btnH = 64;
        const sx = cx - totalW / 2 + btnW / 2;
        // Ù†Ø­ÙØ¸ Ø§Ù„Ø¹Ø±Ø¶ Ø¹Ø´Ø§Ù† Ù†Ø³ØªØ®Ø¯Ù…Ù‡ ÙÙŠ unlockPlayerButton
        this.roleBtnW = btnW;
        this.roleBtnH = btnH;

        roles.forEach((role, i) => {
            const bx = sx + i * (btnW + gap);
            const isActive = role.key === this.selectedType;
            const isPlayerLocked = role.key === "player" && !this.sessionPasswordReady;

            const c = this.add.container(bx, cy).setDepth(3);
            if (isPlayerLocked) c.setAlpha(0.4); // Ù…Ø¸Ù‡Ø± Ù…Ù‚ÙÙ„

            const bg = this.add.rectangle(0, 0, btnW, btnH,
                isActive ? 0x0d1f3c : this.C.card);
            bg.setStrokeStyle(isActive ? 2 : 1,
                isActive ? role.colHex : this.C.cardBorder);

            // Ø£ÙŠÙ‚ÙˆÙ†Ø© â€” PLAYER Ø§Ù„Ù…Ù‚ÙÙ„ ÙŠØ´ÙˆÙ ðŸ”’
            const displayIcon = isPlayerLocked ? "ðŸ”’" : role.icon;
            const iconTxt = this.add.text(0, -12, displayIcon, { fontSize: "20px" }).setOrigin(0.5);
            const lbl = this.add.text(0, 14, role.label, {
                fontSize: "9px", color: isActive ? role.hex : "#4a5568",
                fontFamily: "'Courier New', monospace", letterSpacing: 1, fontStyle: "bold"
            }).setOrigin(0.5);

            c.add([bg, iconTxt, lbl]);

            // PLAYER Ø§Ù„Ù…Ù‚ÙÙ„: Ù…Ø´ interactive
            if (!isPlayerLocked) {
                c.setInteractive(
                    new Phaser.Geom.Rectangle(-btnW / 2, -btnH / 2, btnW, btnH),
                    Phaser.Geom.Rectangle.Contains
                );
            }

            c.setData("roleKey", role.key);
            c.setData("bg", bg);
            c.setData("lbl", lbl);
            c.setData("icon", iconTxt);
            this.roleButtons[role.key] = c;

            c.on("pointerover", () => {
                if (this.selectedType !== role.key) {
                    bg.setFillStyle(0x0d1117); bg.setStrokeStyle(1, role.colHex);
                    lbl.setColor(role.hex);
                }
                this.tweens.add({ targets: c, scaleX: 1.04, scaleY: 1.04, duration: 100 });
            });
            c.on("pointerout", () => {
                if (this.selectedType !== role.key) {
                    bg.setFillStyle(this.C.card); bg.setStrokeStyle(1, this.C.cardBorder);
                    lbl.setColor("#4a5568");
                }
                this.tweens.add({ targets: c, scaleX: 1, scaleY: 1, duration: 100 });
            });
            c.on("pointerdown", () => {
                if (role.key === "admin" && this.selectedType !== "admin") {
                    this.showAdminPasswordPopup();
                    return;
                }
                if (role.key === "player") {
                    this.time.delayedCall(150, () => this.showPlayerJoinPopup(roles));
                    return;
                }
                this.activateRole(role.key, roles);
                this.tweens.add({ targets: c, scaleX: 0.93, scaleY: 0.93, duration: 70, yoyo: true });
            });
        });

        // â”€â”€â”€ Ù„Ùˆ ÙƒÙ„Ù…Ø© Ø§Ù„Ø³Ø± Ø¬Ø§Ù‡Ø²Ø© Ù‚Ø¨Ù„ Ù…Ø§ ØªØªÙ†Ø´Ø£ Ø§Ù„Ø£Ø²Ø±Ø§Ø± â€” Ù†ÙØªØ­ PLAYER ÙÙˆØ±Ø§Ù‹ â”€â”€â”€
        if (this.sessionPasswordReady) {
            this.time.delayedCall(50, () => this.unlockPlayerButton());
        }
    }

    // â”€â”€â”€ ØªÙØ¹ÙŠÙ„ Ø²Ø± PLAYER Ù„Ù…Ø§ Ø§Ù„Ø£Ø¯Ù…Ù† ÙŠØ­Ø· ÙƒÙ„Ù…Ø© Ø§Ù„Ø³Ø± â”€â”€â”€
    private unlockPlayerButton() {
        const c = this.roleButtons["player"];
        if (!c) return;
        c.setAlpha(1);
        const iconTxt = c.getData("icon") as Phaser.GameObjects.Text;
        if (iconTxt) iconTxt.setText("âš”");
        c.setInteractive(
            new Phaser.Geom.Rectangle(
                -this.roleBtnW / 2,
                -this.roleBtnH / 2,
                this.roleBtnW,
                this.roleBtnH
            ),
            Phaser.Geom.Rectangle.Contains
        );
        // Ù…Ø§ Ù†Ø·Ù„Ø¹ toast Ù„Ùˆ Ø§Ù„Ø²Ø± Ø§ØªÙØªØ­ ØªÙ„Ù‚Ø§Ø¦ÙŠØ§Ù‹ Ø¹Ù†Ø¯ Ø§Ù„Ø¯Ø®ÙˆÙ„
        if (!this.roleButtons["player"]?.getData("autoUnlocked")) {
            this.showToast("ðŸ”“ Ø§Ù„Ù„Ø¹Ø¨Ø© ÙØªØ­Øª â€” Ø§Ø®ØªØ± PLAYER", "success");
        }
    }

    private activateRole(key: string, roles: Array<{ key: string; colHex: number; hex: string }>) {
        Object.values(this.roleButtons).forEach(rc => {
            const b = rc.list[0] as Phaser.GameObjects.Rectangle;
            const lt = rc.list[2] as Phaser.GameObjects.Text;
            b.setFillStyle(this.C.card); b.setStrokeStyle(1, this.C.cardBorder);
            lt.setColor("#4a5568");
        });
        const rb = this.roleButtons[key];
        if (rb) {
            const r = roles.find(r => r.key === key)!;
            const b = rb.list[0] as Phaser.GameObjects.Rectangle;
            const lt = rb.list[2] as Phaser.GameObjects.Text;
            b.setFillStyle(0x0d1f3c); b.setStrokeStyle(2, r.colHex);
            lt.setColor(r.hex);
        }
        this.selectedType = key;
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    //  ADMIN RESET BUTTON (ÙŠØ·Ù„Ø¹ ÙÙŠ Ø§Ù„Ù€ lobby Ø¨Ø¹Ø¯ Ø¯Ø®ÙˆÙ„ Ø§Ù„Ø£Ø¯Ù…Ù†)
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    private showAdminResetButton() {
        document.getElementById("admin-reset-btn")?.remove();

        const btn = document.createElement("button");
        btn.id = "admin-reset-btn";
        btn.textContent = "ðŸ—‘ RESET SERVER";
        Object.assign(btn.style, {
            position: "fixed",
            bottom: "18px",
            right: "18px",
            zIndex: "9999",
            padding: "10px 18px",
            fontSize: "11px",
            fontFamily: "'Courier New', monospace",
            fontWeight: "bold",
            letterSpacing: "2px",
            color: "#f43f5e",
            backgroundColor: "rgba(13,17,23,0.97)",
            border: "1px solid #f43f5e",
            borderRadius: "8px",
            cursor: "pointer",
            backdropFilter: "blur(8px)",
            transition: "background 0.15s",
        });

        btn.addEventListener("mouseover", () => {
            btn.style.backgroundColor = "rgba(244,63,94,0.15)";
        });
        btn.addEventListener("mouseout", () => {
            btn.style.backgroundColor = "rgba(13,17,23,0.97)";
        });

        btn.addEventListener("click", () => {
            if (confirm("âš ï¸ Ù‡Ø°Ø§ Ø³ÙŠØ·Ø±Ø¯ ÙƒÙ„ Ø§Ù„Ù„Ø§Ø¹Ø¨ÙŠÙ† ÙˆÙŠÙ…Ø³Ø­ Ø§Ù„Ø¬Ù„Ø³Ø© ÙƒØ§Ù…Ù„Ø©. Ù…ØªØ£ÙƒØ¯ØŸ")) {
                socketService.socket.emit("admin_reset_server");
                btn.remove();
            }
        });

        document.body.appendChild(btn);
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    //  ADMIN PASSWORD POPUP
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    private showAdminPasswordPopup() {
        document.getElementById("admin-pass-overlay")?.remove();

        const overlay = document.createElement("div");
        overlay.id = "admin-pass-overlay";
        Object.assign(overlay.style, {
            position: "fixed", top: "0", left: "0", right: "0", bottom: "0",
            zIndex: "9990", backgroundColor: "rgba(0,0,0,0.78)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "'Courier New', monospace",
        });

        const box = document.createElement("div");
        Object.assign(box.style, {
            backgroundColor: "#0d1117", border: "1px solid #f59e0b",
            borderRadius: "10px", padding: "28px 26px 22px",
            width: "290px", boxShadow: "0 0 50px rgba(245,158,11,0.12)",
        });

        const lockIcon = document.createElement("div");
        lockIcon.textContent = "ðŸ”’";
        lockIcon.style.cssText = "font-size:30px;text-align:center;margin-bottom:10px";

        const title = document.createElement("div");
        title.textContent = "ADMIN ACCESS";
        title.style.cssText = "color:#f59e0b;font-size:12px;letter-spacing:3px;text-align:center;margin-bottom:4px;font-weight:bold";

        const sub = document.createElement("div");
        sub.textContent = "Enter admin password to continue";
        sub.style.cssText = "color:#4a5568;font-size:10px;text-align:center;margin-bottom:18px;letter-spacing:1px";

        const passInput = document.createElement("input");
        passInput.type = "password";
        passInput.placeholder = "Password...";
        Object.assign(passInput.style, {
            width: "100%", padding: "10px 12px", boxSizing: "border-box",
            backgroundColor: "#010409", color: "#f1f5f9",
            border: "1px solid #21262d", borderRadius: "6px",
            fontSize: "14px", fontFamily: "'Courier New', monospace",
            outline: "none", marginBottom: "10px",
        });
        passInput.addEventListener("focus", () => {
            passInput.style.borderColor = "#f59e0b";
            passInput.style.boxShadow = "0 0 0 3px rgba(245,158,11,0.1)";
        });
        passInput.addEventListener("blur", () => {
            passInput.style.borderColor = "#21262d";
            passInput.style.boxShadow = "none";
        });

        const errEl = document.createElement("div");
        errEl.style.cssText = "color:#ef4444;font-size:10px;text-align:center;min-height:16px;margin-bottom:8px;letter-spacing:1px";

        const btnRow = document.createElement("div");
        btnRow.style.cssText = "display:flex;gap:8px;margin-top:4px";

        const cancelBtn = document.createElement("button");
        cancelBtn.textContent = "CANCEL";
        Object.assign(cancelBtn.style, {
            flex: "1", padding: "10px", border: "1px solid #21262d",
            borderRadius: "6px", background: "none", color: "#4a5568",
            fontSize: "10px", letterSpacing: "2px", cursor: "pointer",
            fontFamily: "'Courier New', monospace",
        });

        const confirmBtn = document.createElement("button");
        confirmBtn.textContent = "CONFIRM";
        Object.assign(confirmBtn.style, {
            flex: "1", padding: "10px", border: "none",
            borderRadius: "6px", backgroundColor: "#f59e0b", color: "#000",
            fontSize: "10px", letterSpacing: "2px", cursor: "pointer",
            fontFamily: "'Courier New', monospace", fontWeight: "bold",
        });

        const roles = [
            { key: "player", colHex: 0x22c55e, hex: "#22c55e" },
            { key: "spectator", colHex: 0x8b5cf6, hex: "#8b5cf6" },
            { key: "admin", colHex: 0xf59e0b, hex: "#f59e0b" },
        ];

        const confirm = () => {
            if (passInput.value === ADMIN_PASSWORD) {
                overlay.remove();
                this.activateRole("admin", roles);
                this.showToast("Admin access granted \u2713", "success");
                // â”€â”€â”€ Ø£Ø¸Ù‡Ø± Ø²Ø± RESET SERVER ÙÙŠ Ø§Ù„Ù€ lobby â”€â”€â”€
                this.showAdminResetButton();
                // â”€â”€â”€ Ø¨Ø¹Ø¯ Ø¯Ø®ÙˆÙ„ Ø§Ù„Ø£Ø¯Ù…Ù†ØŒ Ù†Ø·Ù„Ø¨ Ù…Ù†Ù‡ ÙŠØ­Ø· ÙƒÙ„Ù…Ø© Ù…Ø±ÙˆØ± Ø§Ù„Ø¬Ù„Ø³Ø© â”€â”€â”€
                this.time.delayedCall(400, () => this.showSessionPasswordPopup());
            } else {
                errEl.textContent = "Incorrect password";
                passInput.value = "";
                passInput.style.borderColor = "#ef4444";
                passInput.style.boxShadow = "0 0 0 3px rgba(239,68,68,0.1)";
                passInput.focus();
                // shake
                let n = 0;
                const iv = setInterval(() => {
                    box.style.marginLeft = n % 2 === 0 ? "7px" : "-7px";
                    n++;
                    if (n >= 6) { clearInterval(iv); box.style.marginLeft = "0"; }
                }, 55);
            }
        };

        passInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") confirm();
            if (e.key === "Escape") overlay.remove();
        });
        cancelBtn.addEventListener("click", () => overlay.remove());
        confirmBtn.addEventListener("click", confirm);
        overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

        box.appendChild(lockIcon);
        box.appendChild(title);
        box.appendChild(sub);
        box.appendChild(passInput);
        box.appendChild(errEl);
        box.appendChild(btnRow);
        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(confirmBtn);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        setTimeout(() => passInput.focus(), 60);
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    //  SESSION PASSWORD POPUP (Ù„Ù„Ø£Ø¯Ù…Ù† â€” ÙŠØ­Ø· ÙƒÙ„Ù…Ø© Ù…Ø±ÙˆØ± Ø§Ù„Ø¬Ù„Ø³Ø©)
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    private showSessionPasswordPopup() {
        document.getElementById("session-pass-overlay")?.remove();

        const overlay = document.createElement("div");
        overlay.id = "session-pass-overlay";
        Object.assign(overlay.style, {
            position: "fixed", top: "0", left: "0", right: "0", bottom: "0",
            zIndex: "9990", backgroundColor: "rgba(0,0,0,0.78)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "'Courier New', monospace",
        });

        const box = document.createElement("div");
        Object.assign(box.style, {
            backgroundColor: "#0d1117", border: "1px solid #3b82f6",
            borderRadius: "10px", padding: "28px 26px 22px",
            width: "310px", boxShadow: "0 0 50px rgba(59,130,246,0.12)",
        });

        box.innerHTML = `
            <div style="font-size:30px;text-align:center;margin-bottom:10px">ðŸ”‘</div>
            <div style="color:#3b82f6;font-size:12px;letter-spacing:3px;text-align:center;margin-bottom:4px;font-weight:bold">SESSION SETTINGS</div>
            <div style="color:#4a5568;font-size:10px;text-align:center;margin-bottom:18px;letter-spacing:1px">Set password & player count for this session</div>

            <div style="color:#64748b;font-size:9px;letter-spacing:2px;margin-bottom:6px">PASSWORD</div>
            <input id="session-pass-input" type="text" placeholder="e.g. mafia2024" style="width:100%;padding:10px 12px;box-sizing:border-box;background:#010409;color:#f1f5f9;border:1px solid #21262d;border-radius:6px;font-size:14px;font-family:'Courier New',monospace;outline:none;margin-bottom:14px"/>

            <div style="color:#64748b;font-size:9px;letter-spacing:2px;margin-bottom:8px">NUMBER OF PLAYERS</div>
            <div id="count-btns" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
                ${[4, 5, 6, 7, 8, 9, 10].map(n => `
                    <button data-count="${n}" style="flex:1;min-width:36px;padding:8px 4px;border-radius:6px;border:1px solid ${n === 6 ? "#3b82f6" : "rgba(255,255,255,0.08)"};background:${n === 6 ? "#3b82f6" : "transparent"};color:${n === 6 ? "#fff" : "#8b949e"};font-size:12px;font-family:'Courier New',monospace;cursor:pointer">${n}</button>
                `).join("")}
            </div>
            <div id="count-desc" style="color:#3b82f6;font-size:9px;text-align:center;margin-bottom:12px;letter-spacing:1px">6 players â€” 1 Mafia, 1 Doctor, 1 Detective, 3 Citizens</div>

            <div id="session-err" style="color:#ef4444;font-size:10px;text-align:center;min-height:16px;margin-bottom:8px"></div>
            <div style="display:flex;gap:8px">
                <button id="session-skip-btn" style="flex:1;padding:10px;border:1px solid #21262d;border-radius:6px;background:none;color:#4a5568;font-size:10px;letter-spacing:2px;cursor:pointer;font-family:'Courier New',monospace">NO PASSWORD</button>
                <button id="session-set-btn" style="flex:1;padding:10px;border:none;border-radius:6px;background:#3b82f6;color:#fff;font-size:10px;letter-spacing:2px;cursor:pointer;font-family:'Courier New',monospace;font-weight:bold">CONFIRM</button>
            </div>
        `;

        overlay.appendChild(box);
        document.body.appendChild(overlay);

        const input = box.querySelector<HTMLInputElement>("#session-pass-input")!;
        const errEl = box.querySelector<HTMLElement>("#session-err")!;
        const setBtn = box.querySelector<HTMLButtonElement>("#session-set-btn")!;
        const skipBtn = box.querySelector<HTMLButtonElement>("#session-skip-btn")!;

        setTimeout(() => input.focus(), 60);

        // â”€â”€â”€ Ù…Ù†Ø·Ù‚ Ø£Ø²Ø±Ø§Ø± Ø§Ù„Ø¹Ø¯Ø¯ â”€â”€â”€
        let selectedCount = 6;
        const roleDesc: Record<number, string> = {
            4: "4 players â€” 1 Mafia, 1 Doctor, 2 Citizens",
            5: "5 players â€” 1 Mafia, 1 Doctor, 1 Detective, 2 Citizens",
            6: "6 players â€” 1 Mafia, 1 Doctor, 1 Detective, 3 Citizens",
            7: "7 players â€” 2 Mafia, 1 Doctor, 1 Detective, 3 Citizens",
            8: "8 players â€” 2 Mafia, 1 Doctor, 1 Detective, 4 Citizens",
            9: "9 players â€” 2 Mafia, 1 Doctor, 1 Detective, 5 Citizens",
            10: "10 players â€” 3 Mafia, 1 Doctor, 1 Detective, 5 Citizens",
        };
        const descEl = box.querySelector<HTMLElement>("#count-desc")!;
        const countBtns = box.querySelectorAll<HTMLButtonElement>("#count-btns button");
        countBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                selectedCount = parseInt(btn.dataset.count!);
                countBtns.forEach(b => {
                    b.style.background = b === btn ? "#3b82f6" : "transparent";
                    b.style.color = b === btn ? "#fff" : "#8b949e";
                    b.style.borderColor = b === btn ? "#3b82f6" : "rgba(255,255,255,0.08)";
                });
                descEl.textContent = roleDesc[selectedCount] || "";
            });
        });

        const applyPassword = (password: string | null) => {
            socketService.socket.emit("set_session_password", { password: password || "" });
            socketService.socket.emit("set_player_count", { count: selectedCount });
            overlay.remove();
            const countMsg = `${selectedCount} players`;
            if (password) {
                this.showToast(`âœ“ Password: ${password} | ${countMsg}`, "success");
            } else {
                this.showToast(`âœ“ No password | ${countMsg}`, "info");
            }
        };

        setBtn.addEventListener("click", () => {
            const val = input.value.trim();
            if (!val) { errEl.textContent = "Please enter a password"; return; }
            applyPassword(val);
        });

        skipBtn.addEventListener("click", () => applyPassword(null));

        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") setBtn.click();
            if (e.key === "Escape") applyPassword(null);
        });

        input.addEventListener("focus", () => {
            input.style.borderColor = "#3b82f6";
            input.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.1)";
        });
        input.addEventListener("blur", () => {
            input.style.borderColor = "#21262d";
            input.style.boxShadow = "none";
        });
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    //  JOIN BUTTON
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    private createJoinButton(cx: number, cy: number, width: number) {
        const btnH = 48;
        const c = this.add.container(cx, cy).setDepth(3);
        const bg = this.add.rectangle(0, 0, width, btnH, this.C.accent);
        const lbl = this.add.text(0, 0, ar.lobby.joinQueue, {
            fontSize: "12px", color: "#ffffff",
            fontFamily: "'Courier New', monospace", letterSpacing: 4, fontStyle: "bold"
        }).setOrigin(0.5);
        c.add([bg, lbl]);
        c.setInteractive(
            new Phaser.Geom.Rectangle(-width / 2, -btnH / 2, width, btnH),
            Phaser.Geom.Rectangle.Contains
        );
        c.on("pointerover", () => { bg.setFillStyle(this.C.accentHover); this.tweens.add({ targets: c, scaleY: 1.04, duration: 100 }); });
        c.on("pointerout", () => { bg.setFillStyle(this.C.accent); this.tweens.add({ targets: c, scaleY: 1, duration: 100 }); });
        c.on("pointerdown", () => {
            this.tweens.add({ targets: c, scaleX: 0.97, scaleY: 0.97, duration: 70, yoyo: true, onComplete: () => this.handleJoin() });
        });
        this.joinButton = c;
        this.joinBtnLabel = lbl;
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    //  PLAYER PASSWORD PROMPT
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    //  PLAYER JOIN POPUP â€” ÙƒÙ„Ù…Ø© Ø³Ø± Ø£Ùˆ ÙƒÙˆØ¯ Ø±Ø¬ÙˆØ¹
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    private showPlayerJoinPopup(roles: Array<{ key: string; colHex: number; hex: string }>) {
        document.getElementById("player-join-overlay")?.remove();

        const overlay = document.createElement("div");
        overlay.id = "player-join-overlay";
        Object.assign(overlay.style, {
            position: "fixed", top: "0", left: "0", right: "0", bottom: "0",
            zIndex: "9990", backgroundColor: "rgba(0,0,0,0.8)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "'Courier New', monospace",
        });

        const box = document.createElement("div");
        Object.assign(box.style, {
            backgroundColor: "#0d1117", border: "1px solid #22c55e",
            borderRadius: "10px", padding: "24px 22px",
            width: "300px", boxShadow: "0 0 50px rgba(34,197,94,0.1)",
        });

        box.innerHTML = `
            <div style="font-size:28px;text-align:center;margin-bottom:10px">âš”</div>
            <div style="color:#22c55e;font-size:11px;letter-spacing:3px;text-align:center;margin-bottom:16px;font-weight:bold">JOIN AS PLAYER</div>

            <div id="pjp-tabs" style="display:flex;gap:6px;margin-bottom:16px">
                <button id="pjp-tab-password" style="flex:1;padding:8px;border-radius:5px;border:1px solid #22c55e;background:#22c55e;color:#000;font-size:10px;letter-spacing:1px;cursor:pointer;font-family:'Courier New',monospace;font-weight:bold">ÙƒÙ„Ù…Ø© Ø§Ù„Ø³Ø±</button>
                <button id="pjp-tab-code" style="flex:1;padding:8px;border-radius:5px;border:1px solid #21262d;background:none;color:#4a5568;font-size:10px;letter-spacing:1px;cursor:pointer;font-family:'Courier New',monospace">ÙƒÙˆØ¯ Ø§Ù„Ø±Ø¬ÙˆØ¹</button>
            </div>

            <div id="pjp-panel-password">
                <input id="pjp-password-input" type="password" placeholder="Session password..."
                    style="width:100%;padding:10px 12px;box-sizing:border-box;background:#010409;color:#f1f5f9;border:1px solid #21262d;border-radius:6px;font-size:14px;font-family:'Courier New',monospace;outline:none;margin-bottom:8px"/>
            </div>

            <div id="pjp-panel-code" style="display:none">
                <div style="color:#4a5568;font-size:9px;letter-spacing:1px;margin-bottom:10px;direction:rtl;text-align:right;line-height:1.6">Ø£Ø¯Ø®Ù„ Ø§Ø³Ù…Ùƒ ÙƒÙ…Ø§ ÙƒØ§Ù† ÙÙŠ Ø§Ù„Ù„Ø¹Ø¨Ø© ÙˆØ§Ù„ÙƒÙˆØ¯ Ø§Ù„Ø°ÙŠ Ø£Ø¹Ø·Ø§Ùƒ Ø¥ÙŠØ§Ù‡ Ø§Ù„Ø£Ø¯Ù…Ù†</div>
                <input id="pjp-rejoin-name" type="text" placeholder="Your username..."
                    style="width:100%;padding:10px 12px;box-sizing:border-box;background:#010409;color:#f1f5f9;border:1px solid #21262d;border-radius:6px;font-size:14px;font-family:'Courier New',monospace;outline:none;margin-bottom:8px"/>
                <input id="pjp-code-input" type="text" placeholder="123456"
                    style="width:100%;padding:10px 12px;box-sizing:border-box;background:#010409;color:#22c55e;border:1px solid #21262d;border-radius:6px;font-size:22px;font-family:'Courier New',monospace;outline:none;margin-bottom:8px;letter-spacing:8px;text-align:center"/>
            </div>

            <div id="pjp-err" style="color:#ef4444;font-size:10px;text-align:center;min-height:16px;margin-bottom:8px"></div>
            <div style="display:flex;gap:8px">
                <button id="pjp-cancel" style="flex:1;padding:10px;border:1px solid #21262d;border-radius:6px;background:none;color:#4a5568;font-size:10px;letter-spacing:2px;cursor:pointer;font-family:'Courier New',monospace">CANCEL</button>
                <button id="pjp-confirm" style="flex:1;padding:10px;border:none;border-radius:6px;background:#22c55e;color:#000;font-size:10px;letter-spacing:2px;cursor:pointer;font-family:'Courier New',monospace;font-weight:bold">CONFIRM</button>
            </div>
        `;

        overlay.appendChild(box);
        document.body.appendChild(overlay);

        const passwordPanel = box.querySelector<HTMLElement>("#pjp-panel-password")!;
        const codePanel = box.querySelector<HTMLElement>("#pjp-panel-code")!;
        const tabPassword = box.querySelector<HTMLButtonElement>("#pjp-tab-password")!;
        const tabCode = box.querySelector<HTMLButtonElement>("#pjp-tab-code")!;
        const passwordInput = box.querySelector<HTMLInputElement>("#pjp-password-input")!;
        const codeInput = box.querySelector<HTMLInputElement>("#pjp-code-input")!;
        const errEl = box.querySelector<HTMLElement>("#pjp-err")!;
        const confirmBtn = box.querySelector<HTMLButtonElement>("#pjp-confirm")!;
        const cancelBtn = box.querySelector<HTMLButtonElement>("#pjp-cancel")!;

        let activeTab = "password";

        const switchTab = (tab: string) => {
            activeTab = tab;
            if (tab === "password") {
                passwordPanel.style.display = "block";
                codePanel.style.display = "none";
                tabPassword.style.background = "#22c55e";
                tabPassword.style.color = "#000";
                tabPassword.style.borderColor = "#22c55e";
                tabCode.style.background = "none";
                tabCode.style.color = "#4a5568";
                tabCode.style.borderColor = "#21262d";
                setTimeout(() => passwordInput.focus(), 50);
            } else {
                passwordPanel.style.display = "none";
                codePanel.style.display = "block";
                tabCode.style.background = "#22c55e";
                tabCode.style.color = "#000";
                tabCode.style.borderColor = "#22c55e";
                tabPassword.style.background = "none";
                tabPassword.style.color = "#4a5568";
                tabPassword.style.borderColor = "#21262d";
                setTimeout(() => codeInput.focus(), 50);
            }
            errEl.textContent = "";
        };

        tabPassword.addEventListener("click", () => switchTab("password"));
        tabCode.addEventListener("click", () => switchTab("code"));
        setTimeout(() => passwordInput.focus(), 60);

        const confirm = () => {
            errEl.textContent = "";
            confirmBtn.style.opacity = "0.5";
            confirmBtn.style.pointerEvents = "none";

            if (activeTab === "password") {
                // â”€â”€â”€ ÙƒÙ„Ù…Ø© Ø§Ù„Ø³Ø± Ø§Ù„Ø¹Ø§Ø¯ÙŠØ© â”€â”€â”€
                const val = passwordInput.value.trim();
                if (!val) { errEl.textContent = "Ø§Ù„Ø±Ø¬Ø§Ø¡ Ø¥Ø¯Ø®Ø§Ù„ ÙƒÙ„Ù…Ø© Ø§Ù„Ø³Ø±"; confirmBtn.style.opacity = "1"; confirmBtn.style.pointerEvents = "auto"; return; }
                socketService.socket.emit("verify_session_password", { password: val });

                const onOk = () => { socketService.socket.off("password_verify_fail", onFail); overlay.remove(); (this as any)._pendingPlayerPassword = val; this.activateRole("player", roles); this.showToast("âœ“ ÙƒÙ„Ù…Ø© Ø§Ù„Ø³Ø± ØµØ­ â€” Ø§Ø¶ØºØ· JOIN", "success"); };
                const onFail = () => { socketService.socket.off("password_verify_ok", onOk); confirmBtn.style.opacity = "1"; confirmBtn.style.pointerEvents = "auto"; errEl.textContent = "âŒ ÙƒÙ„Ù…Ø© Ø§Ù„Ø³Ø± ØºÙ„Ø·"; passwordInput.value = ""; passwordInput.style.borderColor = "#ef4444"; setTimeout(() => { let n = 0; const iv = setInterval(() => { box.style.marginLeft = n % 2 === 0 ? "7px" : "-7px"; n++; if (n >= 6) { clearInterval(iv); box.style.marginLeft = "0"; } }, 55); }, 0); };
                socketService.socket.once("password_verify_ok", onOk);
                socketService.socket.once("password_verify_fail", onFail);

            } else {
                // â”€â”€â”€ ÙƒÙˆØ¯ Ø§Ù„Ø±Ø¬ÙˆØ¹ â€” Ø§Ø³Ù… + ÙƒÙˆØ¯ â”€â”€â”€
                const rejoinName = (box.querySelector<HTMLInputElement>("#pjp-rejoin-name")?.value || "").trim();
                const code = codeInput.value.trim();

                if (!rejoinName) { errEl.textContent = "Ø£Ø¯Ø®Ù„ Ø§Ø³Ù…Ùƒ"; confirmBtn.style.opacity = "1"; confirmBtn.style.pointerEvents = "auto"; return; }
                if (!code) { errEl.textContent = "Ø£Ø¯Ø®Ù„ Ø§Ù„ÙƒÙˆØ¯"; confirmBtn.style.opacity = "1"; confirmBtn.style.pointerEvents = "auto"; return; }

                socketService.socket.emit("rejoin_with_code", { code, username: rejoinName });

                const onOk = (data: any) => {
                    socketService.socket.off("rejoin_code_error", onErr);
                    overlay.remove();
                    socketService.isAdmin = false;
                    socketService.role = data.role;
                    socketService.roomId = data.roomId;
                    socketService.saveUsername(rejoinName);
                    this.scene.start("GameScene", { role: data.role, roomId: data.roomId, userType: "PLAYER" });
                };
                const onErr = (data: any) => {
                    socketService.socket.off("game_started", onOk);
                    confirmBtn.style.opacity = "1";
                    confirmBtn.style.pointerEvents = "auto";
                    errEl.textContent = data.message || "ÙƒÙˆØ¯ ØºÙ„Ø· âŒ";
                    codeInput.value = "";
                    codeInput.style.borderColor = "#ef4444";
                };
                socketService.socket.once("game_started", onOk);
                socketService.socket.once("rejoin_code_error", onErr);
            }
        };

        confirmBtn.addEventListener("click", confirm);
        cancelBtn.addEventListener("click", () => overlay.remove());
        passwordInput.addEventListener("keydown", e => { if (e.key === "Enter") confirm(); if (e.key === "Escape") overlay.remove(); });
        codeInput.addEventListener("keydown", e => { if (e.key === "Enter") confirm(); if (e.key === "Escape") overlay.remove(); });
    }

    private showPlayerPasswordPrompt(onConfirm: (password: string) => void) {
        document.getElementById("player-pass-overlay")?.remove();

        const overlay = document.createElement("div");
        overlay.id = "player-pass-overlay";
        Object.assign(overlay.style, {
            position: "fixed", top: "0", left: "0", right: "0", bottom: "0",
            zIndex: "9990", backgroundColor: "rgba(0,0,0,0.78)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "'Courier New', monospace",
        });

        const box = document.createElement("div");
        Object.assign(box.style, {
            backgroundColor: "#0d1117", border: "1px solid #22c55e",
            borderRadius: "10px", padding: "28px 26px 22px",
            width: "300px", boxShadow: "0 0 50px rgba(34,197,94,0.1)",
        });

        box.innerHTML = `
            <div style="font-size:30px;text-align:center;margin-bottom:10px">ðŸŽ®</div>
            <div style="color:#22c55e;font-size:12px;letter-spacing:3px;text-align:center;margin-bottom:4px;font-weight:bold">SESSION PASSWORD</div>
            <div style="color:#4a5568;font-size:10px;text-align:center;margin-bottom:18px;letter-spacing:1px">Enter the password provided by the admin</div>
            <input id="player-pass-input" type="password" placeholder="Session password..." style="width:100%;padding:10px 12px;box-sizing:border-box;background:#010409;color:#f1f5f9;border:1px solid #21262d;border-radius:6px;font-size:14px;font-family:'Courier New',monospace;outline:none;margin-bottom:8px"/>
            <div id="player-pass-err" style="color:#ef4444;font-size:10px;text-align:center;min-height:16px;margin-bottom:8px"></div>
            <div style="display:flex;gap:8px">
                <button id="player-pass-cancel" style="flex:1;padding:10px;border:1px solid #21262d;border-radius:6px;background:none;color:#4a5568;font-size:10px;letter-spacing:2px;cursor:pointer;font-family:'Courier New',monospace">CANCEL</button>
                <button id="player-pass-confirm" style="flex:1;padding:10px;border:none;border-radius:6px;background:#22c55e;color:#000;font-size:10px;letter-spacing:2px;cursor:pointer;font-family:'Courier New',monospace;font-weight:bold">CONFIRM</button>
            </div>
        `;

        overlay.appendChild(box);
        document.body.appendChild(overlay);

        const input = box.querySelector<HTMLInputElement>("#player-pass-input")!;
        const errEl = box.querySelector<HTMLElement>("#player-pass-err")!;
        const confirmBtn = box.querySelector<HTMLButtonElement>("#player-pass-confirm")!;
        const cancelBtn = box.querySelector<HTMLButtonElement>("#player-pass-cancel")!;

        setTimeout(() => input.focus(), 60);

        const confirm = () => {
            const val = input.value.trim();
            if (!val) { errEl.textContent = "Ø§Ù„Ø±Ø¬Ø§Ø¡ Ø¥Ø¯Ø®Ø§Ù„ ÙƒÙ„Ù…Ø© Ø§Ù„Ø³Ø±"; return; }

            // â”€â”€â”€ Ù†Ø¨Ø¹Ø« Ù„Ù„Ø³ÙŠØ±ÙØ± ÙŠØªØ­Ù‚Ù‚ â”€â”€â”€
            confirmBtn.style.opacity = "0.5";
            confirmBtn.style.pointerEvents = "none";
            errEl.textContent = "";

            socketService.socket.emit("verify_session_password", { password: val });

            // Ù†Ø³ØªÙ†Ù‰ Ø±Ø¯ Ø§Ù„Ø³ÙŠØ±ÙØ±
            const onOk = () => {
                socketService.socket.off("password_verify_ok", onOk);
                socketService.socket.off("password_verify_fail", onFail);
                overlay.remove();
                onConfirm(val);
            };
            const onFail = () => {
                socketService.socket.off("password_verify_ok", onOk);
                socketService.socket.off("password_verify_fail", onFail);
                // Ø±Ø¬Ù‘Ø¹ Ø§Ù„Ø²Ø± ÙˆØ£Ø¸Ù‡Ø± Ø§Ù„Ø®Ø·Ø£
                confirmBtn.style.opacity = "1";
                confirmBtn.style.pointerEvents = "auto";
                errEl.textContent = "âŒ ÙƒÙ„Ù…Ø© Ø§Ù„Ø³Ø± ØºÙ„Ø·";
                input.value = "";
                input.style.borderColor = "#ef4444";
                input.style.boxShadow = "0 0 0 3px rgba(239,68,68,0.1)";
                input.focus();
                // shake
                let n = 0;
                const iv = setInterval(() => {
                    box.style.marginLeft = n % 2 === 0 ? "7px" : "-7px";
                    n++;
                    if (n >= 6) { clearInterval(iv); box.style.marginLeft = "0"; }
                }, 55);
            };

            socketService.socket.once("password_verify_ok", onOk);
            socketService.socket.once("password_verify_fail", onFail);
        };

        confirmBtn.addEventListener("click", confirm);
        cancelBtn.addEventListener("click", () => overlay.remove());
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") confirm();
            if (e.key === "Escape") overlay.remove();
        });
        input.addEventListener("focus", () => {
            input.style.borderColor = "#22c55e";
            input.style.boxShadow = "0 0 0 3px rgba(34,197,94,0.1)";
        });
        input.addEventListener("blur", () => {
            input.style.borderColor = "#21262d";
            input.style.boxShadow = "none";
        });
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    //  HANDLE JOIN
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    private handleJoin() {
        const username = this.usernameInput?.value.trim();
        if (!username || username.length < 2) {
            this.showToast(ar.lobby.usernameMin, "error");
            this.shakeInput();
            return;
        }
        socketService.reset();
        socketService.saveUsername(username); // â”€â”€â”€ Ù†Ø­ÙØ¸ Ø§Ù„Ø§Ø³Ù… â”€â”€â”€
        socketService.socket.emit("set_username", username);
        socketService.socket.emit("set_avatar", "ðŸ˜Ž");
        socketService.socket.emit("set_color", "#1e293b");

        if (this.selectedType === "admin") {
            socketService.isAdmin = true;
            socketService.socket.emit("join_admin");
            this.joinBtnLabel.setText(ar.lobby.connecting);
            this.showToast(ar.lobby.adminJoining, "info");
        } else if (this.selectedType === "spectator") {
            socketService.socket.emit("spectator_join_game");
            this.joinBtnLabel.setText(ar.lobby.searching);
            this.showToast(ar.lobby.spectatorJoining, "info");
        } else {
            // â”€â”€â”€ Ø§Ù„Ù„Ø§Ø¹Ø¨ â€” ÙŠØ³ØªØ®Ø¯Ù… ÙƒÙ„Ù…Ø© Ø§Ù„Ø³Ø± Ø§Ù„Ù…Ø­ÙÙˆØ¸Ø© Ù…Ù† Ø§Ù„Ù€ popup â”€â”€â”€
            const password = (this as any)._pendingPlayerPassword || "";
            if (!password) {
                this.showToast("Ø§Ø®ØªØ± PLAYER ÙˆØ­Ø· ÙƒÙ„Ù…Ø© Ø§Ù„Ø³Ø± Ø£ÙˆÙ„Ø§Ù‹", "error");
                return;
            }
            socketService.socket.emit("join_queue", { type: "player", password });
            this.joinBtnLabel.setText(ar.lobby.joining);
            this.showToast(ar.lobby.playerJoining, "success");
        }

        this.joinButton.setAlpha(0.6);
        this.joinButton.disableInteractive();
        this.time.delayedCall(2500, () => {
            if (this.joinButton?.active) {
                this.joinButton.setAlpha(1);
                this.joinBtnLabel.setText(ar.lobby.joinQueue);
                this.joinButton.setInteractive(
                    new Phaser.Geom.Rectangle(-172, -24, 344, 48),
                    Phaser.Geom.Rectangle.Contains
                );
            }
        });
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    //  SOCKET EVENTS
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    private setupSocketEvents() {
        ["game_started", "queue_update", "error", "connect", "connect_error", "waiting_for_players", "admin_joined"]
            .forEach(ev => socketService.socket.off(ev));

        socketService.socket.on("queue_update", (data: any) => {
            if (!this.queueStatusText?.active) return;
            const size = data.queueSize || 0;
            const required = data.required || (this as any)._requiredPlayers || 6;
            const color = size >= required - 1 ? "#22c55e" : size >= Math.floor(required / 2) ? "#f59e0b" : "#3b4a5c";
            this.queueStatusText.setText(`â—  ${size} / ${required} in queue`).setColor(color);
        });

        socketService.socket.on("error", (data: any) => {
            this.showToast(data.message, "error");
            if (this.joinButton?.active) {
                this.joinBtnLabel?.setText(ar.lobby.joinQueue);
                this.joinButton.setAlpha(1);
                this.joinButton.setInteractive(
                    new Phaser.Geom.Rectangle(-172, -24, 344, 48),
                    Phaser.Geom.Rectangle.Contains
                );
            }
            // Ù„Ùˆ ÙƒØ§Ù†Øª Ø§Ù„Ù…Ø´ÙƒÙ„Ø© ÙƒÙ„Ù…Ø© Ø³Ø± ØºÙ„Ø· â€” Ù†Ø±Ø¬Ø¹ Ø§Ù„Ù€ popup
            if (data.message && data.message.includes("ÙƒÙ„Ù…Ø© Ø§Ù„Ø³Ø±")) {
                this.time.delayedCall(300, () => {
                    this.showPlayerPasswordPrompt((password) => {
                        socketService.socket.emit("join_queue", { type: "player", password });
                        this.joinBtnLabel?.setText(ar.lobby.joining);
                        this.joinButton.setAlpha(0.6);
                        this.joinButton.disableInteractive();
                    });
                });
            }
        });

        socketService.socket.on("admin_joined", () => this.showToast("Admin panel ready \u2713", "success"));

        socketService.socket.on("waiting_for_players", (data: any) => {
            this.showToast(data.message || ar.lobby.waitingForPlayers, "info");
            if (this.queueStatusText?.active)
                this.queueStatusText.setText("â—  Waiting for players...").setColor("#f59e0b");
            if (this.joinButton?.active) {
                this.joinBtnLabel?.setText(ar.lobby.joinQueue);
                this.joinButton.setAlpha(1);
                this.joinButton.setInteractive(
                    new Phaser.Geom.Rectangle(-172, -24, 344, 48),
                    Phaser.Geom.Rectangle.Contains
                );
            }
        });

        socketService.socket.on("game_started", (data: any) => {
            let userType = "PLAYER";
            if (data.role === "ADMIN") { userType = "ADMIN"; socketService.isAdmin = true; }
            else if (data.role === "SPECTATOR") { userType = "SPECTATOR"; }
            this.cleanupAllLobbyHTML();

            // â”€â”€â”€ Ø§Ù…Ø³Ø­ Ø§Ù„ÙÙŠØ¯ÙŠÙˆ ÙˆØ£Ø±Ø¬Ø¹ ÙƒÙ„ Ø´ÙŠ Ù„Ø­Ø§Ù„ØªÙ‡ Ù‚Ø¨Ù„ Ø§Ù„Ø§Ù†ØªÙ‚Ø§Ù„ â”€â”€â”€
            document.getElementById("lobby-bg-video")?.remove();
            document.body.style.background = "";
            document.body.style.margin = "";
            const gameDiv = document.getElementById("game");
            if (gameDiv) {
                gameDiv.style.background = "";
                gameDiv.style.position = "";
                gameDiv.style.top = ""; gameDiv.style.left = "";
                gameDiv.style.width = ""; gameDiv.style.height = "";
            }
            const canvas = document.querySelector("canvas");
            if (canvas) {
                const el = canvas as HTMLElement;
                el.style.background = "";
                el.style.position = "";
                el.style.top = ""; el.style.left = "";
                el.style.zIndex = "";
            }

            this.cameras.main.fadeOut(400, 6, 8, 16);
            this.time.delayedCall(400, () => {
                this.scene.start("GameScene", { role: data.role, roomId: data.roomId, userType });
            });
        });

        socketService.socket.on("connect", () => this.showToast(ar.lobby.connected, "success"));
        socketService.socket.on("connect_error", () => this.showToast(ar.lobby.cannotConnect, "error"));
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    //  BACKGROUND
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    //  VIDEO BACKGROUND
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    private startBgVideo() {
        // Ø§Ù„ÙÙŠØ¯ÙŠÙˆ Ù…ÙˆØ¬ÙˆØ¯ ÙˆÙ…Ø´ØºÙ‘Ù„ Ù…Ù† showSplashScreen + enterLobby
        // Ù‡Ù†Ø§ ÙÙ‚Ø· Ù†Ø®Ù„ÙŠ Ø§Ù„Ù€ canvas Ø´ÙØ§Ù Ø¹Ø´Ø§Ù† ÙŠØ¨ÙŠÙ‘Ù† Ø§Ù„ÙÙŠØ¯ÙŠÙˆ Ù…Ù† ØªØ­ØªÙ‡

        document.body.style.background = "transparent";
        document.body.style.margin = "0";

        const gameDiv = document.getElementById("game");
        if (gameDiv) {
            gameDiv.style.background = "transparent";
            gameDiv.style.position = "fixed";
            gameDiv.style.top = "0"; gameDiv.style.left = "0";
            gameDiv.style.width = "100%"; gameDiv.style.height = "100%";
        }

        const canvas = document.querySelector("canvas");
        if (canvas) {
            const el = canvas as HTMLElement;
            el.style.background = "transparent";
            el.style.position = "fixed";
            el.style.top = "0"; el.style.left = "0";
            el.style.zIndex = "10";
        }
    }

    private drawBackground(W: number, H: number) {
        const grid = this.add.graphics().setDepth(0);
        grid.fillStyle(0x1a2035, 0.45);
        for (let x = 0; x <= W; x += 44)
            for (let y = 0; y <= H; y += 44)
                grid.fillCircle(x, y, 1);

        for (let i = 0; i < 22; i++) {
            const gfx = this.add.graphics().setDepth(0);
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.1 + Math.random() * 0.22;
            this.particles.push({
                gfx,
                x: Phaser.Math.Between(0, W),
                y: Phaser.Math.Between(0, H),
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: Phaser.Math.Between(1, 3),
                alpha: 0.07 + Math.random() * 0.28,
                pulseSpeed: 0.007 + Math.random() * 0.014,
                pulseOffset: Math.random() * Math.PI * 2
            });
        }
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    //  UTILITIES
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    private showToast(message: string, type: "success" | "error" | "info") {
        const cm = { success: { bg: 0x052e16, border: 0x22c55e, text: "#22c55e" }, error: { bg: 0x2d0a0a, border: 0xef4444, text: "#ef4444" }, info: { bg: 0x0a1628, border: 0x3b82f6, text: "#3b82f6" } }[type];
        const W = this.scale.width;
        const toast = this.add.container(W / 2, this.scale.height - 30).setDepth(10);
        const bg = this.add.rectangle(0, 0, Math.min(message.length * 8 + 40, 420), 38, cm.bg);
        bg.setStrokeStyle(1, cm.border);
        const txt = this.add.text(0, 0, message, { fontSize: "12px", color: cm.text, fontFamily: "'Courier New', monospace" }).setOrigin(0.5);
        toast.add([bg, txt]).setAlpha(0);
        this.tweens.add({ targets: toast, alpha: 1, y: this.scale.height - 60, duration: 280 });
        this.time.delayedCall(2500, () =>
            this.tweens.add({ targets: toast, alpha: 0, y: this.scale.height - 40, duration: 280, onComplete: () => toast.destroy() })
        );
    }

    private shakeInput() {
        this.usernameInput.style.borderColor = "#ef4444";
        this.usernameInput.style.boxShadow = "0 0 0 3px rgba(239,68,68,0.2)";
        let n = 0;
        const orig = this.usernameInput.style.left;
        const iv = setInterval(() => {
            this.usernameInput.style.left = `${parseInt(orig) + (n % 2 === 0 ? 5 : -5)}px`;
            n++;
            if (n >= 6) { clearInterval(iv); this.usernameInput.style.left = orig; this.usernameInput.style.borderColor = "#21262d"; this.usernameInput.style.boxShadow = "none"; }
        }, 50);
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    //  UPDATE
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    update(time: number, _delta: number) {
        const W = this.scale.width;
        const H = this.scale.height;
        this.particles.forEach(p => {
            p.x += p.vx; p.y += p.vy;
            if (p.x < 0 || p.x > W) p.vx *= -1;
            if (p.y < 0 || p.y > H) p.vy *= -1;
            const a = Math.max(0, Math.min(1, p.alpha + Math.sin(time * p.pulseSpeed + p.pulseOffset) * 0.1));
            p.gfx.clear(); p.gfx.fillStyle(0x3b82f6, a); p.gfx.fillCircle(p.x, p.y, p.radius);
        });
        let lines = this.children.getByName("connLines") as Phaser.GameObjects.Graphics;
        if (!lines) lines = this.add.graphics().setName("connLines").setDepth(0);
        lines.clear();
        for (let i = 0; i < this.particles.length; i++)
            for (let j = i + 1; j < this.particles.length; j++) {
                const dx = this.particles[i].x - this.particles[j].x, dy = this.particles[i].y - this.particles[j].y;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < 110) { lines.lineStyle(1, 0x3b82f6, (1 - d / 110) * 0.07); lines.moveTo(this.particles[i].x, this.particles[i].y); lines.lineTo(this.particles[j].x, this.particles[j].y); lines.strokePath(); }
            }
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    //  SHUTDOWN
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // â”€â”€â”€ Ù…Ø³Ø­ ÙƒÙ„ HTML elements Ø¯ÙØ¹Ø© ÙˆØ§Ø­Ø¯Ø© â”€â”€â”€
    private cleanupAllLobbyHTML() {
        const ids = [
            "lobby-username",
            "admin-pass-overlay",
            "splash-btn",
            "lobby-hero-title",
            "lobby-mobile-title",
            "lobby-card-tag",
            "lobby-card-overlay",
            "global-mute-btn",
            "admin-reset-btn",
        ];
        ids.forEach(id => document.getElementById(id)?.remove());
        // Ù…Ù„Ø§Ø­Ø¸Ø©: lobby-bg-video Ùˆ global-audio-ctrl Ù„Ø§ ÙŠÙÙ…Ø³Ø­Ø§Ù† - ÙŠØ¶Ù„Ø§Ù† Ø¸Ø§Ù‡Ø±ÙŠÙ†
    }

    shutdown() {
        if (this.playerCountInterval) clearInterval(this.playerCountInterval);
        this.cleanupAllLobbyHTML();

        // â”€â”€â”€ Ù…Ø³Ø­ Ø§Ù„ÙÙŠØ¯ÙŠÙˆ ÙˆØ¥Ø±Ø¬Ø§Ø¹ ÙƒÙ„ Ø´ÙŠ Ù„Ø­Ø§Ù„ØªÙ‡ Ø§Ù„Ø·Ø¨ÙŠØ¹ÙŠØ© â”€â”€â”€
        document.getElementById("lobby-bg-video")?.remove();
        document.body.style.background = "";
        document.body.style.margin = "";

        const gameDiv = document.getElementById("game");
        if (gameDiv) {
            gameDiv.style.background = "";
            gameDiv.style.position = "";
            gameDiv.style.top = "";
            gameDiv.style.left = "";
            gameDiv.style.width = "";
            gameDiv.style.height = "";
        }

        const canvas = document.querySelector("canvas");
        if (canvas) {
            const el = canvas as HTMLElement;
            el.style.background = "";
            el.style.position = "";
            el.style.top = "";
            el.style.left = "";
            el.style.zIndex = "";
        }

        this.particles.forEach(p => p.gfx.destroy());
        this.particles = [];
        ["game_started", "queue_update", "error", "connect", "connect_error", "waiting_for_players", "admin_joined", "session_password_set", "session_password_ready", "session_reset", "server_reset", "player_count_updated"]
            .forEach(ev => socketService.socket.off(ev));
    }
}


