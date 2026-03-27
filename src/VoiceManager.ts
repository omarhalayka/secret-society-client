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
    private keepaliveTimer: any = null;

    // callbacks
    public onPeerIdReady:  ((id: string) => void) | null = null;
    public onMuteChange:   ((muted: boolean) => void) | null = null;
    public onPeerJoined:   ((username: string) => void) | null = null;
    public onPeerLeft:     ((username: string) => void) | null = null;

    // ─── keepalive لمنع انقطاع الاتصال ───
    private startKeepalive() {
        if (this.keepaliveTimer) clearInterval(this.keepaliveTimer);
        this.keepaliveTimer = setInterval(() => {
            if (!this.peer || this.peer.destroyed) {
                clearInterval(this.keepaliveTimer);
                return;
            }
            // إعادة اتصال لو disconnected
            if (this.peer.disconnected) {
                console.log("🔄 Keepalive: reconnecting...");
                this.peer.reconnect();
            }
            // تحقق من الـ connections وأعد أي connection مقطوع
            this.connections.forEach((conn, peerId) => {
                if (conn.call && conn.call.peerConnection) {
                    const state = conn.call.peerConnection.connectionState;
                    if (state === "failed" || state === "closed") {
                        console.warn(`🔄 Reconnecting to ${conn.username}...`);
                        this.removePeer(peerId);
                        if (conn.username && conn.role) {
                            setTimeout(() => this.callPeer(peerId, conn.username!, conn.role!, 2), 1000);
                        }
                    }
                }
            });
        }, 20000); // كل 20 ثانية
    }

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
                host:   "secret-society-voice.onrender.com",
                port:   443,
                path:   "/voice",
                secure: true,
                config: {
                    iceServers: [
                        { urls: "stun:stun.l.google.com:19302" },
                        { urls: "stun:stun1.l.google.com:19302" },
                        { urls: "stun:stun2.l.google.com:19302" },
                        {
                            urls:       "turn:openrelay.metered.ca:80",
                            username:   "openrelayproject",
                            credential: "openrelayproject",
                        },
                        {
                            urls:       "turn:openrelay.metered.ca:443",
                            username:   "openrelayproject",
                            credential: "openrelayproject",
                        },
                    ],
                    iceTransportPolicy: "all",
                }
            });

            this.peer.on("open", (id: string) => {
                this.myPeerId = id;
                console.log("✅ PeerJS ready:", id);
                if (this.onPeerIdReady) this.onPeerIdReady(id);
                // ─── keepalive: نبعث ping كل 20 ثانية ───
                this.startKeepalive();
                resolve(id);
            });

            this.peer.on("call", (call: any) => {
                this.answerCall(call);
            });

            this.peer.on("disconnected", () => {
                console.warn("⚠ PeerJS disconnected — reconnecting...");
                this.peer?.reconnect();
            });

            this.peer.on("error", (err: any) => {
                console.error("PeerJS error:", err.type);
                // لو disconnected — حاول ترجع
                if (err.type === "disconnected" || err.type === "network") {
                    setTimeout(() => this.peer?.reconnect(), 2000);
                }
                resolve(null);
            });

            // timeout بعد 10 ثواني
            setTimeout(() => resolve(null), 10000);
        });
    }

    // ─── طلب الميكروفون ───
    async requestMicrophone(): Promise<boolean> {
        try {
            this.myStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation:   true,
                    noiseSuppression:   true,
                    autoGainControl:    true,
                    sampleRate:         16000,
                    channelCount:       1,
                },
                video: false
            });
            // ─── ابدأ بـ mute ───
            this.myStream.getAudioTracks().forEach(t => { t.enabled = false; });
            this.isMuted  = true;
            this.isEnabled = true;
            console.log("✅ Microphone ready");
            return true;
        } catch (err) {
            console.warn("Microphone denied:", err);
            return false;
        }
    }

    // ─── الاتصال بلاعب ───
    callPeer(peerId: string, username: string, role: string, retries = 3) {
        if (!this.peer || !this.myStream || !peerId || peerId === this.myPeerId) return;
        if (this.connections.has(peerId)) return;

        console.log(`📞 Calling ${username} (${peerId})`);
        const call = this.peer.call(peerId, this.myStream);
        const conn: PeerConnection = { peerId, call, username, role };
        this.connections.set(peerId, conn);

        let gotStream = false;

        call.on("stream", (remoteStream: MediaStream) => {
            gotStream   = true;
            conn.stream = remoteStream;
            conn.audio  = this.createAudio(remoteStream, false);
            this.applyVolumeRules(peerId);
            if (this.onPeerJoined) this.onPeerJoined(username);

            // ─── مراقبة الاتصال ───
            this.monitorConnection(call, peerId, username, role);
        });

        call.on("close", () => {
            this.removePeer(peerId);
            if (this.onPeerLeft) this.onPeerLeft(username);
        });

        call.on("error", () => {
            this.removePeer(peerId);
            if (retries > 0) setTimeout(() => this.callPeer(peerId, username, role, retries - 1), 2000);
        });

        // لو ما جاء stream خلال 8 ثواني — retry
        setTimeout(() => {
            if (!gotStream && this.connections.has(peerId)) {
                console.warn(`⚠ No stream from ${username}, retrying...`);
                this.removePeer(peerId);
                if (retries > 0) this.callPeer(peerId, username, role, retries - 1);
            }
        }, 8000);
    }

    // ─── مراقبة الاتصال وإعادة الاتصال تلقائياً ───
    private monitorConnection(call: any, peerId: string, username: string, role: string) {
        const pc: RTCPeerConnection = call.peerConnection;
        if (!pc) return;

        pc.oniceconnectionstatechange = () => {
            const state = pc.iceConnectionState;
            console.log(`ICE ${username}: ${state}`);

            if (state === "failed" || state === "disconnected") {
                console.warn(`⚠ Connection lost with ${username}, reconnecting...`);
                this.removePeer(peerId);
                // انتظر ثانيتين وأعد الاتصال
                setTimeout(() => {
                    if (this.peer && this.myStream) {
                        this.callPeer(peerId, username, role, 3);
                    }
                }, 2000);
            }
        };
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
        audio.muted     = isLocal;
        (audio as any).playsInline = true; // مهم على iOS
        audio.setAttribute("playsinline", "");
        audio.style.display = "none";
        document.body.appendChild(audio);
        // تشغيل يدوي عشان iOS يقبله
        audio.play().catch(() => {});
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

    // ─── الصوت مفتوح دائماً — اللاعب يتحكم بنفسه بالـ mute ───
    private canHear(_peerRole: string): boolean {
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
        if (this.keepaliveTimer) clearInterval(this.keepaliveTimer);
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