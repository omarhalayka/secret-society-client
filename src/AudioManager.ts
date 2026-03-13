// ─── AudioManager ────────────────────────────────────────────────────────────

class AudioManager {
    private static instance: AudioManager;
    private audio: HTMLAudioElement;
    private controlEl: HTMLElement | null = null;
    private volume: number = 0.28;
    private muted: boolean = false;
    private currentLevel: number = 3; // index في المصفوفة

    // مستويات الصوت المتاحة
    private readonly LEVELS = [
        { label: "🔇", value: 0   },
        { label: "🔈", value: 0.05 },
        { label: "🔉", value: 0.10 },
        { label: "🔉", value: 0.15 },
        { label: "🔊", value: 0.25 },
        { label: "🔊", value: 0.40 },
    ];

    private constructor() {
        this.audio = new Audio("/music.mp3");
        this.audio.loop   = true;
        this.audio.volume = this.LEVELS[this.currentLevel].value;
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

        const wrap = document.createElement("div");
        wrap.id = "global-audio-ctrl";
        Object.assign(wrap.style, {
            position:       "fixed",
            top:            "12px",
            right:          "12px",
            zIndex:         "9999",
            display:        "flex",
            alignItems:     "center",
            gap:            "4px",
            background:     "rgba(13,17,23,0.88)",
            border:         "1px solid rgba(255,255,255,0.1)",
            borderRadius:   "24px",
            padding:        "5px 8px",
            backdropFilter: "blur(10px)",
        });

        if (isMobile) {
            // ─── هاتف: أزرار نصية واضحة ───
            this.buildMobileButtons(wrap);
        } else {
            // ─── لابتوب: slider ───
            this.buildDesktopSlider(wrap);
        }

        document.body.appendChild(wrap);
        this.controlEl = wrap;
    }

    // ══════════════════════════════════════════
    //  MOBILE - أزرار
    // ══════════════════════════════════════════
    private buildMobileButtons(wrap: HTMLElement) {
        const levels = [0, 5, 10, 15, 25];   // النسب المئوية

        // أيقونة يسار
        const iconEl = document.createElement("span");
        iconEl.id = "audio-icon";
        iconEl.textContent = "🔊";
        Object.assign(iconEl.style, {
            fontSize: "15px", marginRight: "4px", lineHeight: "1"
        });
        wrap.appendChild(iconEl);

        levels.forEach((pct) => {
            const btn = document.createElement("button");
            btn.textContent = `${pct}`;
            const isActive = Math.round(this.LEVELS[this.currentLevel].value * 100) === pct
                || (pct === 25 && this.currentLevel === 4);

            Object.assign(btn.style, {
                minWidth:     "32px",
                height:       "28px",
                padding:      "0 6px",
                borderRadius: "14px",
                border:       "1px solid " + (isActive ? "#3b82f6" : "rgba(255,255,255,0.1)"),
                background:   isActive ? "#3b82f6" : "transparent",
                color:        isActive ? "#fff" : "#8b949e",
                fontSize:     "11px",
                fontFamily:   "'Courier New', monospace",
                cursor:       "pointer",
                transition:   "background 0.15s, color 0.15s",
                lineHeight:   "1",
            });

            const setLevel = (e: Event) => {
                e.stopPropagation();
                const val = pct / 100;
                this.audio.volume = val;
                this.muted = pct === 0;
                if (pct === 0) {
                    this.audio.pause();
                } else if (this.muted === false) {
                    this.audio.play().catch(() => {});
                }

                // أيقونة
                const ic = document.getElementById("audio-icon");
                if (ic) ic.textContent = pct === 0 ? "🔇" : pct <= 10 ? "🔉" : "🔊";

                // تحديث لون الأزرار
                wrap.querySelectorAll("button").forEach((b: Element) => {
                    const bEl = b as HTMLElement;
                    const isThis = bEl.textContent === `${pct}`;
                    bEl.style.background   = isThis ? "#3b82f6" : "transparent";
                    bEl.style.color        = isThis ? "#fff"    : "#8b949e";
                    bEl.style.borderColor  = isThis ? "#3b82f6" : "rgba(255,255,255,0.1)";
                });
            };

            btn.addEventListener("click",      setLevel);
            btn.addEventListener("touchend",   (e) => { e.preventDefault(); setLevel(e); }, { passive: false });
            btn.addEventListener("touchstart", (e) => e.stopPropagation(), { passive: true });

            wrap.appendChild(btn);
        });
    }

    // ══════════════════════════════════════════
    //  DESKTOP - slider
    // ══════════════════════════════════════════
    private buildDesktopSlider(wrap: HTMLElement) {
        const icon = document.createElement("span");
        icon.id = "audio-icon";
        icon.textContent = "🔊";
        Object.assign(icon.style, {
            fontSize:  "17px",
            cursor:    "pointer",
            userSelect:"none",
            lineHeight:"1",
            marginRight: "4px",
        });
        icon.addEventListener("click", () => this.toggleMuteDesktop(icon));

        const slider = document.createElement("input");
        slider.type  = "range";
        slider.min   = "0";
        slider.max   = "100";
        slider.value = String(Math.round(this.LEVELS[this.currentLevel].value * 100));
        Object.assign(slider.style, {
            width:       "80px",
            height:      "4px",
            cursor:      "pointer",
            accentColor: "#3b82f6",
            outline:     "none",
            border:      "none",
            background:  "transparent",
            margin:      "0",
            padding:     "0",
        });

        slider.addEventListener("input", () => {
            const val = parseInt(slider.value) / 100;
            this.audio.volume = val;
            this.muted = val === 0;
            if (val === 0) this.audio.pause();
            else this.audio.play().catch(() => {});
            const ic = document.getElementById("audio-icon");
            if (ic) ic.textContent = val === 0 ? "🔇" : val < 0.15 ? "🔉" : "🔊";
        });

        wrap.appendChild(icon);
        wrap.appendChild(slider);
    }

    private toggleMuteDesktop(iconEl: HTMLElement) {
        this.muted = !this.muted;
        if (this.muted) {
            this.audio.pause();
            iconEl.textContent = "🔇";
        } else {
            this.audio.volume = this.LEVELS[this.currentLevel].value;
            this.audio.play().catch(() => {});
            iconEl.textContent = "🔊";
        }
    }
}

export const audioManager = AudioManager.getInstance();