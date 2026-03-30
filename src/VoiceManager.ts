declare const Peer: any;

interface PeerConnection {
    peerId: string;
    call?: any;
    stream?: MediaStream;
    audio?: HTMLAudioElement;
    role?: string;
    username?: string;
}

class VoiceManagerClass {
    private peer: any = null;
    private myStream: MediaStream | null = null;
    private myPeerId: string | null = null;
    private connections: Map<string, PeerConnection> = new Map();
    private isMuted = false;
    private isEnabled = false;
    private currentPhase = "DAY";
    private myRole = "CITIZEN";
    private myAlive = true;
    private keepaliveTimer: any = null;

    public onPeerIdReady: ((id: string) => void) | null = null;
    public onMuteChange: ((muted: boolean) => void) | null = null;
    public onPeerJoined: ((username: string) => void) | null = null;
    public onPeerLeft: ((username: string) => void) | null = null;

    hasMicrophone() {
        return !!this.myStream && this.myStream.getAudioTracks().some((track) => track.readyState === "live");
    }

    private startKeepalive() {
        if (this.keepaliveTimer) clearInterval(this.keepaliveTimer);
        this.keepaliveTimer = setInterval(() => {
            if (!this.peer || this.peer.destroyed) {
                clearInterval(this.keepaliveTimer);
                return;
            }
            if (this.peer.disconnected) {
                console.log("[Voice] Keepalive reconnect");
                this.peer.reconnect();
            }
            this.connections.forEach((conn, peerId) => {
                if (conn.call?.peerConnection) {
                    const state = conn.call.peerConnection.connectionState;
                    if (state === "failed" || state === "closed") {
                        console.warn(`[Voice] Reconnecting to ${conn.username || peerId}`);
                        this.removePeer(peerId);
                        if (conn.username && conn.role) {
                            setTimeout(() => this.callPeer(peerId, conn.username!, conn.role!, 2), 1000);
                        }
                    }
                }
            });
        }, 20000);
    }

    async init(): Promise<string | null> {
        if (this.peer) return this.myPeerId;
        if (typeof Peer === "undefined") {
            console.error("[Voice] PeerJS not loaded");
            return null;
        }

        return new Promise((resolve) => {
            this.peer = new Peer({
                host: "secret-society-voice.onrender.com",
                port: 443,
                path: "/voice",
                secure: true,
                config: {
                    iceServers: [
                        { urls: "stun:stun.l.google.com:19302" },
                        { urls: "stun:stun1.l.google.com:19302" },
                        { urls: "stun:stun2.l.google.com:19302" },
                        { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
                        { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
                    ],
                    iceTransportPolicy: "all",
                },
            });

            this.peer.on("open", (id: string) => {
                this.myPeerId = id;
                console.log("[Voice] Peer ready:", id);
                if (this.onPeerIdReady) this.onPeerIdReady(id);
                this.startKeepalive();
                resolve(id);
            });

            this.peer.on("call", (call: any) => this.answerCall(call));
            this.peer.on("disconnected", () => {
                console.warn("[Voice] Peer disconnected, reconnecting");
                this.peer?.reconnect();
            });
            this.peer.on("error", (err: any) => {
                console.error("[Voice] Peer error:", err?.type || err);
                if (err?.type === "disconnected" || err?.type === "network") {
                    setTimeout(() => this.peer?.reconnect(), 2000);
                }
                resolve(null);
            });

            setTimeout(() => resolve(null), 10000);
        });
    }

    async requestMicrophone(): Promise<boolean> {
        if (this.hasMicrophone()) {
            console.log("[Voice] Reusing existing microphone stream");
            return true;
        }
        if (!navigator.mediaDevices?.getUserMedia) {
            console.error("[Voice] getUserMedia is not available");
            return false;
        }

        try {
            this.myStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 16000,
                    channelCount: 1,
                },
                video: false,
            });
            this.myStream.getAudioTracks().forEach((track) => {
                track.enabled = false;
            });
            this.isMuted = true;
            this.isEnabled = true;
            console.log("[Voice] Microphone initialized");
            return true;
        } catch (err) {
            console.warn("[Voice] Microphone request failed:", err);
            return false;
        }
    }

    callPeer(peerId: string, username: string, role: string, retries = 3) {
        if (!this.peer || !this.myStream || !peerId || peerId === this.myPeerId) return;
        if (this.connections.has(peerId)) return;

        console.log(`[Voice] Calling ${username} (${peerId})`);
        const call = this.peer.call(peerId, this.myStream);
        const conn: PeerConnection = { peerId, call, username, role };
        this.connections.set(peerId, conn);

        let gotStream = false;

        call.on("stream", (remoteStream: MediaStream) => {
            gotStream = true;
            conn.stream = remoteStream;
            conn.audio = this.createAudio(remoteStream, false);
            this.applyVolumeRules(peerId);
            if (this.onPeerJoined) this.onPeerJoined(username);
            console.log(`[Voice] Remote stream received from ${username} (${peerId})`);
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

        setTimeout(() => {
            if (!gotStream && this.connections.has(peerId)) {
                console.warn(`[Voice] No stream from ${username}, retrying`);
                this.removePeer(peerId);
                if (retries > 0) this.callPeer(peerId, username, role, retries - 1);
            }
        }, 8000);
    }

    private monitorConnection(call: any, peerId: string, username: string, role: string) {
        const pc: RTCPeerConnection = call.peerConnection;
        if (!pc) return;

        pc.oniceconnectionstatechange = () => {
            const state = pc.iceConnectionState;
            console.log(`[Voice] ICE ${username}: ${state}`);
            if (state === "failed" || state === "disconnected") {
                console.warn(`[Voice] Connection lost with ${username}, reconnecting`);
                this.removePeer(peerId);
                setTimeout(() => {
                    if (this.peer && this.myStream) this.callPeer(peerId, username, role, 3);
                }, 2000);
            }
        };
    }

    private answerCall(call: any) {
        if (!this.myStream) {
            call.close();
            return;
        }
        if (this.connections.has(call.peer)) {
            console.log(`[Voice] Replacing existing connection for ${call.peer}`);
            this.removePeer(call.peer);
        }

        call.answer(this.myStream);
        const conn: PeerConnection = { peerId: call.peer, call };
        this.connections.set(call.peer, conn);

        call.on("stream", (remoteStream: MediaStream) => {
            conn.stream = remoteStream;
            conn.audio = this.createAudio(remoteStream, false);
            this.applyVolumeRules(call.peer);
        });

        call.on("close", () => this.removePeer(call.peer));
        call.on("error", () => this.removePeer(call.peer));
    }

    private createAudio(stream: MediaStream, isLocal = false): HTMLAudioElement {
        const audio = document.createElement("audio");
        audio.srcObject = stream;
        audio.autoplay = true;
        audio.muted = isLocal;
        (audio as any).playsInline = true;
        audio.setAttribute("playsinline", "");
        audio.style.display = "none";
        document.body.appendChild(audio);
        audio.play().catch((error) => console.warn("[Voice] Audio autoplay blocked:", error));
        return audio;
    }

    updatePeer(peerId: string, username: string, role: string) {
        const conn = this.connections.get(peerId);
        if (conn) {
            conn.username = username;
            conn.role = role;
            this.applyVolumeRules(peerId);
        }
    }

    private removePeer(peerId: string) {
        const conn = this.connections.get(peerId);
        if (conn) {
            console.log(`[Voice] Removing peer ${peerId}`);
            conn.call?.close();
            conn.audio?.remove();
            this.connections.delete(peerId);
        }
    }

    disconnectAll() {
        console.log("[Voice] Disconnecting all peer connections");
        this.connections.forEach((_, peerId) => this.removePeer(peerId));
        this.connections.clear();
    }

    setPhase(phase: string, myRole: string, myAlive: boolean) {
        this.currentPhase = phase;
        this.myRole = myRole;
        this.myAlive = myAlive;
        this.connections.forEach((_, peerId) => this.applyVolumeRules(peerId));
    }

    private canHear(_peerRole: string): boolean {
        return true;
    }

    private applyVolumeRules(peerId: string) {
        const conn = this.connections.get(peerId);
        if (!conn?.audio) return;
        const canHear = this.canHear(conn.role || "CITIZEN");
        conn.audio.volume = canHear ? 1 : 0;
    }

    toggleMute(): boolean {
        this.isMuted = !this.isMuted;
        if (this.myStream) {
            this.myStream.getAudioTracks().forEach((track) => {
                track.enabled = !this.isMuted;
            });
        }
        console.log(`[Voice] Microphone ${this.isMuted ? "muted" : "unmuted"}`);
        if (this.onMuteChange) this.onMuteChange(this.isMuted);
        return this.isMuted;
    }

    getMuted() { return this.isMuted; }
    getPeerId() { return this.myPeerId; }
    isReady() { return !!this.peer && !!this.myStream; }

    destroy() {
        if (this.keepaliveTimer) clearInterval(this.keepaliveTimer);
        this.disconnectAll();
        this.myStream?.getTracks().forEach((track) => track.stop());
        this.peer?.destroy();
        this.peer = null;
        this.myStream = null;
        this.myPeerId = null;
        this.isEnabled = false;
    }
}

export const voiceManager = new VoiceManagerClass();
