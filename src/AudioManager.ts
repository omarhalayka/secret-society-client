// ─── AudioManager ────────────────────────────────────────────────────────────

class AudioManager {
    private static instance: AudioManager;
    private audio: HTMLAudioElement;
    private currentVol: number = 0.28;
    private muted: boolean = false;
    private menuOpen: boolean = false;

    private readonly LEVELS = [
        { label: "0",  value: 0    },
        { label: "5",  value: 0.1  },
        { label: "10", value: 0.3  },
        { label: "15", value: 0.6  },
        { label: "25", value: 1.0  },
    ];

    private constructor() {
        this.audio = new Audio("/music.mp3");
        this.audio.loop   = true;
        this.audio.volume = this.currentVol;
        this.audio.addEventListener("ended", () => {
            this.audio.currentTime = 0;
            if (!this.muted) this.audio.play().catch(() => {});
        });
    }

    static getInstance(): AudioManager {
        if (!AudioManager.instance) {
            AudioManager.instance = new AudioManager();
        }
        return AudioManager.instance;
    }

    play() {
        if (this.muted) return;
        this.audio.play().catch((err) => console.warn("Audio blocked:", err));
    }

    createMuteButton() {
        if (document.getElementById("global-audio-ctrl")) return;

        const isMobile = window.innerWidth < 700;

        // ─── الزر الرئيسي (سماعة صغيرة) ───
        const btn = document.createElement("button");
        btn.id = "global-audio-ctrl";
        btn.textContent = "🔊";
        Object.assign(btn.style, {
            position:       "fixed",
            bottom:         "18px",
            left:           "18px",
            zIndex:         "9999",
            width:          "34px",
            height:         "34px",
            borderRadius:   "50%",
            border:         "1px solid rgba(255,255,255,0.12)",
            background:     "rgba(13,17,23,0.85)",
            color:          "#f1f5f9",
            fontSize:       "15px",
            cursor:         "pointer",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            lineHeight:     "1",
            backdropFilter: "blur(8px)",
            transition:     "transform 0.12s, background 0.15s",
            padding:        "0",
        });

        // ─── قائمة مستويات الصوت (مخفية) ───
        const menu = document.createElement("div");
        menu.id = "audio-vol-menu";
        Object.assign(menu.style, {
            position:       "fixed",
            bottom:         "60px",
            left:           "18px",
            zIndex:         "9998",
            display:        "none",
            flexDirection:  "column",
            gap:            "6px",
            background:     "rgba(13,17,23,0.92)",
            border:         "1px solid rgba(255,255,255,0.1)",
            borderRadius:   "12px",
            padding:        "8px",
            backdropFilter: "blur(10px)",
        });

        // أزرار المستويات
        this.LEVELS.forEach((lvl) => {
            const item = document.createElement("button");
            item.textContent = lvl.label;
            const isActive = Math.abs(lvl.value - this.currentVol) < 0.05;
            Object.assign(item.style, {
                width:        "34px",
                height:       "28px",
                borderRadius: "8px",
                border:       "1px solid " + (isActive ? "#3b82f6" : "rgba(255,255,255,0.08)"),
                background:   isActive ? "#3b82f6" : "transparent",
                color:        isActive ? "#fff" : "#8b949e",
                fontSize:     "11px",
                fontFamily:   "'Courier New', monospace",
                cursor:       "pointer",
                transition:   "background 0.12s",
                padding:      "0",
            });

            const pick = (e: Event) => {
                e.stopPropagation();
                this.currentVol  = lvl.value;
                this.audio.volume = lvl.value;
                this.muted = lvl.value === 0;
                if (lvl.value === 0) {
                    this.audio.pause();
                } else {
                    this.audio.play().catch(() => {});
                }
                // أيقونة الزر
                btn.textContent = lvl.value === 0 ? "🔇" : lvl.value < 0.3 ? "🔉" : "🔊";
                // تحديث الألوان
                menu.querySelectorAll("button").forEach((b) => {
                    const bEl = b as HTMLElement;
                    const active = bEl.textContent === lvl.label;
                    bEl.style.background  = active ? "#3b82f6" : "transparent";
                    bEl.style.color       = active ? "#fff"    : "#8b949e";
                    bEl.style.borderColor = active ? "#3b82f6" : "rgba(255,255,255,0.08)";
                });
                // إغلاق القائمة
                this.closeMenu(menu);
            };

            item.addEventListener("click",    pick);
            item.addEventListener("touchend", (e) => { e.preventDefault(); pick(e); }, { passive: false });
            item.addEventListener("touchstart", (e) => e.stopPropagation(), { passive: true });
            menu.appendChild(item);
        });

        // ─── فتح/إغلاق القائمة ───
        const toggleMenu = (e: Event) => {
            e.stopPropagation();
            this.menuOpen = !this.menuOpen;
            menu.style.display = this.menuOpen ? "flex" : "none";
            btn.style.background = this.menuOpen
                ? "rgba(59,130,246,0.35)"
                : "rgba(13,17,23,0.85)";
        };

        btn.addEventListener("click",    toggleMenu);
        btn.addEventListener("touchend", (e) => { e.preventDefault(); toggleMenu(e); }, { passive: false });
        btn.addEventListener("touchstart", (e) => e.stopPropagation(), { passive: true });

        // إغلاق لو ضغط برا
        document.addEventListener("click", (e) => {
            if (this.menuOpen && e.target !== btn) this.closeMenu(menu);
        });
        document.addEventListener("touchstart", (e) => {
            if (this.menuOpen && e.target !== btn) this.closeMenu(menu);
        }, { passive: true });

        // للابتوب - slider بدل الأزرار
        if (!isMobile) {
            menu.innerHTML = "";
            menu.style.flexDirection = "column";
            menu.style.padding = "10px 12px";
            menu.style.gap = "0";

            const sliderLabel = document.createElement("div");
            sliderLabel.textContent = "Volume";
            sliderLabel.style.cssText = "color:#4a5568;font-size:9px;font-family:'Courier New',monospace;letter-spacing:2px;margin-bottom:8px;text-align:center";

            const slider = document.createElement("input");
            slider.type = "range"; slider.min = "0"; slider.max = "100";
            slider.value = String(Math.round(this.currentVol * 100));
            Object.assign(slider.style, {
                width: "90px", accentColor: "#3b82f6",
                cursor: "pointer", margin: "0",
            });
            slider.addEventListener("input", () => {
                const val = parseInt(slider.value) / 100;
                this.currentVol = val; this.audio.volume = val;
                this.muted = val === 0;
                if (val === 0) this.audio.pause();
                else this.audio.play().catch(() => {});
                btn.textContent = val === 0 ? "🔇" : val < 0.15 ? "🔉" : "🔊";
            });

            menu.appendChild(sliderLabel);
            menu.appendChild(slider);
        }

        document.body.appendChild(menu);
        document.body.appendChild(btn);
    }

    private closeMenu(menu: HTMLElement) {
        this.menuOpen = false;
        menu.style.display = "none";
        const btn = document.getElementById("global-audio-ctrl");
        if (btn) btn.style.background = "rgba(13,17,23,0.85)";
    }
}

export const audioManager = AudioManager.getInstance();