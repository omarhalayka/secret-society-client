import Phaser from "phaser";
import { socketService } from "../../socket";
import { audioManager } from "../../AudioManager";

// ─── كلمة سر الأدمن ─────────────────────────────────────────
// غيّرها لأي كلمة تبغاها
const ADMIN_PASSWORD = "123123321123";

export default class LobbyScene extends Phaser.Scene {

    private usernameInput!: HTMLInputElement;
    private selectedType: string = "player";
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
        bg:          0x060810,
        card:        0x0d1117,
        cardBorder:  0x21262d,
        accent:      0x3b82f6,
        accentHover: 0x60a5fa,
        player:      0x22c55e,
        spectator:   0x8b5cf6,
        admin:       0xf59e0b,
    };

    constructor() { super("LobbyScene"); }

    // ══════════════════════════════════════════════════════
    //  CREATE
    // ══════════════════════════════════════════════════════
    create() {
        this.showSplashScreen();
    }

    private showSplashScreen() {
        const W = this.scale.width;
        const H = this.scale.height;

        this.cameras.main.setBackgroundColor("#060810");

        // خلفية سوداء
        const bg = this.add.rectangle(W/2, H/2, W, H, 0x000000).setDepth(0);

        // صورة الـ splash
        const img = this.add.image(W/2, H/2, "welcome")
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
            position:    "fixed",
            bottom:      "60px",
            left:        "50%",
            transform:   "translateX(-50%)",
            zIndex:      "2000",
            padding:     "14px 36px",
            fontSize:    "20px",
            fontFamily:  "'Georgia', serif",
            fontWeight:  "bold",
            color:       "#ffffff",
            background:  "#3b82f6",
            border:      "none",
            borderRadius:"8px",
            cursor:      "pointer",
            direction:   "rtl",
            letterSpacing: "1px",
            opacity:     "0",
            transition:  "opacity 0.6s ease, transform 0.15s ease, background 0.2s ease",
            boxShadow:   "0 4px 20px rgba(59,130,246,0.4)",
        });
        btn.addEventListener("mouseover", () => {
            btn.style.background = "#60a5fa";
        });
        btn.addEventListener("mouseout", () => {
            btn.style.background = "#3b82f6";
        });
        btn.addEventListener("mousedown", () => {
            btn.style.transform = "translateX(-50%) scale(0.96)";
        });
        document.body.appendChild(btn);

        // أنشئ زر الـ mute فوراً (مستقل عن الموسيقى)
        audioManager.createMuteButton();

        // fade in الزر بعد الصورة
        this.time.delayedCall(900, () => {
            btn.style.opacity = "1";
        });

        let entered = false;
        const enterLobby = () => {
            if (entered) return;
            entered = true;
            // شغّل الموسيقى عند أول ضغطة (browser policy)
            audioManager.play();
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
            document.removeEventListener("touchstart",  onFirstClick);
            enterLobby();
        };
        // نضيفهم بعد ثانية عشان ما يتشتغلوا بدون قصد
        this.time.delayedCall(1000, () => {
            document.addEventListener("pointerdown", onFirstClick, { once: true });
            document.addEventListener("touchstart",  onFirstClick, { once: true, passive: true });
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

        // ─── بطاقة الفورم ───
        const cardPad = 40;
        const cardW   = formW - cardPad * 2;
        const cardH   = Math.min(H - 80, 460);
        const cardTop = cy - cardH / 2;

        // بطاقة شفافة - backdrop blur بدل اللون الصلب
        this.add.rectangle(formCx, cy, cardW + 6, cardH + 6, 0x3b82f6, 0.08).setDepth(1);
        const card = this.add.rectangle(formCx, cy, cardW, cardH, 0x060810, 0.35).setDepth(2);
        card.setStrokeStyle(1, this.C.cardBorder);

        // شريط لوني أعلى البطاقة
        this.add.rectangle(formCx, cardTop + 2, cardW - 2, 3, this.C.accent)
            .setOrigin(0.5, 0).setDepth(3);

        // خط رأسي فاصل بين القسمين
        const sepLine = this.add.graphics().setDepth(1);
        sepLine.lineStyle(1, this.C.cardBorder, 0.6);
        sepLine.moveTo(heroW, H * 0.1);
        sepLine.lineTo(heroW, H * 0.9);
        sepLine.strokePath();

        // ─── محتوى البطاقة ───
        const pad  = 28;
        const fL   = formCx - cardW / 2 + pad;   // حافة يسار
        let   posY = cardTop + 30;

        // عنوان صغير داخل البطاقة
        // عنوان صغير أعلى البطاقة - HTML عشان RTL
        const cardTagEl = document.createElement("div");
        cardTagEl.id = "lobby-card-tag";
        cardTagEl.textContent = "المنظمة السوداء";
        Object.assign(cardTagEl.style, {
            position:      "fixed",
            top:           `${posY}px`,
            left:          `${fL}px`,
            direction:     "rtl",
            fontSize:      "10px",
            color:         "#3b82f6",
            fontFamily:    "'Courier New', monospace",
            letterSpacing: "2px",
            pointerEvents: "none",
            zIndex:        "10",
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
        icon.fillTriangle(cx - s, cy - s*3.2, cx + s, cy - s*3.2, cx, cy - s*1.5);
        icon.fillTriangle(cx - s, cy - s*1.2, cx + s, cy - s*1.2, cx, cy - s*2.9);
        this.tweens.add({ targets: icon, alpha: 0.85, duration: 800, delay: 100 });

        // خط علوي زخرفي
        const lineW = Math.min(heroW * 0.3, 120);
        const g1 = this.add.graphics().setDepth(2);
        g1.lineStyle(1, this.C.accent, 0.22);
        g1.moveTo(cx - lineW/2, cy - s*4.2); g1.lineTo(cx + lineW/2, cy - s*4.2); g1.strokePath();

        // ─── العنوان الرئيسي (HTML عشان RTL يشتغل صح) ───
        const titleSize = Math.min(Math.floor(heroW * 0.055), 28);
        const titleEl = document.createElement("div");
        titleEl.id = "lobby-hero-title";
        titleEl.textContent = "المنظمة السوداء";
        Object.assign(titleEl.style, {
            position:   "fixed",
            top:        `${cy - 10 - titleSize}px`,
            left:       `${cx - heroW * 0.4}px`,
            width:      `${heroW * 0.8}px`,
            textAlign:  "center",
            direction:  "rtl",
            fontSize:   `${titleSize}px`,
            fontFamily: "'Georgia', serif",
            fontWeight: "bold",
            color:      "#f1f5f9",
            lineHeight: "1.2",
            pointerEvents: "none",
            zIndex:     "10",
            opacity:    "0",
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
        g2.lineStyle(1, this.C.accent, 0.12);
        g2.moveTo(cx - lineW/2, cy + titleSize + 50); g2.lineTo(cx + lineW/2, cy + titleSize + 50); g2.strokePath();

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
        const cx  = W / 2;
        const pad = 16; // padding جانبي

        // ─── رأس ───
        const headerH = 108;

        // أيقونة ماسة صغيرة
        const icon = this.add.graphics().setDepth(2);
        icon.fillStyle(this.C.accent, 0.9);
        icon.fillTriangle(cx - 10, 28, cx + 10, 28, cx, 44);
        icon.fillTriangle(cx - 10, 50, cx + 10, 50, cx, 34);

        // العنوان العربي كـ HTML عشان RTL
        const mTitleEl = document.createElement("div");
        mTitleEl.id = "lobby-mobile-title";
        mTitleEl.textContent = "المنظمة السوداء";
        Object.assign(mTitleEl.style, {
            position:   "fixed",
            top:        "46px",
            left:       "0",
            right:      "0",
            textAlign:  "center",
            direction:  "rtl",
            fontSize:   "20px",
            fontFamily: "'Georgia', serif",
            fontWeight: "bold",
            color:      "#f1f5f9",
            letterSpacing: "2px",
            pointerEvents: "none",
            zIndex:     "10",
        });
        document.body.appendChild(mTitleEl);

        this.add.text(cx, 86, "MULTIPLAYER  ·  SOCIAL DEDUCTION", {
            fontSize: "8px", color: "#3b82f6",
            fontFamily: "'Courier New', monospace", letterSpacing: 2
        }).setOrigin(0.5).setDepth(2);

        // ─── البطاقة ───
        const cardW  = W - pad * 2;
        const cardH  = H - headerH - pad;
        const cardCX = cx;
        const cardCY = headerH + cardH / 2;
        const cardT  = headerH; // أعلى البطاقة

        // بطاقة شفافة مع HTML blur overlay
        const card = this.add.rectangle(cardCX, cardCY, cardW, cardH, 0x060810, 0.35).setDepth(1);
        card.setStrokeStyle(1, this.C.cardBorder);

        // شريط لوني أعلى
        this.add.rectangle(cardCX, cardT + 2, cardW - 2, 3, this.C.accent)
            .setOrigin(0.5, 0).setDepth(2);

        // ─── محتوى البطاقة (positioning عمودي ثابت) ───
        const fL   = cardCX - cardW / 2 + 18;
        let   posY = cardT + 24;

        // USERNAME
        this.addFieldLabel(fL, posY, "USERNAME");
        posY += 17;
        this.createUsernameInput(fL, posY, cardW - 36);
        posY += 58; // input height 44px + gap 14px

        // JOIN AS
        this.addFieldLabel(fL, posY, "JOIN  AS");
        posY += 18;
        this.createRoleButtons(cardCX, posY + 32, cardW - 36);
        // أزرار الدور ارتفاعها 64px

        // JOIN BUTTON - من أسفل البطاقة
        const btnY   = cardT + cardH - 68;
        const queueY = cardT + cardH - 30;

        this.createJoinButton(cardCX, btnY, cardW - 36);

        this.queueStatusText = this.add.text(cardCX, queueY,
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
            { key: "player",    label: "PLAYER",    icon: "⚔",  colHex: 0x22c55e, hex: "#22c55e" },
            { key: "spectator", label: "SPECTATOR", icon: "👁",  colHex: 0x8b5cf6, hex: "#8b5cf6" },
            { key: "admin",     label: "ADMIN",     icon: "🔒",  colHex: 0xf59e0b, hex: "#f59e0b" },
        ];
        const gap  = 8;
        const btnW = (totalW - gap * 2) / 3;
        const btnH = 64;
        const sx   = cx - totalW / 2 + btnW / 2;

        roles.forEach((role, i) => {
            const bx = sx + i * (btnW + gap);
            const isActive = role.key === this.selectedType;
            const c = this.add.container(bx, cy).setDepth(3);

            const bg = this.add.rectangle(0, 0, btnW, btnH,
                isActive ? 0x0d1f3c : this.C.card);
            bg.setStrokeStyle(isActive ? 2 : 1,
                isActive ? role.colHex : this.C.cardBorder);

            const iconTxt = this.add.text(0, -12, role.icon, { fontSize: "20px" }).setOrigin(0.5);
            const lbl     = this.add.text(0, 14, role.label, {
                fontSize: "9px", color: isActive ? role.hex : "#4a5568",
                fontFamily: "'Courier New', monospace", letterSpacing: 1, fontStyle: "bold"
            }).setOrigin(0.5);

            c.add([bg, iconTxt, lbl]);
            c.setInteractive(
                new Phaser.Geom.Rectangle(-btnW/2, -btnH/2, btnW, btnH),
                Phaser.Geom.Rectangle.Contains
            );
            c.setData("roleKey", role.key);
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
                this.activateRole(role.key, roles);
                this.tweens.add({ targets: c, scaleX: 0.93, scaleY: 0.93, duration: 70, yoyo: true });
            });
        });
    }

    private activateRole(key: string, roles: Array<{key:string; colHex:number; hex:string}>) {
        Object.values(this.roleButtons).forEach(rc => {
            const b  = rc.list[0] as Phaser.GameObjects.Rectangle;
            const lt = rc.list[2] as Phaser.GameObjects.Text;
            b.setFillStyle(this.C.card); b.setStrokeStyle(1, this.C.cardBorder);
            lt.setColor("#4a5568");
        });
        const rb = this.roleButtons[key];
        if (rb) {
            const r  = roles.find(r => r.key === key)!;
            const b  = rb.list[0] as Phaser.GameObjects.Rectangle;
            const lt = rb.list[2] as Phaser.GameObjects.Text;
            b.setFillStyle(0x0d1f3c); b.setStrokeStyle(2, r.colHex);
            lt.setColor(r.hex);
        }
        this.selectedType = key;
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
            zIndex: "5000", backgroundColor: "rgba(0,0,0,0.78)",
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
            { key: "player",    colHex: 0x22c55e, hex: "#22c55e" },
            { key: "spectator", colHex: 0x8b5cf6, hex: "#8b5cf6" },
            { key: "admin",     colHex: 0xf59e0b, hex: "#f59e0b" },
        ];

        const confirm = () => {
            if (passInput.value === ADMIN_PASSWORD) {
                overlay.remove();
                this.activateRole("admin", roles);
                this.showToast("Admin access granted \u2713", "success");
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
    //  JOIN BUTTON
    // ══════════════════════════════════════════════════════
    private createJoinButton(cx: number, cy: number, width: number) {
        const btnH = 48;
        const c    = this.add.container(cx, cy).setDepth(3);
        const bg   = this.add.rectangle(0, 0, width, btnH, this.C.accent);
        const lbl  = this.add.text(0, 0, "JOIN  QUEUE", {
            fontSize: "12px", color: "#ffffff",
            fontFamily: "'Courier New', monospace", letterSpacing: 4, fontStyle: "bold"
        }).setOrigin(0.5);
        c.add([bg, lbl]);
        c.setInteractive(
            new Phaser.Geom.Rectangle(-width/2, -btnH/2, width, btnH),
            Phaser.Geom.Rectangle.Contains
        );
        c.on("pointerover", () => { bg.setFillStyle(this.C.accentHover); this.tweens.add({ targets: c, scaleY: 1.04, duration: 100 }); });
        c.on("pointerout",  () => { bg.setFillStyle(this.C.accent);      this.tweens.add({ targets: c, scaleY: 1,    duration: 100 }); });
        c.on("pointerdown", () => {
            this.tweens.add({ targets: c, scaleX: 0.97, scaleY: 0.97, duration: 70, yoyo: true, onComplete: () => this.handleJoin() });
        });
        this.joinButton   = c;
        this.joinBtnLabel = lbl;
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
            socketService.socket.emit("join_queue", { type: "player" });
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
        ["game_started","queue_update","error","connect","connect_error","waiting_for_players","admin_joined"]
            .forEach(ev => socketService.socket.off(ev));

        socketService.socket.on("queue_update", (data: any) => {
            if (!this.queueStatusText?.active) return;
            const size  = data.queueSize || 0;
            const color = size >= 5 ? "#22c55e" : size >= 3 ? "#f59e0b" : "#3b4a5c";
            this.queueStatusText.setText(`●  ${size} / 6 in queue`).setColor(color);
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
            if (data.role === "ADMIN")          { userType = "ADMIN";     socketService.isAdmin = true; }
            else if (data.role === "SPECTATOR") { userType = "SPECTATOR"; }
            this.cleanupAllLobbyHTML();
            this.cameras.main.fadeOut(400, 6, 8, 16);
            this.time.delayedCall(400, () => {
                this.scene.start("GameScene", { role: data.role, roomId: data.roomId, userType });
            });
        });

        socketService.socket.on("connect",       () => this.showToast("Connected \u2713", "success"));
        socketService.socket.on("connect_error", () => this.showToast("Cannot connect to server", "error"));
    }

    // ══════════════════════════════════════════════════════
    //  BACKGROUND
    // ══════════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════════════════════════════
    //  VIDEO BACKGROUND
    // ═══════════════════════════════════════════════════════════════════════════
    private startBgVideo() {
        document.getElementById("lobby-bg-video")?.remove();

        // ─── خلي كل شي شفاف ───
        document.body.style.background = "transparent";
        document.body.style.margin     = "0";

        const gameDiv = document.getElementById("game");
        if (gameDiv) {
            gameDiv.style.background  = "transparent";
            gameDiv.style.position    = "fixed";
            gameDiv.style.top         = "0";
            gameDiv.style.left        = "0";
            gameDiv.style.width       = "100%";
            gameDiv.style.height      = "100%";
        }

        // force canvas transparent - نكرر كل frame أول ثانيتين
        const forceCanvasTransparent = () => {
            const canvas = document.querySelector("canvas");
            if (canvas) {
                const el = canvas as HTMLElement;
                el.style.background    = "transparent";
                el.style.position      = "fixed";
                el.style.top           = "0";
                el.style.left          = "0";
                el.style.zIndex        = "10";
                el.style.pointerEvents = "auto";
            }
        };
        forceCanvasTransparent();
        // نكرر عشان Phaser ممكن يعيد set الـ style
        const canvasTimer = setInterval(forceCanvasTransparent, 100);
        setTimeout(() => clearInterval(canvasTimer), 2000);

        // خلي الـ #game div شفاف
        const gameDiv = document.getElementById("game");
        if (gameDiv) {
            gameDiv.style.background = "transparent";
            gameDiv.style.position   = "fixed";
            gameDiv.style.top        = "0";
            gameDiv.style.left       = "0";
            gameDiv.style.width      = "100%";
            gameDiv.style.height     = "100%";
            gameDiv.style.zIndex     = "10";
        }

        // ─── الفيديو تحت الـ canvas مباشرة ───
        const vid = document.createElement("video");
        vid.id             = "lobby-bg-video";
        vid.src            = "/bg.mp4";
        vid.autoplay       = true;
        vid.loop           = true;
        vid.muted          = true;
        (vid as any).playsInline = true;
        Object.assign(vid.style, {
            position:      "fixed",
            top:           "0",
            left:          "0",
            width:         "100vw",
            height:        "100vh",
            objectFit:     "cover",
            zIndex:        "5",
            opacity:       "0",
            transition:    "opacity 1.5s ease",
            pointerEvents: "none",
        });

        vid.addEventListener("canplay", () => {
            vid.style.opacity = "0.55";
            // نشغّل بس بعد ما يكون جاهز
            if (vid.paused) {
                vid.play().catch(() => {});
            }
        });

        // أضفه أول عنصر في الـ body
        document.body.insertBefore(vid, document.body.firstChild);

        // نستنى loadedmetadata قبل play عشان نتجنب AbortError
        vid.addEventListener("loadedmetadata", () => {
            vid.play().catch(() => {});
        });
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
    private showToast(message: string, type: "success"|"error"|"info") {
        const cm = { success:{bg:0x052e16,border:0x22c55e,text:"#22c55e"}, error:{bg:0x2d0a0a,border:0xef4444,text:"#ef4444"}, info:{bg:0x0a1628,border:0x3b82f6,text:"#3b82f6"} }[type];
        const W  = this.scale.width;
        const toast = this.add.container(W/2, this.scale.height - 30).setDepth(10);
        const bg  = this.add.rectangle(0, 0, Math.min(message.length*8+40,420), 38, cm.bg);
        bg.setStrokeStyle(1, cm.border);
        const txt = this.add.text(0, 0, message, { fontSize:"12px", color:cm.text, fontFamily:"'Courier New', monospace" }).setOrigin(0.5);
        toast.add([bg, txt]).setAlpha(0);
        this.tweens.add({ targets:toast, alpha:1, y:this.scale.height-60, duration:280 });
        this.time.delayedCall(2500, () =>
            this.tweens.add({ targets:toast, alpha:0, y:this.scale.height-40, duration:280, onComplete:()=>toast.destroy() })
        );
    }

    private shakeInput() {
        this.usernameInput.style.borderColor = "#ef4444";
        this.usernameInput.style.boxShadow   = "0 0 0 3px rgba(239,68,68,0.2)";
        let n = 0;
        const orig = this.usernameInput.style.left;
        const iv = setInterval(() => {
            this.usernameInput.style.left = `${parseInt(orig) + (n%2===0?5:-5)}px`;
            n++;
            if (n>=6) { clearInterval(iv); this.usernameInput.style.left=orig; this.usernameInput.style.borderColor="#21262d"; this.usernameInput.style.boxShadow="none"; }
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
            if (p.x<0||p.x>W) p.vx*=-1;
            if (p.y<0||p.y>H) p.vy*=-1;
            const a = Math.max(0, Math.min(1, p.alpha + Math.sin(time*p.pulseSpeed+p.pulseOffset)*0.1));
            p.gfx.clear(); p.gfx.fillStyle(0x3b82f6, a); p.gfx.fillCircle(p.x, p.y, p.radius);
        });
        let lines = this.children.getByName("connLines") as Phaser.GameObjects.Graphics;
        if (!lines) lines = this.add.graphics().setName("connLines").setDepth(0);
        lines.clear();
        for (let i=0; i<this.particles.length; i++)
            for (let j=i+1; j<this.particles.length; j++) {
                const dx=this.particles[i].x-this.particles[j].x, dy=this.particles[i].y-this.particles[j].y;
                const d=Math.sqrt(dx*dx+dy*dy);
                if (d<110) { lines.lineStyle(1,0x3b82f6,(1-d/110)*0.07); lines.moveTo(this.particles[i].x,this.particles[i].y); lines.lineTo(this.particles[j].x,this.particles[j].y); lines.strokePath(); }
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
            "lobby-bg-video",
            "lobby-card-overlay",
            "global-mute-btn",
        ];
        ids.forEach(id => document.getElementById(id)?.remove());
        // ملاحظة: global-audio-ctrl لا يُمسح - يضل ظاهر بكل الشاشات
    }

    shutdown() {
        if (this.playerCountInterval) clearInterval(this.playerCountInterval);
        this.cleanupAllLobbyHTML();
        this.particles.forEach(p => p.gfx.destroy());
        this.particles = [];
        ["game_started","queue_update","error","connect","connect_error","waiting_for_players","admin_joined"]
            .forEach(ev => socketService.socket.off(ev));
    }
}