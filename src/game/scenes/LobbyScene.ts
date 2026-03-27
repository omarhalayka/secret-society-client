import Phaser from "phaser";
import { socketService } from "../../socket";
import { audioManager } from "../../AudioManager";

// ─── كلمة سر الأدمن ─────────────────────────────────────────
// غيّرها لأي كلمة تبغاها
const ADMIN_PASSWORD = "123123321123";

export default class LobbyScene extends Phaser.Scene {

    private usernameInput!: HTMLInputElement;
    private selectedType: string = "spectator";
    private sessionPasswordReady: boolean = false;
    private roleBtnW: number = 0; // عرض زر الـ role — للاستخدام في unlockPlayerButton
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

    // ══════════════════════════════════════════════════════
    //  CREATE
    // ══════════════════════════════════════════════════════
    create() {
        // ─── تحقق من جلسة محفوظة أولاً ───
        const saved = socketService.getSavedSession();
        if (saved) {
            this.tryRejoin(saved);
            return;
        }

        this.setupSessionListeners();
        this.showSplashScreen();
    }

    private setupSessionListeners() {
        // ─── سجّل كل session listeners مرة واحدة فقط ───
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
                this.showToast(`✓ Password set: ${data.password}`, "success");
            } else {
                this.sessionPasswordReady = false;
                this.showToast("No password — open session", "info");
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
                this.joinBtnLabel?.setText("JOIN  QUEUE");
                this.joinButton.setAlpha(1);
                this.joinButton.setInteractive(
                    new Phaser.Geom.Rectangle(-172, -24, 344, 48),
                    Phaser.Geom.Rectangle.Contains
                );
            }
            this.showToast(data.message || "تم تغيير كلمة السر — أدخل الكلمة الجديدة", "error");
        });

        socketService.socket.on("server_reset", () => {
            socketService.reset();
            (this as any)._pendingPlayerPassword = null;
            this.showToast("🔄 Server reset by admin", "info");
            this.time.delayedCall(800, () => { this.scene.restart(); });
        });

        socketService.socket.on("player_count_updated", (data: any) => {
            (this as any)._requiredPlayers = data.required || 6;
            if (this.queueStatusText?.active) {
                this.queueStatusText.setText(`●  0 / ${data.required} in queue`).setColor("#3b4a5c");
            }
        });
    }

    // ══════════════════════════════════════════════════════
    //  REJOIN — محاولة الرجوع لجلسة محفوظة
    // ══════════════════════════════════════════════════════
    private tryRejoin(saved: { roomId: string; username: string; role: string }) {
        const W = this.scale.width;
        const H = this.scale.height;
        this.cameras.main.setBackgroundColor("#060810");
        this.add.rectangle(0, 0, W, H, 0x060810).setOrigin(0);

        const msg = this.add.text(W / 2, H / 2 - 20, "Reconnecting...", {
            fontSize: "18px", color: "#3b82f6",
            fontFamily: "'Courier New', monospace", letterSpacing: 3,
        }).setOrigin(0.5);
        const sub = this.add.text(W / 2, H / 2 + 20, `Welcome back, ${saved.username}`, {
            fontSize: "12px", color: "#4a5568",
            fontFamily: "'Courier New', monospace",
        }).setOrigin(0.5);

        socketService.saveUsername(saved.username);

        // ─── cleanup أي listeners قديمة ───
        socketService.socket.off("rejoin_failed");
        socketService.socket.off("game_started");

        const goToLobby = () => {
            socketService.clearSession();
            msg.setColor("#ef4444");
            sub.setText("Starting new session...");
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

            // timeout — لو ما رد السيرفر خلال 5 ثواني
            const timeout = this.time.delayedCall(5000, () => {
                socketService.socket.off("rejoin_failed");
                socketService.socket.off("game_started");
                msg.setText("Connection timeout");
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
            // لو ما اتصل خلال 6 ثواني
            this.time.delayedCall(6000, () => {
                if (!socketService.socket.connected) {
                    msg.setText("Cannot connect to server");
                    goToLobby();
                }
            });
        }
    }

    private showSplashScreen() {
        const W = this.scale.width;
        const H = this.scale.height;

        this.cameras.main.setBackgroundColor("#060810");

        // خلفية سوداء
        const bg = this.add.rectangle(W / 2, H / 2, W, H, 0x000000).setDepth(0);

        // صورة الـ splash
        const img = this.add.image(W / 2, H / 2, "welcome")
            .setDepth(1).setAlpha(0);

        // تناسب الصورة - contain على الديسكتوب، cover على الهاتف
        const isMobile = W < 700;
        const scaleX = W / img.width;
        const scaleY = H / img.height;
        img.setScale(isMobile ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY) * 0.85);

        // fade in الصورة
        this.tweens.add({ targets: img, alpha: 1, duration: 900, delay: 200 });

        // ─── زر HTML عشان النص العربي يطلع صح (RTL) ───
        const btn = document.createElement("button");
        btn.id = "splash-btn";
        btn.textContent = "الدخول إلى المنظمة السوداء";
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

        // أنشئ زر الـ mute فوراً (مستقل عن الموسيقى)
        audioManager.createMuteButton();

        // fade in الزر بعد الصورة
        this.time.delayedCall(900, () => { btn.style.opacity = "1"; });

        let entered = false;
        const enterLobby = () => {
            if (entered) return;
            entered = true;
            audioManager.play();

            // ─── أنشئ الفيديو وشغّله مباشرة ضمن user gesture ───
            document.getElementById("lobby-bg-video")?.remove();
            const vid = document.createElement("video");
            vid.id = "lobby-bg-video";
            vid.src = "/bg-desktop.mp4"; // نفس الفيديو للكل عشان يشتغل على الأندرويد
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
            // شغّل مباشرة — هنا ضمن user gesture chain بنجح على كل المتصفحات
            vid.play().catch(() => { });

            btn.style.opacity = "0";
            this.tweens.add({ targets: [bg, img], alpha: 0, duration: 450 });
            this.time.delayedCall(500, () => {
                this.cleanupAllLobbyHTML();
                this.initLobby();
            });
        };

        btn.addEventListener("click", enterLobby);

        // fallback: أي ضغطة على الشاشة تشغّل اللوبي
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

    // ══════════════════════════════════════════════════════
    //  DESKTOP LAYOUT
    // ══════════════════════════════════════════════════════
    private buildDesktopLayout(W: number, H: number) {
        const cy = H / 2;

        // ─── القسمة: 55% يسار (hero) | 45% يمين (form card) ───
        const heroW = Math.floor(W * 0.55);   // عرض منطقة الـ hero
        const formW = W - heroW;              // عرض منطقة الفورم
        const heroCx = heroW / 2;             // مركز الـ hero
        const formCx = heroW + formW / 2;     // مركز الفورم

        // ─── بطاقة الفورم (3D Glassmorphism) ───
        const cardPad = 40;
        const cardW = formW - cardPad * 2;
        const cardH = Math.min(H - 80, 460);
        const cardTop = cy - cardH / 2;

        const leftEdge = formCx - cardW / 2;

        // Shadow
        const shadow = this.add.graphics().setDepth(1);
        shadow.fillStyle(0x000000, 0.6);
        shadow.fillRoundedRect(leftEdge, cardTop + 15, cardW, cardH, 20);

        // Card Background (Gradient)
        const card = this.add.graphics().setDepth(2).setAlpha(0);
        card.fillGradientStyle(0x1a2235, 0x1a2235, 0x0a0f18, 0x0a0f18, 0.95);
        card.fillRoundedRect(leftEdge, cardTop, cardW, cardH, 20);

        // 3D Bevel/Border
        card.lineStyle(1.5, 0xffffff, 0.08); // Right / Bottom
        card.strokeRoundedRect(leftEdge, cardTop, cardW, cardH, 20);

        // Inner Glow Top
        card.lineStyle(1.5, 0x60a5fa, 0.3);
        card.beginPath();
        card.arc(leftEdge + 20, cardTop + 20, 20, Math.PI, Math.PI * 1.5);
        card.lineTo(leftEdge + cardW - 20, cardTop);
        card.arc(leftEdge + cardW - 20, cardTop + 20, 20, Math.PI * 1.5, Math.PI * 2);
        card.strokePath();

        // Accent top bar
        this.add.rectangle(formCx, cardTop, cardW - 40, 4, this.C.accent)
            .setOrigin(0.5, 0).setDepth(3);

        // خط رأسي فاصل بين القسمين
        const sepLine = this.add.graphics().setDepth(1);
        sepLine.lineStyle(1, this.C.cardBorder, 0.6);
        sepLine.moveTo(heroW, H * 0.1);
        sepLine.lineTo(heroW, H * 0.9);
        sepLine.strokePath();

        // ─── محتوى البطاقة ───
        const pad = 28;
        const fL = formCx - cardW / 2 + pad;   // حافة يسار
        let posY = cardTop + 30;

        // عنوان صغير داخل البطاقة
        // عنوان صغير أعلى البطاقة - HTML عشان RTL
        const cardTagEl = document.createElement("div");
        cardTagEl.id = "lobby-card-tag";
        cardTagEl.textContent = "المنظمة السوداء";
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
        posY += 56; // ارتفاع الـ input (44px) + gap (12px)

        // JOIN AS
        this.addFieldLabel(fL, posY, "JOIN  AS");
        posY += 18;
        this.createRoleButtons(formCx, posY + 32, cardW - pad * 2);
        posY += 90; // ارتفاع الأزرار (64px) + gap (26px)

        // JOIN BUTTON
        const btnY = cardTop + cardH - 72;
        this.createJoinButton(formCx, btnY, cardW - pad * 2);

        // Queue status
        this.queueStatusText = this.add.text(formCx, cardTop + cardH - 32,
            "●  0 / 6 in queue", {
            fontSize: "11px", color: "#3b4a5c",
            fontFamily: "'Courier New', monospace", letterSpacing: 1
        }).setOrigin(0.5).setDepth(3);

        // fade in
        card.setAlpha(0);
        this.tweens.add({ targets: card, alpha: 1, duration: 600, delay: 150 });

        // ─── Hero يسار ───
        this.buildDesktopHero(heroCx, cy, heroW);
    }

    private buildDesktopHero(cx: number, cy: number, heroW: number) {
        // ─── أيقونة ماسة ───
        const s = Math.min(heroW * 0.06, 24); // حجم متناسب مع العرض
        const icon = this.add.graphics().setDepth(2).setAlpha(0);
        icon.fillStyle(this.C.accent, 1);
        icon.fillTriangle(cx - s, cy - s * 3.2, cx + s, cy - s * 3.2, cx, cy - s * 1.5);
        icon.fillTriangle(cx - s, cy - s * 1.2, cx + s, cy - s * 1.2, cx, cy - s * 2.9);
        this.tweens.add({ targets: icon, alpha: 0.85, duration: 800, delay: 100 });

        // خط علوي زخرفي
        const lineW = Math.min(heroW * 0.3, 120);
        const g1 = this.add.graphics().setDepth(2);
        g1.lineStyle(1, this.C.accent, 0.4);
        g1.moveTo(cx - lineW / 2, cy - s * 4.2); g1.lineTo(cx + lineW / 2, cy - s * 4.2); g1.strokePath();

        // ─── العنوان الرئيسي (HTML عشان RTL يشتغل صح) ───
        const titleSize = Math.min(Math.floor(heroW * 0.055), 28);
        const titleEl = document.createElement("div");
        titleEl.id = "lobby-hero-title";
        titleEl.textContent = "المنظمة السوداء";
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
        // placeholder شفاف في Phaser للـ spacing
        const t1 = this.add.rectangle(cx, cy - 10, 10, titleSize * 2.4, 0x000000, 0).setDepth(2);

        // subtitle
        const t2 = this.add.text(cx, cy + titleSize + 22, "MULTIPLAYER  ·  SOCIAL DEDUCTION", {
            fontSize: "10px", color: "#3b82f6",
            fontFamily: "'Courier New', monospace", letterSpacing: 3
        }).setOrigin(0.5).setDepth(2).setAlpha(0);
        this.tweens.add({ targets: t2, alpha: 1, duration: 600, delay: 400 });

        // خط سفلي زخرفي
        const g2 = this.add.graphics().setDepth(2);
        g2.lineStyle(1, this.C.accent, 0.3);
        g2.moveTo(cx - lineW / 2, cy + titleSize + 50); g2.lineTo(cx + lineW / 2, cy + titleSize + 50); g2.strokePath();

        // جملة italics
        const t3 = this.add.text(cx, cy + titleSize + 68, "Deceive.  Deduce.  Survive.", {
            fontSize: "13px", color: "#2d3748",
            fontFamily: "'Georgia', serif", fontStyle: "italic"
        }).setOrigin(0.5).setDepth(2).setAlpha(0);
        this.tweens.add({ targets: t3, alpha: 1, duration: 600, delay: 550 });

        // ─── Features ───
        const baseY = cy + titleSize + 108;
        [
            { ico: "🔪", text: "Hidden Roles" },
            { ico: "🗳️", text: "Strategic Voting" },
            { ico: "🌙", text: "Night Elimination" },
        ].forEach((item, i) => {
            const f = this.add.text(cx, baseY + i * 32, `${item.ico}  ${item.text}`, {
                fontSize: "12px", color: "#1a2535",
                fontFamily: "'Courier New', monospace", letterSpacing: 1
            }).setOrigin(0.5).setDepth(2).setAlpha(0);
            this.tweens.add({ targets: f, alpha: 1, duration: 500, delay: 650 + i * 100 });
        });
    }

    // ══════════════════════════════════════════════════════
    //  MOBILE LAYOUT
    // ══════════════════════════════════════════════════════
    private buildMobileLayout(W: number, H: number) {
        const cx = W / 2;
        const pad = 16; // padding جانبي

        // ─── رأس ───
        const headerH = 108;

        // أيقونة ماسة صغيرة ذات ظل
        const iconContainer = this.add.container(cx, 0).setDepth(2);
        const iconShadow = this.add.graphics();
        iconShadow.fillStyle(0x000000, 0.5);
        iconShadow.fillTriangle(-10, 31, 10, 31, 0, 47);
        iconShadow.fillTriangle(-10, 53, 10, 53, 0, 37);

        const icon = this.add.graphics();
        icon.fillStyle(this.C.accent, 1);
        icon.fillTriangle(-10, 28, 10, 28, 0, 44);
        icon.fillTriangle(-10, 50, 10, 50, 0, 34);

        iconContainer.add([iconShadow, icon]);

        // العنوان العربي كـ HTML عشان RTL
        const mTitleEl = document.createElement("div");
        mTitleEl.id = "lobby-mobile-title";
        mTitleEl.textContent = "المنظمة السوداء";
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

        this.add.text(cx, 86, "MULTIPLAYER  ·  SOCIAL DEDUCTION", {
            fontSize: "8px", color: "#3b82f6",
            fontFamily: "'Courier New', monospace", letterSpacing: 2
        }).setOrigin(0.5).setDepth(2);

        // ─── البطاقة (3D Mobile) ───
        const cardW = W - pad * 2;
        const cardH = H - headerH - pad;
        const cardL = cx - cardW / 2;
        const cardT = headerH;

        // Shadow
        const shadow = this.add.graphics().setDepth(0);
        shadow.fillStyle(0x000000, 0.6);
        shadow.fillRoundedRect(cardL, cardT + 8, cardW, cardH, 20);

        // Background
        const card = this.add.graphics().setDepth(1);
        card.fillGradientStyle(0x1a2235, 0x1a2235, 0x0a0f18, 0x0a0f18, 0.92);
        card.fillRoundedRect(cardL, cardT, cardW, cardH, 20);

        // 3D Bevel/Border
        card.lineStyle(1.5, 0xffffff, 0.08);
        card.strokeRoundedRect(cardL, cardT, cardW, cardH, 20);

        card.lineStyle(1.5, 0x60a5fa, 0.3);
        card.beginPath();
        card.arc(cardL + 20, cardT + 20, 20, Math.PI, Math.PI * 1.5);
        card.lineTo(cardL + cardW - 20, cardT);
        card.arc(cardL + cardW - 20, cardT + 20, 20, Math.PI * 1.5, Math.PI * 2);
        card.strokePath();

        // شريط لوني أعلى
        this.add.rectangle(cx, cardT, cardW - 40, 4, this.C.accent)
            .setOrigin(0.5, 0).setDepth(2);

        // ─── محتوى البطاقة (positioning عمودي ثابت) ───
        const fL = cx - cardW / 2 + 18;
        let posY = cardT + 24;

        // USERNAME
        this.addFieldLabel(fL, posY, "USERNAME");
        posY += 17;
        this.createUsernameInput(fL, posY, cardW - 36);
        posY += 58; // input height 44px + gap 14px

        // JOIN AS
        this.addFieldLabel(fL, posY, "JOIN  AS");
        posY += 18;
        this.createRoleButtons(cx, posY + 32, cardW - 36);
        // أزرار الدور ارتفاعها 64px

        // JOIN BUTTON - من أسفل البطاقة
        const btnY = cardT + cardH - 68;
        const queueY = cardT + cardH - 30;

        this.createJoinButton(cx, btnY, cardW - 36);

        this.queueStatusText = this.add.text(cx, queueY,
            "●  0 / 6 in queue", {
            fontSize: "11px", color: "#3b4a5c",
            fontFamily: "'Courier New', monospace", letterSpacing: 1
        }).setOrigin(0.5).setDepth(3);
    }

    // ══════════════════════════════════════════════════════
    //  FIELD HELPERS
    // ══════════════════════════════════════════════════════
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
            width: `${width}px`, padding: "12px 14px", fontSize: "15px",
            fontFamily: "'Courier New', monospace", borderRadius: "10px",
            border: "1px solid rgba(255,255,255,0.05)",
            backgroundColor: "rgba(5, 7, 12, 0.7)", color: "#f1f5f9",
            outline: "none", zIndex: "1000", letterSpacing: "1px",
            boxShadow: "inset 0 3px 6px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.05)",
            transition: "all 0.2s",
            backdropFilter: "blur(6px)"
        });
        this.usernameInput.addEventListener("focus", () => {
            this.usernameInput.style.borderColor = "rgba(59,130,246,0.6)";
            this.usernameInput.style.backgroundColor = "rgba(10, 15, 25, 0.8)";
            this.usernameInput.style.boxShadow = "inset 0 3px 6px rgba(0,0,0,0.4), 0 0 10px rgba(59,130,246,0.3)";
        });
        this.usernameInput.addEventListener("blur", () => {
            this.usernameInput.style.borderColor = "rgba(255,255,255,0.05)";
            this.usernameInput.style.backgroundColor = "rgba(5, 7, 12, 0.7)";
            this.usernameInput.style.boxShadow = "inset 0 3px 6px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.05)";
        });
        this.usernameInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") this.handleJoin();
        });
        document.body.appendChild(this.usernameInput);
    }

    private createRoleButtons(cx: number, cy: number, totalW: number) {
        const roles = [
            { key: "player", label: "PLAYER", icon: "⚔", colHex: 0x22c55e, hex: "#22c55e" },
            { key: "spectator", label: "SPECTATOR", icon: "👁", colHex: 0x8b5cf6, hex: "#8b5cf6" },
            { key: "admin", label: "ADMIN", icon: "🔒", colHex: 0xf59e0b, hex: "#f59e0b" },
        ];
        const gap = 8;
        const btnW = (totalW - gap * 2) / 3;
        const btnH = 64;
        const sx = cx - totalW / 2 + btnW / 2;
        // نحفظ العرض عشان نستخدمه في unlockPlayerButton
        this.roleBtnW = btnW;
        this.roleBtnH = btnH;

        roles.forEach((role, i) => {
            const bx = sx + i * (btnW + gap);
            const isActive = role.key === this.selectedType;
            const isPlayerLocked = role.key === "player" && !this.sessionPasswordReady;

            const c = this.add.container(bx, cy).setDepth(3);
            if (isPlayerLocked) c.setAlpha(0.6);

            const shadow = this.add.graphics();
            shadow.fillStyle(0x000000, 0.4);
            shadow.fillRoundedRect(-btnW / 2, -btnH / 2 + 6, btnW, btnH, 12);

            const bgGfx = this.add.graphics();
            const drawBtnUI = (active: boolean) => {
                bgGfx.clear();
                if (active) {
                    bgGfx.fillGradientStyle(role.colHex, role.colHex, 0x0f172a, 0x0f172a, 0.9);
                    bgGfx.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 12);
                    bgGfx.lineStyle(1.5, 0xffffff, 0.4);
                    bgGfx.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 12);
                } else {
                    bgGfx.fillGradientStyle(0x1e293b, 0x1e293b, 0x0f172a, 0x0f172a, 0.8);
                    bgGfx.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 12);
                    bgGfx.lineStyle(1, 0x334155, 0.8);
                    bgGfx.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 12);
                    // Light top border
                    bgGfx.lineStyle(1.5, 0xffffff, 0.1);
                    bgGfx.beginPath();
                    bgGfx.arc(-btnW / 2 + 12, -btnH / 2 + 12, 12, Math.PI, Math.PI * 1.5);
                    bgGfx.lineTo(btnW / 2 - 12, -btnH / 2);
                    bgGfx.strokePath();
                }
            };
            drawBtnUI(isActive);

            const displayIcon = isPlayerLocked ? "🔒" : role.icon;
            const iconTxt = this.add.text(0, -10, displayIcon, { fontSize: "20px" }).setOrigin(0.5);
            iconTxt.setShadow(0, 2, "rgba(0,0,0,0.5)", 2, true, true);

            const lbl = this.add.text(0, 16, role.label, {
                fontSize: "10px", color: isActive ? "#ffffff" : "#64748b",
                fontFamily: "'Courier New', monospace", letterSpacing: 1, fontStyle: "bold"
            }).setOrigin(0.5);
            lbl.setShadow(0, 1, "rgba(0,0,0,0.6)", 1, true, true);

            c.add([shadow, bgGfx, iconTxt, lbl]);

            if (!isPlayerLocked) {
                c.setInteractive(new Phaser.Geom.Rectangle(-btnW / 2, -btnH / 2, btnW, btnH), Phaser.Geom.Rectangle.Contains);
            }

            c.setData("roleKey", role.key);
            c.setData("bg", bgGfx);
            c.setData("lbl", lbl);
            c.setData("shadow", shadow);
            c.setData("icon", iconTxt);
            c.setData("drawBtn", drawBtnUI);
            this.roleButtons[role.key] = c;

            c.on("pointerover", () => {
                if (this.selectedType !== role.key) {
                    lbl.setColor("#94a3b8");
                }
                this.tweens.add({ targets: c, y: cy - 2, duration: 100 });
            });
            c.on("pointerout", () => {
                if (this.selectedType !== role.key) {
                    lbl.setColor("#64748b");
                }
                this.tweens.add({ targets: c, y: cy, duration: 100 });
            });
            c.on("pointerdown", () => {
                if (role.key === "admin" && this.selectedType !== "admin") { this.showAdminPasswordPopup(); return; }
                if (role.key === "player") { this.time.delayedCall(150, () => this.showPlayerJoinPopup(roles)); return; }

                shadow.setAlpha(0);
                this.tweens.add({
                    targets: c, y: cy + 4, duration: 60, yoyo: true, onComplete: () => {
                        shadow.setAlpha(1);
                        this.activateRole(role.key, roles);
                    }
                });
            });
        });

        // ─── لو كلمة السر جاهزة قبل ما تتنشأ الأزرار — نفتح PLAYER فوراً ───
        if (this.sessionPasswordReady) {
            this.time.delayedCall(50, () => this.unlockPlayerButton());
        }
    }

    // ─── تفعيل زر PLAYER لما الأدمن يحط كلمة السر ───
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
        // ما نطلع toast لو الزر اتفتح تلقائياً عند الدخول
        if (!this.roleButtons["player"]?.getData("autoUnlocked")) {
            this.showToast("🔓 اللعبة فتحت — اختر PLAYER", "success");
        }
    }

    private activateRole(key: string, roles: Array<{ key: string; colHex: number; hex: string }>) {
        Object.values(this.roleButtons).forEach(rc => {
            const lbl = rc.getData("lbl") as Phaser.GameObjects.Text;
            const drawBtn = rc.getData("drawBtn");
            if (drawBtn) drawBtn(false);
            if (lbl) lbl.setColor("#64748b");
        });
        const rb = this.roleButtons[key];
        if (rb) {
            const lbl = rb.getData("lbl") as Phaser.GameObjects.Text;
            const drawBtn = rb.getData("drawBtn");
            if (drawBtn) drawBtn(true);
            if (lbl) lbl.setColor("#ffffff");
        }
        this.selectedType = key;
    }

    // ══════════════════════════════════════════════════════
    //  ADMIN RESET BUTTON (يطلع في الـ lobby بعد دخول الأدمن)
    // ══════════════════════════════════════════════════════
    private showAdminResetButton() {
        document.getElementById("admin-reset-btn")?.remove();

        const btn = document.createElement("button");
        btn.id = "admin-reset-btn";
        btn.textContent = "🗑 RESET SERVER";
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
            backgroundColor: "rgba(13,17,23,0.92)",
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
            btn.style.backgroundColor = "rgba(13,17,23,0.92)";
        });

        btn.addEventListener("click", () => {
            if (confirm("⚠️ هذا سيطرد كل اللاعبين ويمسح الجلسة كاملة. متأكد؟")) {
                socketService.socket.emit("admin_reset_server");
                btn.remove();
            }
        });

        document.body.appendChild(btn);
    }

    // ══════════════════════════════════════════════════════
    //  ADMIN PASSWORD POPUP
    // ══════════════════════════════════════════════════════
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
            background: "linear-gradient(145deg, #162032, #0a0f18)",
            borderTop: "1px solid rgba(245,158,11,0.5)",
            borderLeft: "1px solid rgba(245,158,11,0.2)",
            borderRight: "1px solid rgba(0,0,0,0.6)",
            borderBottom: "1px solid rgba(0,0,0,0.8)",
            borderRadius: "16px", padding: "30px 28px 24px",
            width: "300px", boxShadow: "0 25px 50px rgba(0,0,0,0.5), 0 0 40px rgba(245,158,11,0.1)",
        });

        const lockIcon = document.createElement("div");
        lockIcon.textContent = "🔒";
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
            width: "100%", padding: "12px 14px", boxSizing: "border-box",
            background: "rgba(5, 7, 12, 0.7)", color: "#f1f5f9",
            border: "1px solid rgba(255,255,255,0.05)", borderRadius: "8px",
            fontSize: "15px", fontFamily: "'Courier New', monospace",
            outline: "none", marginBottom: "12px",
            boxShadow: "inset 0 3px 6px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.05)",
            transition: "all 0.2s",
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
            flex: "1", padding: "12px", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "8px", background: "linear-gradient(180deg, #1e293b, #0f172a)", color: "#94a3b8",
            fontSize: "11px", letterSpacing: "2px", cursor: "pointer",
            fontFamily: "'Courier New', monospace",
            boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
        });

        const confirmBtn = document.createElement("button");
        confirmBtn.textContent = "CONFIRM";
        Object.assign(confirmBtn.style, {
            flex: "1", padding: "12px", border: "none",
            borderRadius: "8px", background: "linear-gradient(180deg, #f59e0b, #d97706)", color: "#000",
            fontSize: "11px", letterSpacing: "2px", cursor: "pointer",
            fontFamily: "'Courier New', monospace", fontWeight: "bold",
            boxShadow: "0 4px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.4)",
        });

        // 3D Press effect
        const addPressEffect = (btn: HTMLButtonElement) => {
            btn.addEventListener("mousedown", () => { btn.style.transform = "translateY(2px)"; btn.style.boxShadow = "none"; });
            btn.addEventListener("mouseup", () => { btn.style.transform = "translateY(0)"; btn.style.boxShadow = btn === confirmBtn ? "0 4px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.4)" : "0 4px 6px rgba(0,0,0,0.3)"; });
            btn.addEventListener("mouseleave", () => { btn.style.transform = "translateY(0)"; btn.style.boxShadow = btn === confirmBtn ? "0 4px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.4)" : "0 4px 6px rgba(0,0,0,0.3)"; });
        };
        addPressEffect(cancelBtn); addPressEffect(confirmBtn);

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
                // ─── أظهر زر RESET SERVER في الـ lobby ───
                this.showAdminResetButton();
                // ─── بعد دخول الأدمن، نطلب منه يحط كلمة مرور الجلسة ───
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

    // ══════════════════════════════════════════════════════
    //  SESSION PASSWORD POPUP (للأدمن — يحط كلمة مرور الجلسة)
    // ══════════════════════════════════════════════════════
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
            background: "linear-gradient(145deg, #162032, #0a0f18)",
            borderTop: "1px solid rgba(59,130,246,0.5)",
            borderLeft: "1px solid rgba(59,130,246,0.2)",
            borderRight: "1px solid rgba(0,0,0,0.6)",
            borderBottom: "1px solid rgba(0,0,0,0.8)",
            borderRadius: "16px", padding: "30px 28px 24px",
            width: "320px", boxShadow: "0 30px 60px rgba(0,0,0,0.6), 0 0 40px rgba(59,130,246,0.1)",
        });

        box.innerHTML = `
            <div style="font-size:30px;text-align:center;margin-bottom:10px;text-shadow:0 2px 4px rgba(0,0,0,0.5)">🔑</div>
            <div style="color:#3b82f6;font-size:12px;letter-spacing:3px;text-align:center;margin-bottom:4px;font-weight:bold;text-shadow:0 1px 2px rgba(0,0,0,0.8)">SESSION SETTINGS</div>
            <div style="color:#94a3b8;font-size:10px;text-align:center;margin-bottom:18px;letter-spacing:1px">Set password & player count for this session</div>

            <div style="color:#cbd5e1;font-size:9px;letter-spacing:2px;margin-bottom:6px;font-weight:bold">PASSWORD</div>
            <input id="session-pass-input" type="text" placeholder="e.g. mafia2024" style="width:100%;padding:12px 14px;box-sizing:border-box;background:rgba(5,7,12,0.7);color:#f1f5f9;border:1px solid rgba(255,255,255,0.05);border-radius:8px;font-size:15px;font-family:'Courier New',monospace;outline:none;margin-bottom:16px;box-shadow:inset 0 3px 6px rgba(0,0,0,0.4),0 1px 0 rgba(255,255,255,0.05);transition:all 0.2s"/>

            <div style="color:#cbd5e1;font-size:9px;letter-spacing:2px;margin-bottom:8px;font-weight:bold">NUMBER OF PLAYERS</div>
            <div id="count-btns" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
                ${[4, 5, 6, 7, 8, 9, 10].map(n => `
                    <button data-count="${n}" style="flex:1;min-width:36px;padding:10px 4px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:${n === 6 ? "linear-gradient(180deg, #3b82f6, #1e40af)" : "linear-gradient(180deg, #1e293b, #0f172a)"};color:${n === 6 ? "#fff" : "#94a3b8"};font-size:13px;font-family:'Courier New',monospace;cursor:pointer;box-shadow:${n === 6 ? "0 4px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3)" : "0 4px 6px rgba(0,0,0,0.3)"};transition:all 0.1s transform">${n}</button>
                `).join("")}
            </div>
            <div id="count-desc" style="color:#60a5fa;font-size:10px;text-align:center;margin-bottom:16px;letter-spacing:1px;background:rgba(0,0,0,0.2);padding:8px;border-radius:6px;border:1px solid rgba(255,255,255,0.05)">6 players — 1 Mafia, 1 Doctor, 1 Detective, 3 Citizens</div>

            <div id="session-err" style="color:#ef4444;font-size:10px;text-align:center;min-height:16px;margin-bottom:8px;text-shadow:0 1px 2px rgba(0,0,0,0.8)"></div>
            <div style="display:flex;gap:10px">
                <button id="session-skip-btn" style="flex:1;padding:12px;border:1px solid rgba(255,255,255,0.1);border-radius:8px;background:linear-gradient(180deg, #1e293b, #0f172a);color:#cbd5e1;font-size:11px;letter-spacing:2px;cursor:pointer;font-family:'Courier New',monospace;box-shadow:0 4px 6px rgba(0,0,0,0.3)">NO PASSWORD</button>
                <button id="session-set-btn" style="flex:1;padding:12px;border:none;border-radius:8px;background:linear-gradient(180deg, #3b82f6, #1d4ed8);color:#fff;font-size:11px;letter-spacing:2px;cursor:pointer;font-family:'Courier New',monospace;font-weight:bold;box-shadow:0 4px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3)">CONFIRM</button>
            </div>
        `;

        overlay.appendChild(box);
        document.body.appendChild(overlay);

        const input = box.querySelector<HTMLInputElement>("#session-pass-input")!;
        const errEl = box.querySelector<HTMLElement>("#session-err")!;
        const setBtn = box.querySelector<HTMLButtonElement>("#session-set-btn")!;
        const skipBtn = box.querySelector<HTMLButtonElement>("#session-skip-btn")!;

        setTimeout(() => input.focus(), 60);

        // ─── منطق أزرار العدد ───
        let selectedCount = 6;
        const roleDesc: Record<number, string> = {
            4: "4 players — 1 Mafia, 1 Doctor, 2 Citizens",
            5: "5 players — 1 Mafia, 1 Doctor, 1 Detective, 2 Citizens",
            6: "6 players — 1 Mafia, 1 Doctor, 1 Detective, 3 Citizens",
            7: "7 players — 2 Mafia, 1 Doctor, 1 Detective, 3 Citizens",
            8: "8 players — 2 Mafia, 1 Doctor, 1 Detective, 4 Citizens",
            9: "9 players — 2 Mafia, 1 Doctor, 1 Detective, 5 Citizens",
            10: "10 players — 3 Mafia, 1 Doctor, 1 Detective, 5 Citizens",
        };
        const descEl = box.querySelector<HTMLElement>("#count-desc")!;
        const countBtns = box.querySelectorAll<HTMLButtonElement>("#count-btns button");
        countBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                selectedCount = parseInt(btn.dataset.count!);
                countBtns.forEach(b => {
                    b.style.background = b === btn ? "linear-gradient(180deg, #3b82f6, #1e40af)" : "linear-gradient(180deg, #1e293b, #0f172a)";
                    b.style.color = b === btn ? "#fff" : "#94a3b8";
                    b.style.borderColor = "rgba(255,255,255,0.1)";
                    b.style.boxShadow = b === btn ? "0 4px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3)" : "0 4px 6px rgba(0,0,0,0.3)";
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
                this.showToast(`✓ Password: ${password} | ${countMsg}`, "success");
            } else {
                this.showToast(`✓ No password | ${countMsg}`, "info");
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

    // ══════════════════════════════════════════════════════
    //  JOIN BUTTON
    // ══════════════════════════════════════════════════════
    private createJoinButton(cx: number, cy: number, width: number) {
        const btnH = 50;
        const c = this.add.container(cx, cy).setDepth(3);

        const shadow = this.add.graphics();
        shadow.fillStyle(0x000000, 0.4);
        shadow.fillRoundedRect(-width / 2, -btnH / 2 + 6, width, btnH, 12);

        const bgGfx = this.add.graphics();
        const drawBg = (colorTop: number, colorBot: number) => {
            bgGfx.clear();
            bgGfx.fillGradientStyle(colorTop, colorTop, colorBot, colorBot, 1);
            bgGfx.fillRoundedRect(-width / 2, -btnH / 2, width, btnH, 12);
            // top bevel light
            bgGfx.lineStyle(2, 0xffffff, 0.25);
            bgGfx.beginPath();
            bgGfx.arc(-width / 2 + 12, -btnH / 2 + 12, 12, Math.PI, Math.PI * 1.5);
            bgGfx.lineTo(width / 2 - 12, -btnH / 2);
            bgGfx.arc(width / 2 - 12, -btnH / 2 + 12, 12, Math.PI * 1.5, Math.PI * 2);
            bgGfx.strokePath();
        };
        drawBg(0x3b82f6, 0x1e40af); // initial Blue gradient

        const lbl = this.add.text(0, 0, "JOIN  QUEUE", {
            fontSize: "13px", color: "#ffffff",
            fontFamily: "'Courier New', monospace", letterSpacing: 4, fontStyle: "bold"
        }).setOrigin(0.5);
        lbl.setShadow(0, 2, "rgba(0,0,0,0.4)", 2, true, true);

        c.add([shadow, bgGfx, lbl]);
        c.setInteractive(new Phaser.Geom.Rectangle(-width / 2, -btnH / 2, width, btnH), Phaser.Geom.Rectangle.Contains);

        c.on("pointerover", () => {
            drawBg(0x60a5fa, 0x2563eb); // hovered lighter blue
            this.tweens.add({ targets: c, y: cy - 2, duration: 100 });
        });
        c.on("pointerout", () => {
            drawBg(0x3b82f6, 0x1e40af); // reset
            this.tweens.add({ targets: c, y: cy, duration: 100 });
        });
        c.on("pointerdown", () => {
            shadow.setAlpha(0); // hide shadow to simulate pressing down
            this.tweens.add({
                targets: c, y: cy + 4, duration: 60, yoyo: true, onComplete: () => {
                    shadow.setAlpha(1);
                    this.handleJoin();
                }
            });
        });
        this.joinButton = c;
        this.joinBtnLabel = lbl;
    }

    // ══════════════════════════════════════════════════════
    //  PLAYER PASSWORD PROMPT
    // ══════════════════════════════════════════════════════
    // ══════════════════════════════════════════════════════
    //  PLAYER JOIN POPUP — كلمة سر أو كود رجوع
    // ══════════════════════════════════════════════════════
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
            background: "linear-gradient(145deg, #162032, #0a0f18)",
            borderTop: "1px solid rgba(34,197,94,0.5)",
            borderLeft: "1px solid rgba(34,197,94,0.2)",
            borderRight: "1px solid rgba(0,0,0,0.6)",
            borderBottom: "1px solid rgba(0,0,0,0.8)",
            borderRadius: "16px", padding: "30px 28px 24px",
            width: "320px", boxShadow: "0 30px 60px rgba(0,0,0,0.6), 0 0 40px rgba(34,197,94,0.1)",
        });

        box.innerHTML = `
            <div style="font-size:32px;text-align:center;margin-bottom:10px;text-shadow:0 2px 4px rgba(0,0,0,0.5)">⚔</div>
            <div style="color:#22c55e;font-size:12px;letter-spacing:3px;text-align:center;margin-bottom:16px;font-weight:bold;text-shadow:0 1px 2px rgba(0,0,0,0.8)">JOIN AS PLAYER</div>

            <div id="pjp-tabs" style="display:flex;gap:8px;margin-bottom:16px">
                <button id="pjp-tab-password" style="flex:1;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:linear-gradient(180deg, #22c55e, #166534);color:#fff;font-size:11px;letter-spacing:1px;cursor:pointer;font-family:'Courier New',monospace;font-weight:bold;box-shadow:0 4px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3);transition:all 0.1s transform">كلمة السر</button>
                <button id="pjp-tab-code" style="flex:1;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.05);background:linear-gradient(180deg, #1e293b, #0f172a);color:#94a3b8;font-size:11px;letter-spacing:1px;cursor:pointer;font-family:'Courier New',monospace;box-shadow:0 4px 6px rgba(0,0,0,0.3);transition:all 0.1s transform">كود الرجوع</button>
            </div>

            <div id="pjp-panel-password">
                <input id="pjp-password-input" type="password" placeholder="Session password..."
                    style="width:100%;padding:12px 14px;box-sizing:border-box;background:rgba(5,7,12,0.7);color:#f1f5f9;border:1px solid rgba(255,255,255,0.05);border-radius:8px;font-size:15px;font-family:'Courier New',monospace;outline:none;margin-bottom:12px;box-shadow:inset 0 3px 6px rgba(0,0,0,0.4),0 1px 0 rgba(255,255,255,0.05);transition:all 0.2s"/>
            </div>

            <div id="pjp-panel-code" style="display:none">
                <div style="color:#94a3b8;font-size:10px;letter-spacing:1px;margin-bottom:12px;direction:rtl;text-align:right;line-height:1.6">أدخل اسمك كما كان في اللعبة والكود من الأدمن</div>
                <input id="pjp-rejoin-name" type="text" placeholder="Your username..."
                    style="width:100%;padding:12px 14px;box-sizing:border-box;background:rgba(5,7,12,0.7);color:#f1f5f9;border:1px solid rgba(255,255,255,0.05);border-radius:8px;font-size:15px;font-family:'Courier New',monospace;outline:none;margin-bottom:12px;box-shadow:inset 0 3px 6px rgba(0,0,0,0.4),0 1px 0 rgba(255,255,255,0.05);transition:all 0.2s"/>
                <input id="pjp-code-input" type="text" placeholder="123456"
                    style="width:100%;padding:12px 14px;box-sizing:border-box;background:rgba(5,7,12,0.7);color:#22c55e;border:1px solid rgba(255,255,255,0.05);border-radius:8px;font-size:24px;font-family:'Courier New',monospace;outline:none;margin-bottom:12px;letter-spacing:10px;text-align:center;box-shadow:inset 0 3px 6px rgba(0,0,0,0.4),0 1px 0 rgba(255,255,255,0.05);transition:all 0.2s"/>
            </div>

            <div id="pjp-err" style="color:#ef4444;font-size:11px;text-align:center;min-height:16px;margin-bottom:12px;text-shadow:0 1px 2px rgba(0,0,0,0.8)"></div>
            <div style="display:flex;gap:10px">
                <button id="pjp-cancel" style="flex:1;padding:12px;border:1px solid rgba(255,255,255,0.1);border-radius:8px;background:linear-gradient(180deg, #1e293b, #0f172a);color:#94a3b8;font-size:11px;letter-spacing:2px;cursor:pointer;font-family:'Courier New',monospace;box-shadow:0 4px 6px rgba(0,0,0,0.3)">CANCEL</button>
                <button id="pjp-confirm" style="flex:1;padding:12px;border:none;border-radius:8px;background:linear-gradient(180deg, #22c55e, #15803d);color:#fff;font-size:11px;letter-spacing:2px;cursor:pointer;font-family:'Courier New',monospace;font-weight:bold;box-shadow:0 4px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3)">CONFIRM</button>
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
                tabPassword.style.background = "linear-gradient(180deg, #22c55e, #166534)";
                tabPassword.style.color = "#fff";
                tabPassword.style.boxShadow = "0 4px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3)";
                tabCode.style.background = "linear-gradient(180deg, #1e293b, #0f172a)";
                tabCode.style.color = "#94a3b8";
                tabCode.style.boxShadow = "0 4px 6px rgba(0,0,0,0.3)";
                setTimeout(() => passwordInput.focus(), 50);
            } else {
                passwordPanel.style.display = "none";
                codePanel.style.display = "block";
                tabCode.style.background = "linear-gradient(180deg, #22c55e, #166534)";
                tabCode.style.color = "#fff";
                tabCode.style.boxShadow = "0 4px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3)";
                tabPassword.style.background = "linear-gradient(180deg, #1e293b, #0f172a)";
                tabPassword.style.color = "#94a3b8";
                tabPassword.style.boxShadow = "0 4px 6px rgba(0,0,0,0.3)";
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
                // ─── كلمة السر العادية ───
                const val = passwordInput.value.trim();
                if (!val) { errEl.textContent = "الرجاء إدخال كلمة السر"; confirmBtn.style.opacity = "1"; confirmBtn.style.pointerEvents = "auto"; return; }
                socketService.socket.emit("verify_session_password", { password: val });

                const onOk = () => { socketService.socket.off("password_verify_fail", onFail); overlay.remove(); (this as any)._pendingPlayerPassword = val; this.activateRole("player", roles); this.showToast("✓ كلمة السر صح — اضغط JOIN", "success"); };
                const onFail = () => { socketService.socket.off("password_verify_ok", onOk); confirmBtn.style.opacity = "1"; confirmBtn.style.pointerEvents = "auto"; errEl.textContent = "❌ كلمة السر غلط"; passwordInput.value = ""; passwordInput.style.borderColor = "#ef4444"; setTimeout(() => { let n = 0; const iv = setInterval(() => { box.style.marginLeft = n % 2 === 0 ? "7px" : "-7px"; n++; if (n >= 6) { clearInterval(iv); box.style.marginLeft = "0"; } }, 55); }, 0); };
                socketService.socket.once("password_verify_ok", onOk);
                socketService.socket.once("password_verify_fail", onFail);

            } else {
                // ─── كود الرجوع — اسم + كود ───
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
            fontFamily: "'Courier New', monospace",
        });

        const box = document.createElement("div");
        Object.assign(box.style, {
            background: "linear-gradient(145deg, #162032, #0a0f18)",
            borderTop: "1px solid rgba(34,197,94,0.5)",
            borderLeft: "1px solid rgba(34,197,94,0.2)",
            borderRight: "1px solid rgba(0,0,0,0.6)",
            borderBottom: "1px solid rgba(0,0,0,0.8)",
            borderRadius: "16px", padding: "30px 28px 24px",
            width: "320px", boxShadow: "0 30px 60px rgba(0,0,0,0.6), 0 0 40px rgba(34,197,94,0.1)",
        });

        box.innerHTML = `
            <div style="font-size:32px;text-align:center;margin-bottom:10px;text-shadow:0 2px 4px rgba(0,0,0,0.5)">🎮</div>
            <div style="color:#22c55e;font-size:12px;letter-spacing:3px;text-align:center;margin-bottom:4px;font-weight:bold;text-shadow:0 1px 2px rgba(0,0,0,0.8)">SESSION PASSWORD</div>
            <div style="color:#94a3b8;font-size:10px;text-align:center;margin-bottom:18px;letter-spacing:1px">Enter the password provided by the admin</div>
            <input id="player-pass-input" type="password" placeholder="Session password..." style="width:100%;padding:12px 14px;box-sizing:border-box;background:rgba(5,7,12,0.7);color:#f1f5f9;border:1px solid rgba(255,255,255,0.05);border-radius:8px;font-size:15px;font-family:'Courier New',monospace;outline:none;margin-bottom:12px;box-shadow:inset 0 3px 6px rgba(0,0,0,0.4),0 1px 0 rgba(255,255,255,0.05);transition:all 0.2s"/>
            <div id="player-pass-err" style="color:#ef4444;font-size:11px;text-align:center;min-height:16px;margin-bottom:12px;text-shadow:0 1px 2px rgba(0,0,0,0.8)"></div>
            <div style="display:flex;gap:10px">
                <button id="player-pass-cancel" style="flex:1;padding:12px;border:1px solid rgba(255,255,255,0.1);border-radius:8px;background:linear-gradient(180deg, #1e293b, #0f172a);color:#94a3b8;font-size:11px;letter-spacing:2px;cursor:pointer;font-family:'Courier New',monospace;box-shadow:0 4px 6px rgba(0,0,0,0.3)">CANCEL</button>
                <button id="player-pass-confirm" style="flex:1;padding:12px;border:none;border-radius:8px;background:linear-gradient(180deg, #22c55e, #15803d);color:#fff;font-size:11px;letter-spacing:2px;cursor:pointer;font-family:'Courier New',monospace;font-weight:bold;box-shadow:0 4px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3)">CONFIRM</button>
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
            if (!val) { errEl.textContent = "الرجاء إدخال كلمة السر"; return; }

            // ─── نبعث للسيرفر يتحقق ───
            confirmBtn.style.opacity = "0.5";
            confirmBtn.style.pointerEvents = "none";
            errEl.textContent = "";

            socketService.socket.emit("verify_session_password", { password: val });

            // نستنى رد السيرفر
            const onOk = () => {
                socketService.socket.off("password_verify_ok", onOk);
                socketService.socket.off("password_verify_fail", onFail);
                overlay.remove();
                onConfirm(val);
            };
            const onFail = () => {
                socketService.socket.off("password_verify_ok", onOk);
                socketService.socket.off("password_verify_fail", onFail);
                // رجّع الزر وأظهر الخطأ
                confirmBtn.style.opacity = "1";
                confirmBtn.style.pointerEvents = "auto";
                errEl.textContent = "❌ كلمة السر غلط";
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

    // ══════════════════════════════════════════════════════
    //  HANDLE JOIN
    // ══════════════════════════════════════════════════════
    private handleJoin() {
        const username = this.usernameInput?.value.trim();
        if (!username || username.length < 2) {
            this.showToast("Username must be at least 2 characters", "error");
            this.shakeInput();
            return;
        }
        socketService.reset();
        socketService.saveUsername(username); // ─── نحفظ الاسم ───
        socketService.socket.emit("set_username", username);
        socketService.socket.emit("set_avatar", "😎");
        socketService.socket.emit("set_color", "#1e293b");

        if (this.selectedType === "admin") {
            socketService.isAdmin = true;
            socketService.socket.emit("join_admin");
            this.joinBtnLabel.setText("CONNECTING...");
            this.showToast("Joining as admin...", "info");
        } else if (this.selectedType === "spectator") {
            socketService.socket.emit("spectator_join_game");
            this.joinBtnLabel.setText("SEARCHING...");
            this.showToast("Looking for active game...", "info");
        } else {
            // ─── اللاعب — يستخدم كلمة السر المحفوظة من الـ popup ───
            const password = (this as any)._pendingPlayerPassword || "";
            if (!password) {
                this.showToast("اختر PLAYER وحط كلمة السر أولاً", "error");
                return;
            }
            socketService.socket.emit("join_queue", { type: "player", password });
            this.joinBtnLabel.setText("JOINING...");
            this.showToast("Joining queue...", "success");
        }

        this.joinButton.setAlpha(0.6);
        this.joinButton.disableInteractive();
        this.time.delayedCall(2500, () => {
            if (this.joinButton?.active) {
                this.joinButton.setAlpha(1);
                this.joinBtnLabel.setText("JOIN  QUEUE");
                this.joinButton.setInteractive(
                    new Phaser.Geom.Rectangle(-172, -24, 344, 48),
                    Phaser.Geom.Rectangle.Contains
                );
            }
        });
    }

    // ══════════════════════════════════════════════════════
    //  SOCKET EVENTS
    // ══════════════════════════════════════════════════════
    private setupSocketEvents() {
        ["game_started", "queue_update", "error", "connect", "connect_error", "waiting_for_players", "admin_joined"]
            .forEach(ev => socketService.socket.off(ev));

        socketService.socket.on("queue_update", (data: any) => {
            if (!this.queueStatusText?.active) return;
            const size = data.queueSize || 0;
            const required = data.required || (this as any)._requiredPlayers || 6;
            const color = size >= required - 1 ? "#22c55e" : size >= Math.floor(required / 2) ? "#f59e0b" : "#3b4a5c";
            this.queueStatusText.setText(`●  ${size} / ${required} in queue`).setColor(color);
        });

        socketService.socket.on("error", (data: any) => {
            this.showToast(data.message, "error");
            if (this.joinButton?.active) {
                this.joinBtnLabel?.setText("JOIN  QUEUE");
                this.joinButton.setAlpha(1);
                this.joinButton.setInteractive(
                    new Phaser.Geom.Rectangle(-172, -24, 344, 48),
                    Phaser.Geom.Rectangle.Contains
                );
            }
            // لو كانت المشكلة كلمة سر غلط — نرجع الـ popup
            if (data.message && data.message.includes("كلمة السر")) {
                this.time.delayedCall(300, () => {
                    this.showPlayerPasswordPrompt((password) => {
                        socketService.socket.emit("join_queue", { type: "player", password });
                        this.joinBtnLabel?.setText("JOINING...");
                        this.joinButton.setAlpha(0.6);
                        this.joinButton.disableInteractive();
                    });
                });
            }
        });

        socketService.socket.on("admin_joined", () => this.showToast("Admin panel ready \u2713", "success"));

        socketService.socket.on("waiting_for_players", (data: any) => {
            this.showToast(data.message || "Waiting for players...", "info");
            if (this.queueStatusText?.active)
                this.queueStatusText.setText("●  Waiting for players...").setColor("#f59e0b");
            if (this.joinButton?.active) {
                this.joinBtnLabel?.setText("JOIN  QUEUE");
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

            // ─── امسح الفيديو وأرجع كل شي لحالته قبل الانتقال ───
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

        socketService.socket.on("connect", () => this.showToast("Connected \u2713", "success"));
        socketService.socket.on("connect_error", () => this.showToast("Cannot connect to server", "error"));
    }

    // ══════════════════════════════════════════════════════
    //  BACKGROUND
    // ══════════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════════════════════════════
    //  VIDEO BACKGROUND
    // ═══════════════════════════════════════════════════════════════════════════
    private startBgVideo() {
        // الفيديو موجود ومشغّل من showSplashScreen + enterLobby
        // هنا فقط نخلي الـ canvas شفاف عشان يبيّن الفيديو من تحته

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

    // ══════════════════════════════════════════════════════
    //  UTILITIES
    // ══════════════════════════════════════════════════════
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

    // ══════════════════════════════════════════════════════
    //  UPDATE
    // ══════════════════════════════════════════════════════
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

    // ══════════════════════════════════════════════════════
    //  SHUTDOWN
    // ══════════════════════════════════════════════════════
    // ─── مسح كل HTML elements دفعة واحدة ───
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
        // ملاحظة: lobby-bg-video و global-audio-ctrl لا يُمسحان - يضلان ظاهرين
    }

    shutdown() {
        if (this.playerCountInterval) clearInterval(this.playerCountInterval);
        this.cleanupAllLobbyHTML();

        // ─── مسح الفيديو وإرجاع كل شي لحالته الطبيعية ───
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