import Phaser from "phaser";
import { socketService } from "../../socket";

export default class LobbyScene extends Phaser.Scene {

    private usernameInput!: HTMLInputElement;
    private selectedType: string = "player";
    private queueStatusText!: Phaser.GameObjects.Text;
    private playerCountInterval?: number;

    // متغيرات للأزرار عشان نقدر نتحكم فيها
    private roleButtons: { [key: string]: Phaser.GameObjects.Container } = {};
    private joinButton!: Phaser.GameObjects.Container;

    // جسيمات الخلفية
    private particles: Array<{
        gfx: Phaser.GameObjects.Graphics;
        x: number; y: number;
        vx: number; vy: number;
        radius: number; alpha: number;
        pulseSpeed: number; pulseOffset: number;
    }> = [];
    private bgLines: Array<{
        gfx: Phaser.GameObjects.Graphics;
        x1: number; y1: number;
        x2: number; y2: number;
        alpha: number; fadeDir: number;
    }> = [];

    // ألوان الثيم
    private readonly COLORS = {
        bg:           0x0a0d13,
        surface:      0x111827,
        surfaceHover: 0x1a2234,
        border:       0x1e2d45,
        borderActive: 0x3b82f6,
        accent:       0x3b82f6,
        accentHover:  0x60a5fa,
        textPrimary:  0xf1f5f9,
        textMuted:    0x64748b,
        textSub:      0x94a3b8,
        player:       0x22c55e,
        spectator:    0x3b82f6,
        admin:        0xf59e0b,
        success:      0x22c55e,
        error:        0xef4444,
    };

    constructor() {
        super("LobbyScene");
    }

    create() {
        console.log("LobbyScene create");

        this.cameras.main.setBackgroundColor("#0a0d13");
        this.cameras.main.fadeIn(600, 10, 13, 19);

        // ── Splash Screen ──
        this.showSplashScreen();

        const W = this.scale.width;
        const H = this.scale.height;

        // ─── خلفية مع شبكة دقيقة ───
        this.drawGrid(W, H);

        // ─── بطاقة مركزية ───
        // Mobile responsive card
        const cardW = Math.min(460, W - 32);
        const cardH = Math.min(560, H - 40);
        const cardX = W / 2 - cardW / 2;
        const cardY = H / 2 - cardH / 2;

        // ظل البطاقة
        const shadow = this.add.rectangle(W / 2 + 4, H / 2 + 6, cardW, cardH, 0x000000, 0.4);
        shadow.setDepth(0);

        // جسم البطاقة
        const card = this.add.rectangle(W / 2, H / 2, cardW, cardH, this.COLORS.surface);
        card.setStrokeStyle(1, this.COLORS.border);
        card.setDepth(1);

        // شريط علوي ملون في البطاقة
        const topStripe = this.add.rectangle(W / 2, cardY + 3, cardW - 2, 3, this.COLORS.accent);
        topStripe.setOrigin(0.5, 0);
        topStripe.setDepth(2);

        // ─── Logo / Title ───
        this.createLogo(W / 2, cardY + 55);

        // ─── حقل الاسم ───
        this.createUsernameInput(W / 2, cardY + 145);

        // ─── أزرار الدور ───
        this.createRoleSelector(W / 2, cardY + 260);

        // ─── زر الانضمام ───
        this.createJoinButton(W / 2, cardY + 390);

        // ─── نص حالة الطابور ───
        this.queueStatusText = this.add.text(W / 2, cardY + 450, "⬤  0 / 6 players in queue", {
            fontSize: "13px",
            color: "#64748b",
            fontFamily: "'Courier New', monospace"
        }).setOrigin(0.5).setDepth(2);

        // ─── Footer ───
        this.add.text(W / 2, cardY + cardH - 22, "SECRET SOCIETY  ·  v1.0", {
            fontSize: "11px",
            color: "#1e2d45",
            fontFamily: "'Courier New', monospace",
            letterSpacing: 2
        }).setOrigin(0.5).setDepth(2);

        // ─── Socket Events ───
        this.setupSocketEvents();

        // تحديث الطابور كل 3 ثواني
        this.playerCountInterval = window.setInterval(() => {
            socketService.socket.emit("request_queue_status");
        }, 3000);
    }

    // ═══════════════════════════════════════
    //  شبكة الخلفية الثابتة
    // ═══════════════════════════════════════
    private drawGrid(W: number, H: number) {
        const graphics = this.add.graphics();
        graphics.lineStyle(1, 0x111827, 0.8);

        const step = 48;
        for (let x = 0; x < W; x += step) {
            graphics.moveTo(x, 0);
            graphics.lineTo(x, H);
        }
        for (let y = 0; y < H; y += step) {
            graphics.moveTo(0, y);
            graphics.lineTo(W, y);
        }
        graphics.strokePath();
        graphics.setDepth(0);

        // نقاط التقاطع
        const dots = this.add.graphics();
        dots.fillStyle(0x1e2d45, 0.6);
        const step2 = 48;
        for (let x = 0; x < W; x += step2) {
            for (let y = 0; y < H; y += step2) {
                dots.fillCircle(x, y, 1);
            }
        }
        dots.setDepth(0);

        // ─── جسيمات متحركة ───
        this.spawnParticles(W, H);
    }

    // ═══════════════════════════════════════
    //  إنشاء الجسيمات
    // ═══════════════════════════════════════
    private spawnParticles(W: number, H: number) {
        const count = 28;
        for (let i = 0; i < count; i++) {
            const gfx = this.add.graphics();
            gfx.setDepth(0);

            const radius = Phaser.Math.Between(1, 3);
            const x = Phaser.Math.Between(0, W);
            const y = Phaser.Math.Between(0, H);
            const speed = 0.15 + Math.random() * 0.3;
            const angle = Math.random() * Math.PI * 2;

            this.particles.push({
                gfx,
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius,
                alpha: 0.1 + Math.random() * 0.4,
                pulseSpeed: 0.01 + Math.random() * 0.02,
                pulseOffset: Math.random() * Math.PI * 2
            });
        }

        // ─── خطوط متلاشية ───
        const lineCount = 6;
        for (let i = 0; i < lineCount; i++) {
            const gfx = this.add.graphics();
            gfx.setDepth(0);
            this.bgLines.push({
                gfx,
                x1: Math.random() * W, y1: Math.random() * H,
                x2: Math.random() * W, y2: Math.random() * H,
                alpha: 0,
                fadeDir: 1
            });
        }
    }

    // ═══════════════════════════════════════
    //  تحديث كل فريم
    // ═══════════════════════════════════════
    update(time: number, _delta: number) {
        const W = this.scale.width;
        const H = this.scale.height;

        // تحريك الجسيمات
        this.particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;

            // ارتداد من الحواف
            if (p.x < 0 || p.x > W) p.vx *= -1;
            if (p.y < 0 || p.y > H) p.vy *= -1;

            // نبض الـ alpha
            const pulse = Math.sin(time * p.pulseSpeed + p.pulseOffset);
            const currentAlpha = p.alpha + pulse * 0.15;

            p.gfx.clear();
            p.gfx.fillStyle(0x3b82f6, Math.max(0, Math.min(1, currentAlpha)));
            p.gfx.fillCircle(p.x, p.y, p.radius);
        });

        // رسم خطوط الاتصال بين الجسيمات القريبة
        const connectionGfx = this.children.getByName("connectionLines") as Phaser.GameObjects.Graphics;
        const lines = connectionGfx || this.add.graphics().setName("connectionLines").setDepth(0);

        if (!connectionGfx) {
            // تم إنشاؤه للتو
        }
        lines.clear();

        for (let i = 0; i < this.particles.length; i++) {
            for (let j = i + 1; j < this.particles.length; j++) {
                const dx = this.particles[i].x - this.particles[j].x;
                const dy = this.particles[i].y - this.particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const maxDist = 120;

                if (dist < maxDist) {
                    const alpha = (1 - dist / maxDist) * 0.12;
                    lines.lineStyle(1, 0x3b82f6, alpha);
                    lines.moveTo(this.particles[i].x, this.particles[i].y);
                    lines.lineTo(this.particles[j].x, this.particles[j].y);
                    lines.strokePath();
                }
            }
        }
    }

    // ═══════════════════════════════════════
    //  اللوجو
    // ═══════════════════════════════════════
    private createLogo(cx: number, cy: number) {
        // أيقونة صغيرة
        const icon = this.add.graphics();
        icon.fillStyle(this.COLORS.accent, 1);
        // شكل معين صغير
        icon.fillTriangle(cx - 10, cy - 16, cx + 10, cy - 16, cx, cy - 2);
        icon.fillTriangle(cx - 10, cy + 0, cx + 10, cy + 0, cx, cy - 14);
        icon.setDepth(2);
        icon.setAlpha(0);

        this.add.text(cx, cy + 14, "SECRET SOCIETY", {
            fontSize: "26px",
            color: "#f1f5f9",
            fontFamily: "'Georgia', serif",
            fontStyle: "bold",
            letterSpacing: 4
        }).setOrigin(0.5).setDepth(2).setAlpha(0)
          .setData("anim", true);

        this.add.text(cx, cy + 36, "MULTIPLAYER  ·  SOCIAL DEDUCTION", {
            fontSize: "10px",
            color: "#3b82f6",
            fontFamily: "'Courier New', monospace",
            letterSpacing: 3
        }).setOrigin(0.5).setDepth(2).setAlpha(0)
          .setData("anim", true);

        // أنيميشن ظهور
        this.time.delayedCall(100, () => {
            this.children.list
                .filter((c: any) => c.getData && c.getData("anim"))
                .forEach((obj: any, i: number) => {
                    obj.setAlpha(0);
                    this.tweens.add({
                        targets: obj,
                        alpha: 1,
                        y: obj.y - 6,
                        duration: 500,
                        ease: "Cubic.easeOut",
                        delay: i * 100
                    });
                });

            this.tweens.add({
                targets: icon,
                alpha: 1,
                duration: 400,
                ease: "Cubic.easeOut"
            });
        });
    }

    // ═══════════════════════════════════════
    //  حقل الاسم
    // ═══════════════════════════════════════
    private createUsernameInput(cx: number, cy: number) {
        const existing = document.getElementById("lobby-username");
        if (existing) existing.remove();

        // Label
        this.add.text(cx - 180, cy - 22, "USERNAME", {
            fontSize: "10px",
            color: "#3b82f6",
            fontFamily: "'Courier New', monospace",
            letterSpacing: 2
        }).setDepth(2);

        this.usernameInput = document.createElement("input");
        this.usernameInput.id = "lobby-username";
        this.usernameInput.type = "text";
        this.usernameInput.placeholder = "Enter your name...";
        this.usernameInput.maxLength = 20;

        Object.assign(this.usernameInput.style, {
            position: "absolute",
            left: `${cx - 180}px`,
            top: `${cy}px`,
            width: "360px",
            padding: "12px 16px",
            fontSize: "15px",
            fontFamily: "'Courier New', monospace",
            borderRadius: "6px",
            border: "1px solid #1e2d45",
            backgroundColor: "#0a0d13",
            color: "#f1f5f9",
            outline: "none",
            zIndex: "1000",
            letterSpacing: "1px",
            transition: "border-color 0.2s ease, box-shadow 0.2s ease"
        });

        this.usernameInput.addEventListener("focus", () => {
            this.usernameInput.style.borderColor = "#3b82f6";
            this.usernameInput.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.15)";
        });

        this.usernameInput.addEventListener("blur", () => {
            this.usernameInput.style.borderColor = "#1e2d45";
            this.usernameInput.style.boxShadow = "none";
        });

        document.body.appendChild(this.usernameInput);
    }

    // ═══════════════════════════════════════
    //  أزرار اختيار الدور
    // ═══════════════════════════════════════
    private createRoleSelector(cx: number, cy: number) {
        // Label
        this.add.text(cx - 180, cy - 52, "JOIN AS", {
            fontSize: "10px",
            color: "#3b82f6",
            fontFamily: "'Courier New', monospace",
            letterSpacing: 2
        }).setDepth(2);

        const roles = [
            { key: "player",    label: "PLAYER",    icon: "⚔",  color: this.COLORS.player,    hex: "#22c55e" },
            { key: "spectator", label: "SPECTATOR", icon: "👁",  color: this.COLORS.spectator, hex: "#3b82f6" },
            { key: "admin",     label: "ADMIN",     icon: "⚙",  color: this.COLORS.admin,     hex: "#f59e0b" }
        ];

        const btnW = 112;
        const btnH = 60;
        const gap = 8;
        const totalW = roles.length * btnW + (roles.length - 1) * gap;
        const startX = cx - totalW / 2;

        roles.forEach((role, i) => {
            const bx = startX + i * (btnW + gap) + btnW / 2;
            const isActive = role.key === this.selectedType;

            const container = this.add.container(bx, cy).setDepth(2);

            // خلفية الزر
            const bg = this.add.rectangle(0, 0, btnW, btnH,
                isActive ? 0x0f172a : this.COLORS.surface
            );
            bg.setStrokeStyle(isActive ? 2 : 1,
                isActive ? role.color : this.COLORS.border
            );

            // أيقونة
            const iconText = this.add.text(0, -10, role.icon, {
                fontSize: "18px"
            }).setOrigin(0.5);

            // نص
            const label = this.add.text(0, 13, role.label, {
                fontSize: "10px",
                color: isActive ? role.hex : "#64748b",
                fontFamily: "'Courier New', monospace",
                letterSpacing: 1,
                fontStyle: "bold"
            }).setOrigin(0.5);

            container.add([bg, iconText, label]);
            container.setInteractive(
                new Phaser.Geom.Rectangle(-btnW / 2, -btnH / 2, btnW, btnH),
                Phaser.Geom.Rectangle.Contains
            );

            container.on("pointerover", () => {
                if (this.selectedType !== role.key) {
                    bg.setFillStyle(this.COLORS.surfaceHover);
                    bg.setStrokeStyle(1, role.color);
                    label.setColor(role.hex);
                }
                this.tweens.add({ targets: container, scaleX: 1.03, scaleY: 1.03, duration: 120 });
            });

            container.on("pointerout", () => {
                if (this.selectedType !== role.key) {
                    bg.setFillStyle(this.COLORS.surface);
                    bg.setStrokeStyle(1, this.COLORS.border);
                    label.setColor("#64748b");
                }
                this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 120 });
            });

            container.on("pointerdown", () => {
                // إعادة تعيين كل الأزرار
                Object.values(this.roleButtons).forEach(c => {
                    const b = c.list[0] as Phaser.GameObjects.Rectangle;
                    const l = c.list[2] as Phaser.GameObjects.Text;
                    const r = roles.find(r => r.key === c.getData("roleKey"));
                    if (r) {
                        b.setFillStyle(this.COLORS.surface);
                        b.setStrokeStyle(1, this.COLORS.border);
                        l.setColor("#64748b");
                    }
                });

                // تفعيل الزر المختار
                bg.setFillStyle(0x0f172a);
                bg.setStrokeStyle(2, role.color);
                label.setColor(role.hex);
                this.selectedType = role.key;

                // أنيميشن ضغط
                this.tweens.add({
                    targets: container,
                    scaleX: 0.95, scaleY: 0.95,
                    duration: 80, yoyo: true
                });
            });

            container.setData("roleKey", role.key);
            this.roleButtons[role.key] = container;
        });
    }

    // ═══════════════════════════════════════
    //  زر الانضمام
    // ═══════════════════════════════════════
    private createJoinButton(cx: number, cy: number) {
        const btnW = 360;
        const btnH = 48;

        const container = this.add.container(cx, cy).setDepth(2);

        const bg = this.add.rectangle(0, 0, btnW, btnH, this.COLORS.accent);

        const label = this.add.text(0, 0, "JOIN QUEUE", {
            fontSize: "13px",
            color: "#ffffff",
            fontFamily: "'Courier New', monospace",
            letterSpacing: 3,
            fontStyle: "bold"
        }).setOrigin(0.5);

        container.add([bg, label]);
        container.setInteractive(
            new Phaser.Geom.Rectangle(-btnW / 2, -btnH / 2, btnW, btnH),
            Phaser.Geom.Rectangle.Contains
        );

        container.on("pointerover", () => {
            bg.setFillStyle(this.COLORS.accentHover);
            this.tweens.add({ targets: container, scaleY: 1.04, duration: 120 });
        });

        container.on("pointerout", () => {
            bg.setFillStyle(this.COLORS.accent);
            this.tweens.add({ targets: container, scaleY: 1, duration: 120 });
        });

        container.on("pointerdown", () => {
            this.tweens.add({
                targets: container,
                scaleX: 0.97, scaleY: 0.97,
                duration: 80, yoyo: true,
                onComplete: () => this.handleJoin()
            });
        });

        this.joinButton = container;
    }

    // ═══════════════════════════════════════
    //  منطق الانضمام
    // ═══════════════════════════════════════
    private handleJoin() {
        const username = this.usernameInput?.value.trim();

        if (!username || username.length < 3) {
            this.showToast("Username must be at least 3 characters", "error");
            this.shakeInput();
            return;
        }

        // ✅ FIX: reset socketService قبل أي join جديد
        socketService.reset();
        socketService.socket.emit("set_username", username);

        if (this.selectedType === "admin") {
            socketService.isAdmin = true;
            socketService.socket.emit("join_admin");
            this.showToast("Joining as admin...", "info");
        } else if (this.selectedType === "spectator") {
            socketService.socket.emit("spectator_join_game");
            this.showToast("Looking for active game...", "info");
        } else {
            socketService.socket.emit("join_queue", { type: "player" });
            this.showToast("Joining queue...", "success");
        }

        // تعطيل الزر مؤقتاً
        this.joinButton.setAlpha(0.6);
        this.joinButton.disableInteractive();
        this.time.delayedCall(2000, () => {
            if (this.joinButton && this.joinButton.active) {
                this.joinButton.setAlpha(1);
                this.joinButton.setInteractive(
                    new Phaser.Geom.Rectangle(-180, -24, 360, 48),
                    Phaser.Geom.Rectangle.Contains
                );
            }
        });
    }

    // ═══════════════════════════════════════
    //  Socket Events
    // ═══════════════════════════════════════
    private setupSocketEvents() {
        socketService.socket.off("game_started");
        socketService.socket.off("queue_update");
        socketService.socket.off("error");
        socketService.socket.off("connect");
        socketService.socket.off("connect_error");
        socketService.socket.off("waiting_for_players");
        socketService.socket.off("admin_joined");

        // ─── حالة الطابور ───
        socketService.socket.on("queue_update", (data: any) => {
            if (this.queueStatusText?.active) {
                const size  = data.queueSize || 0;
                const color = size >= 5 ? "#22c55e" : size >= 3 ? "#f59e0b" : "#64748b";
                this.queueStatusText.setText(`⬤  ${size} / 6 players in queue`);
                this.queueStatusText.setColor(color);
            }
        });

        // ─── خطأ (مثل: ما في لعبة للمشاهد) ───
        socketService.socket.on("error", (data: any) => {
            this.showToast(data.message, "error");
            if (this.joinButton?.active) {
                this.joinButton.setAlpha(1);
                this.joinButton.setInteractive(
                    new Phaser.Geom.Rectangle(-180, -24, 360, 48),
                    Phaser.Geom.Rectangle.Contains
                );
            }
        });

        // ─── الأدمن انضم بنجاح ───
        socketService.socket.on("admin_joined", () => {
            this.showToast("Admin panel ready", "success");
        });

        // ✅ FIX: الأدمن يستنى لو ما في غرفة بعد
        socketService.socket.on("waiting_for_players", (data: any) => {
            this.showToast(data.message || "Waiting for players to join...", "info");
            if (this.queueStatusText?.active) {
                this.queueStatusText.setText("⬤  Waiting for a game to start...");
                this.queueStatusText.setColor("#f59e0b");
            }
            // ✅ نُعيد تفعيل الزر عشان الأدمن ما يبقى عالق
            if (this.joinButton?.active) {
                this.joinButton.setAlpha(1);
                this.joinButton.setInteractive(
                    new Phaser.Geom.Rectangle(-180, -24, 360, 48),
                    Phaser.Geom.Rectangle.Contains
                );
            }
        });

        // ─── دخول اللعبة ───
        socketService.socket.on("game_started", (data: any) => {
            // ✅ FIX: userType يتحدد من data.role مباشرة — مش من socketService.isAdmin فقط
            let userType = "PLAYER";
            if (data.role === "ADMIN")          { userType = "ADMIN";     socketService.isAdmin = true; }
            else if (data.role === "SPECTATOR") { userType = "SPECTATOR"; }

            if (this.usernameInput) this.usernameInput.remove();

            this.cameras.main.fadeOut(400, 10, 13, 19);
            this.time.delayedCall(400, () => {
                this.scene.start("GameScene", {
                    role:     data.role,
                    roomId:   data.roomId,
                    userType: userType
                });
            });
        });

        socketService.socket.on("connect", () => {
            this.showToast("Connected to server", "success");
        });

        socketService.socket.on("connect_error", () => {
            this.showToast("Cannot connect to server", "error");
        });
    }

    // ═══════════════════════════════════════
    //  Toast Notification
    // ═══════════════════════════════════════
    private showToast(message: string, type: "success" | "error" | "info") {
        const colorMap = {
            success: { bg: 0x052e16, border: 0x22c55e, text: "#22c55e" },
            error:   { bg: 0x2d0a0a, border: 0xef4444, text: "#ef4444" },
            info:    { bg: 0x0a1628, border: 0x3b82f6, text: "#3b82f6" }
        };
        const c = colorMap[type];
        const W = this.scale.width;

        const toast = this.add.container(W / 2, this.scale.height - 60).setDepth(10);

        const msgWidth = Math.min(message.length * 8 + 40, 400);
        const bg = this.add.rectangle(0, 0, msgWidth, 38, c.bg);
        bg.setStrokeStyle(1, c.border);

        const text = this.add.text(0, 0, message, {
            fontSize: "13px",
            color: c.text,
            fontFamily: "'Courier New', monospace"
        }).setOrigin(0.5);

        toast.add([bg, text]);
        toast.setAlpha(0);
        toast.setY(this.scale.height - 30);

        this.tweens.add({
            targets: toast,
            alpha: 1,
            y: this.scale.height - 60,
            duration: 300,
            ease: "Cubic.easeOut"
        });

        this.time.delayedCall(2500, () => {
            this.tweens.add({
                targets: toast,
                alpha: 0,
                y: this.scale.height - 40,
                duration: 300,
                onComplete: () => toast.destroy()
            });
        });
    }

    // ═══════════════════════════════════════
    //  اهتزاز حقل الاسم عند الخطأ
    // ═══════════════════════════════════════
    private shakeInput() {
        this.usernameInput.style.borderColor = "#ef4444";
        this.usernameInput.style.boxShadow = "0 0 0 3px rgba(239,68,68,0.2)";

        let count = 0;
        const originalLeft = this.usernameInput.style.left;
        const interval = setInterval(() => {
            const offset = count % 2 === 0 ? "4px" : "-4px";
            const baseLeft = parseInt(originalLeft) || 0;
            this.usernameInput.style.left = `${baseLeft + parseInt(offset)}px`;
            count++;
            if (count >= 6) {
                clearInterval(interval);
                this.usernameInput.style.left = originalLeft;
                this.usernameInput.style.borderColor = "#1e2d45";
                this.usernameInput.style.boxShadow = "none";
            }
        }, 50);
    }

    // ═══════════════════════════════════════
    //  Shutdown
    // ═══════════════════════════════════════
    shutdown() {
        if (this.playerCountInterval) clearInterval(this.playerCountInterval);
        if (this.usernameInput) this.usernameInput.remove();
        this.particles.forEach(p => p.gfx.destroy());
        this.particles = [];
        this.bgLines.forEach(l => l.gfx.destroy());
        this.bgLines = [];
        socketService.socket.off("game_started");
        socketService.socket.off("queue_update");
        socketService.socket.off("error");
        socketService.socket.off("connect");
        socketService.socket.off("connect_error");
        socketService.socket.off("waiting_for_players");
        socketService.socket.off("admin_joined");
    }
    // ══════════════════════════════════════
    //  Splash Screen
    // ══════════════════════════════════════
    private showSplashScreen() {
        const existing = document.getElementById("splash-screen");
        if (existing) existing.remove();

        const splash = document.createElement("div");
        splash.id = "splash-screen";
        Object.assign(splash.style, {
            position: "fixed", top: "0", left: "0", right: "0", bottom: "0",
            zIndex: "9999",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            backgroundColor: "#0a0d13",
            animation: "splashFadeIn 0.6s ease",
        });

        // CSS animation
        const style = document.createElement("style");
        style.textContent = `
            @keyframes splashFadeIn { from { opacity: 0 } to { opacity: 1 } }
            @keyframes splashFadeOut { from { opacity: 1 } to { opacity: 0 } }
        `;
        document.head.appendChild(style);

        // الصورة
        const img = document.createElement("img");
        img.src = "/welcome.jpg";
        Object.assign(img.style, {
            maxWidth: "90%", maxHeight: "70vh",
            borderRadius: "12px",
            boxShadow: "0 0 40px rgba(59,130,246,0.3)",
            objectFit: "contain",
        });
        img.onerror = () => { img.style.display = "none"; };

        // زر الدخول
        const btn = document.createElement("button");
        btn.innerHTML = "&#9654; ادخل المجتمع السري";
        Object.assign(btn.style, {
            marginTop: "28px", padding: "14px 40px",
            fontSize: "16px", fontFamily: "'Courier New', monospace",
            fontWeight: "bold", letterSpacing: "2px",
            color: "#f1f5f9", backgroundColor: "transparent",
            border: "1px solid #3b82f6", borderRadius: "6px",
            cursor: "pointer", transition: "all 0.2s",
        });
        btn.onmouseenter = () => { btn.style.backgroundColor = "#3b82f6"; };
        btn.onmouseleave = () => { btn.style.backgroundColor = "transparent"; };

        const hint = document.createElement("div");
        hint.textContent = "اضغط في أي مكان للمتابعة";
        Object.assign(hint.style, {
            marginTop: "12px", fontSize: "12px",
            color: "#374151", fontFamily: "'Courier New', monospace",
        });

        splash.appendChild(img);
        splash.appendChild(btn);
        splash.appendChild(hint);
        document.body.appendChild(splash);

        const dismiss = () => {
            splash.style.animation = "splashFadeOut 0.4s ease forwards";
            setTimeout(() => splash.remove(), 400);
        };

        btn.onclick = (e) => { e.stopPropagation(); dismiss(); };
        splash.onclick = dismiss;
    }


}