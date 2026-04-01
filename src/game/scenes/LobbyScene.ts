// LobbyScene.ts - النسخة النهائية مع كل التصحيحات العربية
import Phaser from "phaser";
import { socketService } from "../../socket";
import { audioManager } from "../../AudioManager";
import { ar, ARABIC_FONT_FAMILY } from "../../i18n";
import { voiceManager } from "../../VoiceManager";

// كلمة سر الأدمن
const ADMIN_PASSWORD = "123123321123";

export default class LobbyScene extends Phaser.Scene {

    private usernameInput!: HTMLInputElement;
    private selectedType: string = "spectator";
    private sessionPasswordReady: boolean = false;
    private roleBtnW: number = 0;
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

    create() {
        voiceManager.destroy();
        const saved = socketService.getSavedSession();
        if (saved) {
            this.tryRejoin(saved);
            return;
        }
        this.setupSessionListeners();
        this.showSplashScreen();
    }

    private setupSessionListeners() {
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
                if (icon) icon.setText("🔒");
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
            this.showToast(data.message || ar.lobby.sessionReset, "error");
        });

        socketService.socket.on("server_reset", () => {
            socketService.reset();
            (this as any)._pendingPlayerPassword = null;
            this.showToast(ar.lobby.serverReset, "info");
            this.time.delayedCall(800, () => { this.scene.restart(); });
        });

        socketService.socket.on("player_count_updated", (data: any) => {
            (this as any)._requiredPlayers = data.required || 6;
            if (this.queueStatusText?.active) {
                this.queueStatusText.setText(ar.lobby.queueCount(0, data.required)).setColor("#3b4a5c");
            }
        });
    }

    private tryRejoin(saved: { roomId: string; username: string; role: string; playerId: string | null }) {
        const W = this.scale.width;
        const H = this.scale.height;
        this.cameras.main.setBackgroundColor("#060810");
        this.add.rectangle(0, 0, W, H, 0x060810).setOrigin(0);

        const msg = this.add.text(W / 2, H / 2 - 20, ar.lobby.reconnecting, {
            fontSize: "18px", color: "#3b82f6",
            fontFamily: "'Courier New', monospace", letterSpacing: 3,
            align: "center"
        }).setOrigin(0.5);
        const sub = this.add.text(W / 2, H / 2 + 20, ar.lobby.welcomeBack(saved.username), {
            fontSize: "12px", color: "#4a5568",
            fontFamily: "'Courier New', monospace",
            align: "center"
        }).setOrigin(0.5);

        socketService.saveUsername(saved.username);

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
                playerId: saved.playerId,
            });

            const timeout = this.time.delayedCall(5000, () => {
                socketService.socket.off("rejoin_failed");
                socketService.socket.off("game_started");
                msg.setText(ar.lobby.connectionTimeout);
                goToLobby();
            });

            socketService.socket.once("rejoin_failed", () => {
                timeout.remove();
                msg.setText("انتهت الجلسة");
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

        const bg = this.add.rectangle(W / 2, H / 2, W, H, 0x000000).setDepth(0);
        const img = this.add.image(W / 2, H / 2, "welcome").setDepth(1).setAlpha(0);

        const isMobile = W < 700;
        const scaleX = W / img.width;
        const scaleY = H / img.height;
        img.setScale(isMobile ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY) * 0.85);

        this.tweens.add({ targets: img, alpha: 1, duration: 900, delay: 200 });

        const btn = document.createElement("button");
        btn.id = "splash-btn";
        btn.textContent = ar.lobby.enterSociety;
        Object.assign(btn.style, {
            position: "fixed",
            bottom: "60px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: "2000",
            padding: "14px 36px",
            fontSize: "20px",
            fontFamily: ARABIC_FONT_FAMILY,
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

        audioManager.createMuteButton();

        this.time.delayedCall(900, () => { btn.style.opacity = "1"; });

        let entered = false;
        const enterLobby = () => {
            if (entered) return;
            entered = true;
            audioManager.play();

            document.getElementById("lobby-bg-video")?.remove();
            const vid = document.createElement("video");
            vid.id = "lobby-bg-video";
            vid.src = "/bg-desktop.mp4";
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
            vid.play().catch(() => { });

            btn.style.opacity = "0";
            this.tweens.add({ targets: [bg, img], alpha: 0, duration: 450 });
            this.time.delayedCall(500, () => {
                this.cleanupAllLobbyHTML();
                this.initLobby();
            });
        };

        btn.addEventListener("click", enterLobby);

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

    private buildDesktopLayout(W: number, H: number) {
        const cy = H / 2;
        const heroW = Math.floor(W * 0.55);
        const formW = W - heroW;
        const heroCx = heroW / 2;
        const formCx = heroW + formW / 2;

        const cardPad = 40;
        const cardW = formW - cardPad * 2;
        const cardH = Math.min(H - 80, 460);
        const cardTop = cy - cardH / 2;

        this.add.rectangle(formCx, cy, cardW + 6, cardH + 6, 0x3b82f6, 0.08).setDepth(1);
        const card = this.add.rectangle(formCx, cy, cardW, cardH, 0x060810, 0.94).setDepth(2);
        card.setStrokeStyle(1, this.C.cardBorder);

        this.add.rectangle(formCx, cardTop + 2, cardW - 2, 3, this.C.accent)
            .setOrigin(0.5, 0).setDepth(3);

        const sepLine = this.add.graphics().setDepth(1);
        sepLine.lineStyle(1, this.C.cardBorder, 0.6);
        sepLine.moveTo(heroW, H * 0.1);
        sepLine.lineTo(heroW, H * 0.9);
        sepLine.strokePath();

        const pad = 28;
        const fL = formCx - cardW / 2 + pad;
        let posY = cardTop + 30;

        const cardTagEl = document.createElement("div");
        cardTagEl.id = "lobby-card-tag";
        cardTagEl.textContent = ar.lobby.cardTag;
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

        this.addFieldLabel(fL, posY, ar.lobby.usernameLabel);
        posY += 18;
        this.createUsernameInput(fL, posY, cardW - pad * 2);
        posY += 56;

        this.addFieldLabel(fL, posY, ar.lobby.joinAsLabel);
        posY += 18;
        this.createRoleButtons(formCx, posY + 32, cardW - pad * 2);
        posY += 90;

        const btnY = cardTop + cardH - 72;
        this.createJoinButton(formCx, btnY, cardW - pad * 2);

        this.queueStatusText = this.add.text(formCx, cardTop + cardH - 32,
            ar.lobby.queueCount(0, 6), {
            fontSize: "11px", color: "#3b4a5c",
            fontFamily: "'Courier New', monospace", letterSpacing: 1,
            align: "center"
        }).setOrigin(0.5).setDepth(3);

        card.setAlpha(0);
        this.tweens.add({ targets: card, alpha: 1, duration: 600, delay: 150 });

        this.buildDesktopHero(heroCx, cy, heroW);
    }

    private buildDesktopHero(cx: number, cy: number, heroW: number) {
        const s = Math.min(heroW * 0.06, 24);
        const icon = this.add.graphics().setDepth(2).setAlpha(0);
        icon.fillStyle(this.C.accent, 1);
        icon.fillTriangle(cx - s, cy - s * 3.2, cx + s, cy - s * 3.2, cx, cy - s * 1.5);
        icon.fillTriangle(cx - s, cy - s * 1.2, cx + s, cy - s * 1.2, cx, cy - s * 2.9);
        this.tweens.add({ targets: icon, alpha: 0.85, duration: 800, delay: 100 });

        const lineW = Math.min(heroW * 0.3, 120);
        const g1 = this.add.graphics().setDepth(2);
        g1.lineStyle(1, this.C.accent, 0.22);
        g1.moveTo(cx - lineW / 2, cy - s * 4.2); g1.lineTo(cx + lineW / 2, cy - s * 4.2); g1.strokePath();

        const titleSize = Math.min(Math.floor(heroW * 0.055), 28);
        const titleEl = document.createElement("div");
        titleEl.id = "lobby-hero-title";
        titleEl.textContent = ar.appTitle;
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

        const t1 = this.add.rectangle(cx, cy - 10, 10, titleSize * 2.4, 0x000000, 0).setDepth(2);

        const t2 = this.add.text(cx, cy + titleSize + 22, ar.lobby.subtitle, {
            fontSize: "10px", color: "#3b82f6",
            fontFamily: "'Courier New', monospace", letterSpacing: 3,
            align: "center"
        }).setOrigin(0.5).setDepth(2).setAlpha(0);
        this.tweens.add({ targets: t2, alpha: 1, duration: 600, delay: 400 });

        const g2 = this.add.graphics().setDepth(2);
        g2.lineStyle(1, this.C.accent, 0.12);
        g2.moveTo(cx - lineW / 2, cy + titleSize + 50); g2.lineTo(cx + lineW / 2, cy + titleSize + 50); g2.strokePath();

        const t3 = this.add.text(cx, cy + titleSize + 68, ar.lobby.tagline, {
            fontSize: "13px", color: "#2d3748",
            fontFamily: "'Georgia', serif", fontStyle: "italic",
            align: "center"
        }).setOrigin(0.5).setDepth(2).setAlpha(0);
        this.tweens.add({ targets: t3, alpha: 1, duration: 600, delay: 550 });

        const baseY = cy + titleSize + 108;
        [
            { ico: "🔪", text: ar.lobby.featureHiddenRoles },
            { ico: "🗳", text: ar.lobby.featureStrategicVoting },
            { ico: "🌙", text: ar.lobby.featureNightElimination },
        ].forEach((item, i) => {
            const f = this.add.text(cx, baseY + i * 32, `${item.ico}  ${item.text}`, {
                fontSize: "12px", color: "#1a2535",
                fontFamily: "'Courier New', monospace", letterSpacing: 1,
                align: "center"
            }).setOrigin(0.5).setDepth(2).setAlpha(0);
            this.tweens.add({ targets: f, alpha: 1, duration: 500, delay: 650 + i * 100 });
        });
    }

    private buildMobileLayout(W: number, H: number) {
        const cx = W / 2;
        const pad = 16;

        const headerH = 108;

        const icon = this.add.graphics().setDepth(2);
        icon.fillStyle(this.C.accent, 0.9);
        icon.fillTriangle(cx - 10, 28, cx + 10, 28, cx, 44);
        icon.fillTriangle(cx - 10, 50, cx + 10, 50, cx, 34);

        const mTitleEl = document.createElement("div");
        mTitleEl.id = "lobby-mobile-title";
        mTitleEl.textContent = ar.appTitle;
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

        this.add.text(cx, 86, ar.lobby.subtitle, {
            fontSize: "8px", color: "#3b82f6",
            fontFamily: "'Courier New', monospace", letterSpacing: 2,
            align: "center"
        }).setOrigin(0.5).setDepth(2);

        const cardW = W - pad * 2;
        const cardH = H - headerH - pad;
        const cardCX = cx;
        const cardCY = headerH + cardH / 2;
        const cardT = headerH;

        const card = this.add.rectangle(cardCX, cardCY, cardW, cardH, 0x060810, 0.94).setDepth(1);
        card.setStrokeStyle(1, this.C.cardBorder);

        this.add.rectangle(cardCX, cardT + 2, cardW - 2, 3, this.C.accent)
            .setOrigin(0.5, 0).setDepth(2);

        const fL = cardCX - cardW / 2 + 18;
        let posY = cardT + 24;

        this.addFieldLabel(fL, posY, ar.lobby.usernameLabel);
        posY += 17;
        this.createUsernameInput(fL, posY, cardW - 36);
        posY += 58;

        this.addFieldLabel(fL, posY, ar.lobby.joinAsLabel);
        posY += 18;
        this.createRoleButtons(cardCX, posY + 32, cardW - 36);

        const btnY = cardT + cardH - 68;
        const queueY = cardT + cardH - 30;

        this.createJoinButton(cardCX, btnY, cardW - 36);

        this.queueStatusText = this.add.text(cardCX, queueY,
            ar.lobby.queueCount(0, 6), {
            fontSize: "11px", color: "#3b4a5c",
            fontFamily: "'Courier New', monospace", letterSpacing: 1,
            align: "center"
        }).setOrigin(0.5).setDepth(3);
    }

    private addFieldLabel(x: number, y: number, label: string) {
        this.add.text(x, y, label, {
            fontSize: "9px", color: "#4a5568",
            fontFamily: "'Courier New', monospace", letterSpacing: 3,
            align: "right"
        }).setDepth(3);
    }

    private createUsernameInput(x: number, y: number, width: number) {
        document.getElementById("lobby-username")?.remove();
        this.usernameInput = document.createElement("input");
        this.usernameInput.id = "lobby-username";
        this.usernameInput.type = "text";
        this.usernameInput.placeholder = ar.lobby.usernameLabel;
        this.usernameInput.maxLength = 20;
        this.usernameInput.autocomplete = "off";
        Object.assign(this.usernameInput.style, {
            position: "absolute", left: `${x}px`, top: `${y}px`,
            width: `${width}px`, padding: "11px 14px", fontSize: "14px",
            fontFamily: ARABIC_FONT_FAMILY, borderRadius: "6px",
            border: "1px solid #21262d", backgroundColor: "#010409", color: "#f1f5f9",
            outline: "none", zIndex: "1000", letterSpacing: "1px",
            transition: "border-color 0.2s, box-shadow 0.2s",
            direction: "rtl",
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
            { key: "player", label: ar.lobby.rolePlayer, icon: "⚔", colHex: 0x22c55e, hex: "#22c55e" },
            { key: "spectator", label: ar.lobby.roleSpectator, icon: "👁", colHex: 0x8b5cf6, hex: "#8b5cf6" },
            { key: "admin", label: ar.lobby.roleAdmin, icon: "🔒", colHex: 0xf59e0b, hex: "#f59e0b" },
        ];
        const gap = 8;
        const btnW = (totalW - gap * 2) / 3;
        const btnH = 64;
        const sx = cx - totalW / 2 + btnW / 2;
        this.roleBtnW = btnW;
        this.roleBtnH = btnH;

        roles.forEach((role, i) => {
            const bx = sx + i * (btnW + gap);
            const isActive = role.key === this.selectedType;
            const isPlayerLocked = role.key === "player" && !this.sessionPasswordReady;

            const c = this.add.container(bx, cy).setDepth(3);
            if (isPlayerLocked) c.setAlpha(0.4);

            const bg = this.add.rectangle(0, 0, btnW, btnH,
                isActive ? 0x0d1f3c : this.C.card);
            bg.setStrokeStyle(isActive ? 2 : 1,
                isActive ? role.colHex : this.C.cardBorder);

            const displayIcon = isPlayerLocked ? "🔒" : role.icon;
            const iconTxt = this.add.text(0, -12, displayIcon, { fontSize: "20px" }).setOrigin(0.5);
            const lbl = this.add.text(0, 14, role.label, {
                fontSize: "9px", color: isActive ? role.hex : "#4a5568",
                fontFamily: "'Courier New', monospace", letterSpacing: 1, fontStyle: "bold",
                align: "center"
            }).setOrigin(0.5);

            c.add([bg, iconTxt, lbl]);

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

        if (this.sessionPasswordReady) {
            this.time.delayedCall(50, () => this.unlockPlayerButton());
        }
    }

    private unlockPlayerButton() {
        const c = this.roleButtons["player"];
        if (!c) return;
        c.setAlpha(1);
        const iconTxt = c.getData("icon") as Phaser.GameObjects.Text;
        if (iconTxt) iconTxt.setText("⚔");
        c.setInteractive(
            new Phaser.Geom.Rectangle(
                -this.roleBtnW / 2,
                -this.roleBtnH / 2,
                this.roleBtnW,
                this.roleBtnH
            ),
            Phaser.Geom.Rectangle.Contains
        );
        if (!this.roleButtons["player"]?.getData("autoUnlocked")) {
            this.showToast(ar.lobby.roleUnlocked, "success");
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

    private showAdminResetButton() {
        document.getElementById("admin-reset-btn")?.remove();

        const btn = document.createElement("button");
        btn.id = "admin-reset-btn";
        btn.textContent = ar.lobby.resetServerButton;
        Object.assign(btn.style, {
            position: "fixed",
            bottom: "18px",
            right: "18px",
            zIndex: "9999",
            padding: "10px 18px",
            fontSize: "11px",
            fontFamily: ARABIC_FONT_FAMILY,
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
            if (confirm(ar.lobby.resetServerConfirm)) {
                socketService.socket.emit("admin_reset_server");
                btn.remove();
            }
        });

        document.body.appendChild(btn);
    }

    private showAdminPasswordPopup() {
        document.getElementById("admin-pass-overlay")?.remove();

        const overlay = document.createElement("div");
        overlay.id = "admin-pass-overlay";
        Object.assign(overlay.style, {
            position: "fixed", top: "0", left: "0", right: "0", bottom: "0",
            zIndex: "9990", backgroundColor: "rgba(0,0,0,0.78)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: ARABIC_FONT_FAMILY,
        });

        const box = document.createElement("div");
        Object.assign(box.style, {
            backgroundColor: "#0d1117", border: "1px solid #f59e0b",
            borderRadius: "10px", padding: "28px 26px 22px",
            width: "290px", boxShadow: "0 0 50px rgba(245,158,11,0.12)",
            direction: "rtl",
        });

        const lockIcon = document.createElement("div");
        lockIcon.textContent = "🔒";
        lockIcon.style.cssText = "font-size:30px;text-align:center;margin-bottom:10px";

        const title = document.createElement("div");
        title.textContent = ar.lobby.adminAccess;
        title.style.cssText = "color:#f59e0b;font-size:12px;letter-spacing:3px;text-align:center;margin-bottom:4px;font-weight:bold";

        const sub = document.createElement("div");
        sub.textContent = ar.lobby.adminPassword;
        sub.style.cssText = "color:#4a5568;font-size:10px;text-align:center;margin-bottom:18px;letter-spacing:1px";

        const passInput = document.createElement("input");
        passInput.type = "password";
        passInput.placeholder = "كلمة السر...";
        Object.assign(passInput.style, {
            width: "100%", padding: "10px 12px", boxSizing: "border-box",
            backgroundColor: "#010409", color: "#f1f5f9",
            border: "1px solid #21262d", borderRadius: "6px",
            fontSize: "14px", fontFamily: ARABIC_FONT_FAMILY,
            outline: "none", marginBottom: "10px",
            direction: "rtl",
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
        cancelBtn.textContent = ar.lobby.cancel;
        Object.assign(cancelBtn.style, {
            flex: "1", padding: "10px", border: "1px solid #21262d",
            borderRadius: "6px", background: "none", color: "#4a5568",
            fontSize: "10px", letterSpacing: "2px", cursor: "pointer",
            fontFamily: ARABIC_FONT_FAMILY,
        });

        const confirmBtn = document.createElement("button");
        confirmBtn.textContent = ar.lobby.confirm;
        Object.assign(confirmBtn.style, {
            flex: "1", padding: "10px", border: "none",
            borderRadius: "6px", backgroundColor: "#f59e0b", color: "#000",
            fontSize: "10px", letterSpacing: "2px", cursor: "pointer",
            fontFamily: ARABIC_FONT_FAMILY, fontWeight: "bold",
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
                this.showToast("تم الدخول كأدمن ✓", "success");
                this.showAdminResetButton();
                this.time.delayedCall(400, () => this.showSessionPasswordPopup());
            } else {
                errEl.textContent = "كلمة السر غير صحيحة";
                passInput.value = "";
                passInput.style.borderColor = "#ef4444";
                passInput.style.boxShadow = "0 0 0 3px rgba(239,68,68,0.1)";
                passInput.focus();
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

    private showSessionPasswordPopup() {
        document.getElementById("session-pass-overlay")?.remove();

        const overlay = document.createElement("div");
        overlay.id = "session-pass-overlay";
        Object.assign(overlay.style, {
            position: "fixed", top: "0", left: "0", right: "0", bottom: "0",
            zIndex: "9990", backgroundColor: "rgba(0,0,0,0.78)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: ARABIC_FONT_FAMILY,
        });

        const box = document.createElement("div");
        Object.assign(box.style, {
            backgroundColor: "#0d1117", border: "1px solid #3b82f6",
            borderRadius: "10px", padding: "28px 26px 22px",
            width: "310px", boxShadow: "0 0 50px rgba(59,130,246,0.12)",
            direction: "rtl",
        });

        box.innerHTML = `
            <div style="font-size:30px;text-align:center;margin-bottom:10px">🔑</div>
            <div style="color:#3b82f6;font-size:12px;letter-spacing:3px;text-align:center;margin-bottom:4px;font-weight:bold">${ar.lobby.sessionSettings}</div>
            <div style="color:#4a5568;font-size:10px;text-align:center;margin-bottom:18px;letter-spacing:1px">${ar.lobby.setSession}</div>

            <div style="color:#64748b;font-size:9px;letter-spacing:2px;margin-bottom:6px">${ar.lobby.passwordLabel}</div>
            <input id="session-pass-input" type="text" placeholder="${ar.lobby.sessionPasswordPlaceholder}" style="width:100%;padding:10px 12px;box-sizing:border-box;background:#010409;color:#f1f5f9;border:1px solid #21262d;border-radius:6px;font-size:14px;font-family:'Courier New',monospace;outline:none;margin-bottom:14px;direction:rtl"/>

            <div style="color:#64748b;font-size:9px;letter-spacing:2px;margin-bottom:8px">${ar.lobby.playerCountLabel}</div>
            <div id="count-btns" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
                ${[4, 5, 6, 7, 8, 9, 10].map(n => `
                    <button data-count="${n}" style="flex:1;min-width:36px;padding:8px 4px;border-radius:6px;border:1px solid ${n === 6 ? "#3b82f6" : "rgba(255,255,255,0.08)"};background:${n === 6 ? "#3b82f6" : "transparent"};color:${n === 6 ? "#fff" : "#8b949e"};font-size:12px;font-family:'Courier New',monospace;cursor:pointer">${n}</button>
                `).join("")}
            </div>
            <div id="count-desc" style="color:#3b82f6;font-size:9px;text-align:center;margin-bottom:12px;letter-spacing:1px"></div>

            <div id="session-err" style="color:#ef4444;font-size:10px;text-align:center;min-height:16px;margin-bottom:8px"></div>
            <div style="display:flex;gap:8px">
                <button id="session-skip-btn" style="flex:1;padding:10px;border:1px solid #21262d;border-radius:6px;background:none;color:#4a5568;font-size:10px;letter-spacing:2px;cursor:pointer;font-family:'Courier New',monospace">${ar.lobby.noPassword}</button>
                <button id="session-set-btn" style="flex:1;padding:10px;border:none;border-radius:6px;background:#3b82f6;color:#fff;font-size:10px;letter-spacing:2px;cursor:pointer;font-family:'Courier New',monospace;font-weight:bold">${ar.lobby.confirm}</button>
            </div>
        `;

        overlay.appendChild(box);
        document.body.appendChild(overlay);

        const input = box.querySelector<HTMLInputElement>("#session-pass-input")!;
        const errEl = box.querySelector<HTMLElement>("#session-err")!;
        const setBtn = box.querySelector<HTMLButtonElement>("#session-set-btn")!;
        const skipBtn = box.querySelector<HTMLButtonElement>("#session-skip-btn")!;

        setTimeout(() => input.focus(), 60);

        let selectedCount = 6;
        const roleDesc: Record<number, string> = {
            4: "4 لاعبين — 1 مافيا، 1 طبيب، 2 مواطن",
            5: "5 لاعبين — 1 مافيا، 1 طبيب، 1 محقق، 2 مواطن",
            6: "6 لاعبين — 1 مافيا، 1 طبيب، 1 محقق، 3 مواطنون",
            7: "7 لاعبين — 2 مافيا، 1 طبيب، 1 محقق، 3 مواطنون",
            8: "8 لاعبين — 2 مافيا، 1 طبيب، 1 محقق، 4 مواطنون",
            9: "9 لاعبين — 2 مافيا، 1 طبيب، 1 محقق، 5 مواطنون",
            10: "10 لاعبين — 3 مافيا، 1 طبيب، 1 محقق، 5 مواطنون",
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
        descEl.textContent = roleDesc[6];

        const applyPassword = (password: string | null) => {
            socketService.socket.emit("set_session_password", { password: password || "" });
            socketService.socket.emit("set_player_count", { count: selectedCount });
            overlay.remove();
            const countMsg = `${selectedCount} لاعب`;
            if (password) {
                this.showToast(`✓ كلمة السر: ${password} | ${countMsg}`, "success");
            } else {
                this.showToast(`✓ بدون كلمة سر | ${countMsg}`, "info");
            }
        };

        setBtn.addEventListener("click", () => {
            const val = input.value.trim();
            if (!val) { errEl.textContent = "أدخل كلمة السر"; return; }
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

    private showPlayerJoinPopup(roles: Array<{ key: string; colHex: number; hex: string }>) {
        document.getElementById("player-join-overlay")?.remove();

        const overlay = document.createElement("div");
        overlay.id = "player-join-overlay";
        Object.assign(overlay.style, {
            position: "fixed", top: "0", left: "0", right: "0", bottom: "0",
            zIndex: "9990", backgroundColor: "rgba(0,0,0,0.8)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: ARABIC_FONT_FAMILY,
        });

        const box = document.createElement("div");
        Object.assign(box.style, {
            backgroundColor: "#0d1117", border: "1px solid #22c55e",
            borderRadius: "10px", padding: "24px 22px",
            width: "300px", boxShadow: "0 0 50px rgba(34,197,94,0.1)",
            direction: "rtl",
        });

        box.innerHTML = `
            <div style="font-size:28px;text-align:center;margin-bottom:10px">⚔</div>
            <div style="color:#22c55e;font-size:11px;letter-spacing:3px;text-align:center;margin-bottom:16px;font-weight:bold">${ar.lobby.joinAsPlayer}</div>

            <div id="pjp-tabs" style="display:flex;gap:6px;margin-bottom:16px">
                <button id="pjp-tab-password" style="flex:1;padding:8px;border-radius:5px;border:1px solid #22c55e;background:#22c55e;color:#000;font-size:10px;letter-spacing:1px;cursor:pointer;font-family:'Courier New',monospace;font-weight:bold">${ar.lobby.passwordLabel}</button>
                <button id="pjp-tab-code" style="flex:1;padding:8px;border-radius:5px;border:1px solid #21262d;background:none;color:#4a5568;font-size:10px;letter-spacing:1px;cursor:pointer;font-family:'Courier New',monospace">${ar.lobby.rejoinCodeLabel}</button>
            </div>

            <div id="pjp-panel-password">
                <input id="pjp-password-input" type="password" placeholder="${ar.lobby.sessionPasswordPlaceholder}"
                    style="width:100%;padding:10px 12px;box-sizing:border-box;background:#010409;color:#f1f5f9;border:1px solid #21262d;border-radius:6px;font-size:14px;font-family:'Courier New',monospace;outline:none;margin-bottom:8px;direction:rtl"/>
            </div>

            <div id="pjp-panel-code" style="display:none">
                <div style="color:#4a5568;font-size:9px;letter-spacing:1px;margin-bottom:10px;text-align:right;line-height:1.6">${ar.lobby.selectReplacementRole}</div>
                <input id="pjp-rejoin-name" type="text" placeholder="${ar.lobby.rejoinNamePlaceholder}"
                    style="width:100%;padding:10px 12px;box-sizing:border-box;background:#010409;color:#f1f5f9;border:1px solid #21262d;border-radius:6px;font-size:14px;font-family:'Courier New',monospace;outline:none;margin-bottom:8px;direction:rtl"/>
                <input id="pjp-code-input" type="text" placeholder="${ar.lobby.codePlaceholder}"
                    style="width:100%;padding:10px 12px;box-sizing:border-box;background:#010409;color:#22c55e;border:1px solid #21262d;border-radius:6px;font-size:22px;font-family:'Courier New',monospace;outline:none;margin-bottom:8px;letter-spacing:8px;text-align:center;direction:ltr"/>
            </div>

            <div id="pjp-err" style="color:#ef4444;font-size:10px;text-align:center;min-height:16px;margin-bottom:8px"></div>
            <div style="display:flex;gap:8px">
                <button id="pjp-cancel" style="flex:1;padding:10px;border:1px solid #21262d;border-radius:6px;background:none;color:#4a5568;font-size:10px;letter-spacing:2px;cursor:pointer;font-family:'Courier New',monospace">${ar.lobby.cancel}</button>
                <button id="pjp-confirm" style="flex:1;padding:10px;border:none;border-radius:6px;background:#22c55e;color:#000;font-size:10px;letter-spacing:2px;cursor:pointer;font-family:'Courier New',monospace;font-weight:bold">${ar.lobby.confirm}</button>
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
                const val = passwordInput.value.trim();
                if (!val) { errEl.textContent = "❌ كلمة السر غلط"; confirmBtn.style.opacity = "1"; confirmBtn.style.pointerEvents = "auto"; return; }
                socketService.socket.emit("verify_session_password", { password: val });

                const onOk = () => { socketService.socket.off("password_verify_fail", onFail); overlay.remove(); (this as any)._pendingPlayerPassword = val; this.activateRole("player", roles); this.showToast("✓ كلمة السر صحي — اضغط JOIN", "success"); };
                const onFail = () => { socketService.socket.off("password_verify_ok", onOk); confirmBtn.style.opacity = "1"; confirmBtn.style.pointerEvents = "auto"; errEl.textContent = "❌ كلمة السر غلط"; passwordInput.value = ""; passwordInput.style.borderColor = "#ef4444"; setTimeout(() => { let n = 0; const iv = setInterval(() => { box.style.marginLeft = n % 2 === 0 ? "7px" : "-7px"; n++; if (n >= 6) { clearInterval(iv); box.style.marginLeft = "0"; } }, 55); }, 0); };
                socketService.socket.once("password_verify_ok", onOk);
                socketService.socket.once("password_verify_fail", onFail);

            } else {
                const rejoinName = (box.querySelector<HTMLInputElement>("#pjp-rejoin-name")?.value || "").trim();
                const code = codeInput.value.trim();

                if (!rejoinName) { errEl.textContent = "أدخل اسمك"; confirmBtn.style.opacity = "1"; confirmBtn.style.pointerEvents = "auto"; return; }
                if (!code) { errEl.textContent = "أدخل الكود"; confirmBtn.style.opacity = "1"; confirmBtn.style.pointerEvents = "auto"; return; }

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
                    errEl.textContent = data.message || "كود غلط ❌";
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
            fontFamily: ARABIC_FONT_FAMILY,
        });

        const box = document.createElement("div");
        Object.assign(box.style, {
            backgroundColor: "#0d1117", border: "1px solid #22c55e",
            borderRadius: "10px", padding: "28px 26px 22px",
            width: "300px", boxShadow: "0 0 50px rgba(34,197,94,0.1)",
            direction: "rtl",
        });

        box.innerHTML = `
            <div style="font-size:30px;text-align:center;margin-bottom:10px">🎮</div>
            <div style="color:#22c55e;font-size:12px;letter-spacing:3px;text-align:center;margin-bottom:4px;font-weight:bold">${ar.lobby.sessionSettings}</div>
            <div style="color:#4a5568;font-size:10px;text-align:center;margin-bottom:18px;letter-spacing:1px">${ar.lobby.setSession}</div>
            <input id="player-pass-input" type="password" placeholder="${ar.lobby.sessionPasswordPlaceholder}" style="width:100%;padding:10px 12px;box-sizing:border-box;background:#010409;color:#f1f5f9;border:1px solid #21262d;border-radius:6px;font-size:14px;font-family:'Courier New',monospace;outline:none;margin-bottom:8px;direction:rtl"/>
            <div id="player-pass-err" style="color:#ef4444;font-size:10px;text-align:center;min-height:16px;margin-bottom:8px"></div>
            <div style="display:flex;gap:8px">
                <button id="player-pass-cancel" style="flex:1;padding:10px;border:1px solid #21262d;border-radius:6px;background:none;color:#4a5568;font-size:10px;letter-spacing:2px;cursor:pointer;font-family:'Courier New',monospace">${ar.lobby.cancel}</button>
                <button id="player-pass-confirm" style="flex:1;padding:10px;border:none;border-radius:6px;background:#22c55e;color:#000;font-size:10px;letter-spacing:2px;cursor:pointer;font-family:'Courier New',monospace;font-weight:bold">${ar.lobby.confirm}</button>
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
            if (!val) { errEl.textContent = "❌ كلمة السر غلط"; return; }

            confirmBtn.style.opacity = "0.5";
            confirmBtn.style.pointerEvents = "none";
            errEl.textContent = "";

            socketService.socket.emit("verify_session_password", { password: val });

            const onOk = () => {
                socketService.socket.off("password_verify_ok", onOk);
                socketService.socket.off("password_verify_fail", onFail);
                overlay.remove();
                onConfirm(val);
            };
            const onFail = () => {
                socketService.socket.off("password_verify_ok", onOk);
                socketService.socket.off("password_verify_fail", onFail);
                confirmBtn.style.opacity = "1";
                confirmBtn.style.pointerEvents = "auto";
                errEl.textContent = "❌ كلمة السر غلط";
                input.value = "";
                input.style.borderColor = "#ef4444";
                input.style.boxShadow = "0 0 0 3px rgba(239,68,68,0.1)";
                input.focus();
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

    private createJoinButton(cx: number, cy: number, width: number) {
        const btnH = 48;
        const c = this.add.container(cx, cy).setDepth(3);
        const bg = this.add.rectangle(0, 0, width, btnH, this.C.accent);
        const lbl = this.add.text(0, 0, ar.lobby.joinQueue, {
            fontSize: "12px", color: "#ffffff",
            fontFamily: "'Courier New', monospace", letterSpacing: 4, fontStyle: "bold",
            align: "center"
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

    private handleJoin() {
        const username = this.usernameInput?.value.trim();
        if (!username || username.length < 2) {
            this.showToast(ar.lobby.usernameMin, "error");
            this.shakeInput();
            return;
        }
        socketService.reset();
        socketService.saveUsername(username);
        socketService.socket.emit("set_username", username);
        socketService.socket.emit("set_avatar", "😎");
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
            const password = (this as any)._pendingPlayerPassword || "";
            if (!password) {
                this.showToast("اختر PLAYER وحط كلمة السر أولاً", "error");
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

    private setupSocketEvents() {
        ["game_started", "queue_update", "error", "connect", "connect_error", "waiting_for_players", "admin_joined"]
            .forEach(ev => socketService.socket.off(ev));

        socketService.socket.on("queue_update", (data: any) => {
            if (!this.queueStatusText?.active) return;
            const size = data.queueSize || 0;
            const required = data.required || (this as any)._requiredPlayers || 6;
            const color = size >= required - 1 ? "#22c55e" : size >= Math.floor(required / 2) ? "#f59e0b" : "#3b4a5c";
            this.queueStatusText.setText(ar.lobby.queueCount(size, required)).setColor(color);
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
            if (data.message && data.message.includes("كلمة السر")) {
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

        socketService.socket.on("admin_joined", () => this.showToast("لوحة الأدمن جاهزة ✓", "success"));

        socketService.socket.on("waiting_for_players", (data: any) => {
            this.showToast(data.message || ar.lobby.waitingForPlayers, "info");
            if (this.queueStatusText?.active)
                this.queueStatusText.setText(ar.lobby.waitingForPlayers).setColor("#f59e0b");
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

    private startBgVideo() {
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

    private showToast(message: string, type: "success" | "error" | "info") {
        const cm = { success: { bg: 0x052e16, border: 0x22c55e, text: "#22c55e" }, error: { bg: 0x2d0a0a, border: 0xef4444, text: "#ef4444" }, info: { bg: 0x0a1628, border: 0x3b82f6, text: "#3b82f6" } }[type];
        const W = this.scale.width;
        const toast = this.add.container(W / 2, this.scale.height - 30).setDepth(10);
        const bg = this.add.rectangle(0, 0, Math.min(message.length * 8 + 40, 420), 38, cm.bg);
        bg.setStrokeStyle(1, cm.border);
        const txt = this.add.text(0, 0, message, { fontSize: "12px", color: cm.text, fontFamily: ARABIC_FONT_FAMILY, align: "center" }).setOrigin(0.5);
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
    }

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

    shutdown() {
        if (this.playerCountInterval) clearInterval(this.playerCountInterval);
        this.cleanupAllLobbyHTML();

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
