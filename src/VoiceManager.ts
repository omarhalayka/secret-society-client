// ════════════════════════════════════════════════════════
//  VoiceManager — WebRTC voice chat via PeerJS
//  Channels:
//    DAY / VOTING / NIGHT_REVIEW: all players hear each other
//    NIGHT: only MAFIA hear each other; others are isolated
//    DEAD: can hear and speak freely (always)
// ════════════════════════════════════════════════════════

declare const Peer: any;

interface PeerConnection {
    peerId:   string;
    call?:    any;
    stream?:  MediaStream;
    audio?:   HTMLAudioElement;
    role?:    string;
    username?: string;
}

class VoiceManagerClass {
    private peer:          any = null;
    private myStream:      MediaStream | null = null;
    private myPeerId:      string | null = null;
    private connections:   Map<string, PeerConnection> = new Map();
    private isMuted:       boolean = false;
    private isEnabled:     boolean = false;
    private currentPhase:  string = "DAY";
    private myRole:        string = "CITIZEN";
    private myAlive:       boolean = true;

    // callbacks
    public onPeerIdReady:  ((id: string) => void) | null = null;
    public onMuteChange:   ((muted: boolean) => void) | null = null;
    public onPeerJoined:   ((username: string) => void) | null = null;
    public onPeerLeft:     ((username: string) => void) | null = null;

    // ─── تهيئة الـ Peer ───
    async init(): Promise<string | null> {
        if (this.peer) return this.myPeerId;

        // تحقق إن PeerJS محمّل
        if (typeof Peer === "undefined") {
            console.error("PeerJS not loaded");
            return null;
        }

        return new Promise((resolve) => {
            this.peer = new Peer({
                host:   "0.peerjs.com",
                port:   443,
                secure: true,
                config: {
                    iceServers: [
                        { urls: "stun:stun.l.google.com:19302" },
                        { urls: "stun:stun1.l.google.com:19302" },
                    ]
                }
            });

            this.peer.on("open", (id: string) => {
                this.myPeerId = id;
                console.log("✅ PeerJS ready:", id);
                if (this.onPeerIdReady) this.onPeerIdReady(id);
                resolve(id);
            });

            this.peer.on("call", (call: any) => {
                this.answerCall(call);
            });

            this.peer.on("error", (err: any) => {
                console.error("PeerJS error:", err);
                resolve(null);
            });

            // timeout بعد 10 ثواني
            setTimeout(() => resolve(null), 10000);
        });
    }

    // ─── طلب الميكروفون ───
    async requestMicrophone(): Promise<boolean> {
        try {
            this.myStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            this.isEnabled = true;
            console.log("✅ Microphone ready");
            return true;
        } catch (err) {
            console.warn("Microphone denied:", err);
            return false;
        }
    }

    // ─── الاتصال بلاعب ───
    callPeer(peerId: string, username: string, role: string) {
        if (!this.peer || !this.myStream || !peerId || peerId === this.myPeerId) return;
        if (this.connections.has(peerId)) return;

        console.log(`📞 Calling ${username} (${peerId})`);
        const call = this.peer.call(peerId, this.myStream);

        const conn: PeerConnection = { peerId, call, username, role };
        this.connections.set(peerId, conn);

        call.on("stream", (remoteStream: MediaStream) => {
                conn.stream = remoteStream;
                conn.audio  = this.createAudio(remoteStream, false); // remote = نسمعه
                this.applyVolumeRules(peerId);
                if (this.onPeerJoined) this.onPeerJoined(username);
            });

        call.on("close", () => {
            this.removePeer(peerId);
            if (this.onPeerLeft) this.onPeerLeft(username);
        });

        call.on("error", () => this.removePeer(peerId));
    }

    // ─── الرد على اتصال ───
    private answerCall(call: any) {
        if (!this.myStream) { call.close(); return; }

        call.answer(this.myStream);
        const conn: PeerConnection = { peerId: call.peer, call };
        this.connections.set(call.peer, conn);

        call.on("stream", (remoteStream: MediaStream) => {
            conn.stream = remoteStream;
            conn.audio  = this.createAudio(remoteStream, false); // remote = نسمعه
            this.applyVolumeRules(call.peer);
        });

        call.on("close", () => this.removePeer(call.peer));
        call.on("error", () => this.removePeer(call.peer));
    }

    // ─── إنشاء audio element ───
    private createAudio(stream: MediaStream, isLocal = false): HTMLAudioElement {
        const audio     = document.createElement("audio");
        audio.srcObject = stream;
        audio.autoplay  = true;
        audio.muted     = isLocal; // ← منع سماع الصوت الخاص
        audio.style.display = "none";
        document.body.appendChild(audio);
        return audio;
    }

    // ─── تحديث بيانات لاعب ───
    updatePeer(peerId: string, username: string, role: string) {
        const conn = this.connections.get(peerId);
        if (conn) {
            conn.username = username;
            conn.role     = role;
            this.applyVolumeRules(peerId);
        }
    }

    // ─── قطع اتصال لاعب ───
    private removePeer(peerId: string) {
        const conn = this.connections.get(peerId);
        if (conn) {
            conn.call?.close();
            conn.audio?.remove();
            this.connections.delete(peerId);
        }
    }

    // ─── قطع كل الاتصالات ───
    disconnectAll() {
        this.connections.forEach((_, peerId) => this.removePeer(peerId));
        this.connections.clear();
    }

    // ─── تعيين الـ phase ───
    setPhase(phase: string, myRole: string, myAlive: boolean) {
        this.currentPhase = phase;
        this.myRole       = myRole;
        this.myAlive      = myAlive;
        // طبّق قواعد الصوت على كل الاتصالات
        this.connections.forEach((_, peerId) => this.applyVolumeRules(peerId));
    }

    // ─── قواعد الصوت حسب الـ phase ───
    private canHear(peerRole: string): boolean {
        const phase = this.currentPhase;

        // النهار والتصويت والـ review: الكل يسمع بعض
        if (phase === "DAY" || phase === "VOTING" || phase === "NIGHT_REVIEW") return true;

        // الميت: يسمع الكل دائماً
        if (!this.myAlive) return true;

        // الليل: بس المافيا يسمعوا بعض
        if (phase === "NIGHT") {
            return this.myRole === "MAFIA" && peerRole === "MAFIA";
        }

        return true;
    }

    private applyVolumeRules(peerId: string) {
        const conn = this.connections.get(peerId);
        if (!conn?.audio) return;
        const canHear    = this.canHear(conn.role || "CITIZEN");
        conn.audio.volume = canHear ? 1 : 0;
    }

    // ─── mute/unmute الميكروفون ───
    toggleMute(): boolean {
        this.isMuted = !this.isMuted;
        if (this.myStream) {
            this.myStream.getAudioTracks().forEach(t => { t.enabled = !this.isMuted; });
        }
        if (this.onMuteChange) this.onMuteChange(this.isMuted);
        return this.isMuted;
    }

    getMuted()   { return this.isMuted;   }
    getPeerId()  { return this.myPeerId;  }
    isReady()    { return !!this.peer && !!this.myStream; }

    // ─── تنظيف كامل ───
    destroy() {
        this.disconnectAll();
        this.myStream?.getTracks().forEach(t => t.stop());
        this.peer?.destroy();
        this.peer     = null;
        this.myStream = null;
        this.myPeerId = null;
        this.isEnabled= false;
    }
}

export const voiceManager = new VoiceManagerClass();