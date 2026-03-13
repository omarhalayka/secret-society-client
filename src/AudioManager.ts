// ─── AudioManager ────────────────────────────────────────────────────────────

class AudioManager {
    private static instance: AudioManager;
    private audio: HTMLAudioElement;
    private muteBtn: HTMLElement | null = null;
    private isMuted: boolean = false;

    private constructor() {
        this.audio = new Audio("/music.mp3");
        this.audio.loop   = true;
        this.audio.volume = 0.28;
    }

    static getInstance(): AudioManager {
        if (!AudioManager.instance) {
            AudioManager.instance = new AudioManager();
        }
        return AudioManager.instance;
    }

    // استدعيها عند أول click من المستخدم
    play() {
        if (this.isMuted) return;
        const p = this.audio.play();
        if (p !== undefined) {
            p.catch((err) => {
                console.warn("Audio play blocked:", err);
            });
        }
    }

    createMuteButton() {
        if (document.getElementById("global-mute-btn")) return;

        const btn = document.createElement("button");
        btn.id = "global-mute-btn";
        btn.textContent = "🔊";
        Object.assign(btn.style, {
            position:       "fixed",
            top:            "14px",
            right:          "14px",
            zIndex:         "9999",
            width:          "38px",
            height:         "38px",
            borderRadius:   "50%",
            border:         "1px solid rgba(255,255,255,0.12)",
            background:     "rgba(13,17,23,0.82)",
            color:          "#f1f5f9",
            fontSize:       "17px",
            cursor:         "pointer",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            lineHeight:     "1",
            transition:     "transform 0.12s ease, background 0.2s ease",
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
                this.muteBtn.textContent = "🔇";
                this.muteBtn.style.background = "rgba(239,68,68,0.22)";
                this.muteBtn.style.borderColor = "rgba(239,68,68,0.35)";
            }
        } else {
            this.audio.play().catch(() => {});
            if (this.muteBtn) {
                this.muteBtn.textContent = "🔊";
                this.muteBtn.style.background = "rgba(13,17,23,0.82)";
                this.muteBtn.style.borderColor = "rgba(255,255,255,0.12)";
            }
        }

        // أنيميشن ضغط
        if (this.muteBtn) {
            this.muteBtn.style.transform = "scale(0.85)";
            setTimeout(() => {
                if (this.muteBtn) this.muteBtn.style.transform = "scale(1)";
            }, 110);
        }
    }
}

export const audioManager = AudioManager.getInstance();