// ─── AudioManager ────────────────────────────────────────────────────────────

class AudioManager {
    private static instance: AudioManager;
    private audio: HTMLAudioElement;
    private controlEl: HTMLElement | null = null;
    private sliderEl: HTMLInputElement | null = null;
    private iconEl: HTMLElement | null = null;
    private volume: number = 0.28;
    private muted: boolean = false;

    private constructor() {
        this.audio = new Audio("/music.mp3");
        this.audio.loop   = true;
        this.audio.volume = this.volume;

        // لو خلص المقطع يرجع يشتغل (backup للـ loop)
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
        const p = this.audio.play();
        if (p !== undefined) p.catch((err) => console.warn("Audio blocked:", err));
    }

    createMuteButton() {
        if (document.getElementById("global-audio-ctrl")) return;

        // ─── الحاوية الرئيسية ───
        const wrap = document.createElement("div");
        wrap.id = "global-audio-ctrl";
        Object.assign(wrap.style, {
            position:       "fixed",
            top:            "14px",
            right:          "14px",
            zIndex:         "9999",
            display:        "flex",
            alignItems:     "center",
            gap:            "8px",
            background:     "rgba(13,17,23,0.82)",
            border:         "1px solid rgba(255,255,255,0.1)",
            borderRadius:   "24px",
            padding:        "8px 14px 8px 10px",
            backdropFilter: "blur(10px)",
            transition:     "opacity 0.2s",
            touchAction:    "none",
        });

        // ─── أيقونة الصوت (قابلة للضغط للميوت) ───
        const icon = document.createElement("span");
        icon.textContent = "🔊";
        Object.assign(icon.style, {
            fontSize:  "17px",
            cursor:    "pointer",
            userSelect:"none",
            lineHeight:"1",
            transition:"transform 0.12s",
        });
        icon.addEventListener("click", () => this.toggleMute());
        icon.addEventListener("mousedown", () => { icon.style.transform = "scale(0.82)"; });
        icon.addEventListener("mouseup",   () => { icon.style.transform = "scale(1)"; });
        // هاتف
        icon.addEventListener("touchstart", (e) => {
            e.stopPropagation();
            e.preventDefault();
            icon.style.transform = "scale(0.82)";
        }, { passive: false });
        icon.addEventListener("touchend", (e) => {
            e.stopPropagation();
            e.preventDefault();
            icon.style.transform = "scale(1)";
            this.toggleMute();
        }, { passive: false });

        // ─── Slider ───
        const slider = document.createElement("input");
        slider.type  = "range";
        slider.min   = "0";
        slider.max   = "100";
        slider.value = String(Math.round(this.volume * 100));
        Object.assign(slider.style, {
            width:       "90px",
            height:      "6px",
            cursor:      "pointer",
            accentColor: "#3b82f6",
            outline:     "none",
            border:      "none",
            background:  "transparent",
            margin:      "0",
            padding:     "0",
            touchAction: "none",        // هام للهاتف
            webkitUserSelect: "none",
        });

        // تغيير الصوت عند تحريك الـ slider
        slider.addEventListener("input", () => {
            const val = parseInt(slider.value) / 100;
            this.volume = val;
            this.audio.volume = val;
            this.muted = val === 0;
            this.updateIcon();
        });

        // ─── هاتف: نتعامل مع touch يدوياً ───
        slider.addEventListener("touchmove", (e) => {
            e.stopPropagation();
            e.preventDefault();
            const touch  = e.touches[0];
            const rect   = slider.getBoundingClientRect();
            // نضمن إن rect.width > 0
            if (rect.width === 0) return;
            const offsetX = touch.clientX - rect.left;
            const ratio   = Math.max(0, Math.min(1, offsetX / rect.width));
            const newVal  = Math.round(ratio * 100);
            slider.value  = String(newVal);
            this.volume   = newVal / 100;
            this.audio.volume = this.volume;
            this.muted    = newVal === 0;
            this.updateIcon();
            // نطلق input event عشان يتحدث الـ UI
            slider.dispatchEvent(new Event("input"));
        }, { passive: false });

        // touchstart كمان يحدد القيمة فوراً عند اللمس
        slider.addEventListener("touchstart", (e) => {
            e.stopPropagation();
            e.preventDefault();
            const touch  = e.touches[0];
            const rect   = slider.getBoundingClientRect();
            if (rect.width === 0) return;
            const offsetX = touch.clientX - rect.left;
            const ratio   = Math.max(0, Math.min(1, offsetX / rect.width));
            const newVal  = Math.round(ratio * 100);
            slider.value  = String(newVal);
            this.volume   = newVal / 100;
            this.audio.volume = this.volume;
            this.muted    = newVal === 0;
            this.updateIcon();
        }, { passive: false });

        slider.addEventListener("touchend", (e) => {
            e.stopPropagation();
        }, { passive: true });

        wrap.appendChild(icon);
        wrap.appendChild(slider);
        document.body.appendChild(wrap);

        this.controlEl = wrap;
        this.sliderEl  = slider;
        this.iconEl    = icon;
    }

    private toggleMute() {
        this.muted = !this.muted;
        if (this.muted) {
            this.audio.pause();
            if (this.sliderEl) this.sliderEl.value = "0";
        } else {
            this.audio.volume = this.volume;
            if (this.sliderEl) this.sliderEl.value = String(Math.round(this.volume * 100));
            this.audio.play().catch(() => {});
        }
        this.updateIcon();
    }

    private updateIcon() {
        if (!this.iconEl) return;
        const val = parseInt(this.sliderEl?.value ?? "0");
        if (val === 0 || this.muted) {
            this.iconEl.textContent = "🔇";
        } else if (val < 40) {
            this.iconEl.textContent = "🔉";
        } else {
            this.iconEl.textContent = "🔊";
        }
    }
}

export const audioManager = AudioManager.getInstance();