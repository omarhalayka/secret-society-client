// ─── AudioManager - singleton يشتغل عبر كل الـ scenes ───────────────────────
class AudioManager {
    private static instance: AudioManager;
    private audio: HTMLAudioElement;
    private muteBtn: HTMLElement | null = null;
    private isMuted: boolean = false;
    private started: boolean = false;

    private constructor() {
        this.audio = document.createElement("audio");
        this.audio.src = "/music.mp3";
        this.audio.loop = true;
        this.audio.volume = 0.28;
        this.audio.preload = "auto";
        document.body.appendChild(this.audio);
    }

    static getInstance(): AudioManager {
        if (!AudioManager.instance) {
            AudioManager.instance = new AudioManager();
        }
        return AudioManager.instance;
    }

    // ─── شغّل الموسيقى (يُستدعى عند أول تفاعل) ───
    play() {
        if (this.isMuted || this.started) return;
        this.audio.play().then(() => {
            this.started = true;
        }).catch(() => {});
    }

    // ─── أنشئ زر الـ mute فوراً (مستقل عن تشغيل الموسيقى) ───
    createMuteButton() {
        if (document.getElementById("global-mute-btn")) return;

        const btn = document.createElement("button");
        btn.id = "global-mute-btn";
        btn.innerHTML = "🔊";
        Object.assign(btn.style, {
            position:       "fixed",
            top:            "16px",
            right:          "16px",
            zIndex:         "9999",
            width:          "40px",
            height:         "40px",
            borderRadius:   "50%",
            border:         "1px solid rgba(255,255,255,0.15)",
            background:     "rgba(13,17,23,0.85)",
            color:          "#f1f5f9",
            fontSize:       "18px",
            cursor:         "pointer",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            backdropFilter: "blur(8px)",
            transition:     "background 0.2s, transform 0.15s",
            lineHeight:     "1",
        });

        btn.addEventListener("mouseover", () => {
            btn.style.background = "rgba(59,130,246,0.3)";
        });
        btn.addEventListener("mouseout", () => {
            btn.style.background = this.isMuted
                ? "rgba(239,68,68,0.25)"
                : "rgba(13,17,23,0.85)";
        });
        btn.addEventListener("click", () => this.toggle());

        document.body.appendChild(btn);
        this.muteBtn = btn;
    }

    private toggle() {
        this.isMuted = !this.isMuted;

        if (this.isMuted) {
            this.audio.pause();
            if (this.muteBtn) {
                this.muteBtn.innerHTML = "🔇";
                this.muteBtn.style.background = "rgba(239,68,68,0.25)";
                this.muteBtn.style.borderColor = "rgba(239,68,68,0.3)";
            }
        } else {
            this.audio.play().catch(() => {});
            if (this.muteBtn) {
                this.muteBtn.innerHTML = "🔊";
                this.muteBtn.style.background = "rgba(13,17,23,0.85)";
                this.muteBtn.style.borderColor = "rgba(255,255,255,0.15)";
            }
        }

        if (this.muteBtn) {
            this.muteBtn.style.transform = "scale(0.88)";
            setTimeout(() => {
                if (this.muteBtn) this.muteBtn.style.transform = "scale(1)";
            }, 120);
        }
    }
}

export const audioManager = AudioManager.getInstance();