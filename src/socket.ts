import { io, Socket } from "socket.io-client";

const SESSION_KEY = "ss_session";
const PLAYER_ID_KEY = "ss_player_id";

type SavedSession = {
    roomId: string;
    username: string;
    role: string;
    playerId: string | null;
    ts: number;
};

class SocketService {
    public socket: Socket;
    public role: string | null = null;
    public roomId: string | null = null;
    public isAdmin: boolean = false;
    public username: string | null = null;
    public playerId: string | null = null;

    // أحداث معلقة تُعرض لما GameScene تفتح
    public pendingEvents: Array<{ msg: string; color: string }> = [];

    constructor() {
        this.playerId = this.getStoredPlayerId();
        this.socket = io("https://secret-society-server.onrender.com", {
            auth: {
                playerId: this.playerId,
            },
        });

        this.socket.on("player_id", (data: any) => {
            if (typeof data?.playerId === "string" && data.playerId.trim()) {
                this.setPlayerId(data.playerId.trim());
            }
        });

        this.socket.on("game_started", (data: any) => {
            console.log("Game started:", data);
            this.role   = data.role;
            this.roomId = data.roomId;
            if (typeof data?.playerId === "string" && data.playerId.trim()) {
                this.setPlayerId(data.playerId.trim());
            }

            this.isAdmin = data.role === "ADMIN";

            // ─── احفظ الجلسة في localStorage ───
            if (this.roomId && this.username) {
                localStorage.setItem(SESSION_KEY, JSON.stringify({
                    roomId:   this.roomId,
                    username: this.username,
                    role:     this.role,
                    playerId: data?.playerId || this.playerId || null,
                    ts:       Date.now(),
                }));
            } else if (data?.role === "SPECTATOR" || data?.role === "ADMIN") {
                this.clearSession();
            }
        });

        this.socket.on("connect", () => {
            console.log("✅ Connected to server");
        });

        this.socket.on("connect_error", (err) => {
            console.error("❌ Connection error:", err.message);
        });

        this.socket.on("match_found", (data: any) => {
            if (data.roomId) this.roomId = data.roomId;
        });
    }

    // ─── احفظ اسم المستخدم ───
    public saveUsername(name: string) {
        this.username = name;
    }

    private getStoredPlayerId(): string | null {
        try {
            const raw = localStorage.getItem(PLAYER_ID_KEY);
            if (!raw) return null;
            const clean = raw.trim();
            return clean || null;
        } catch {
            return null;
        }
    }

    public setPlayerId(playerId: string | null) {
        this.playerId = playerId;
        try {
            if (playerId) localStorage.setItem(PLAYER_ID_KEY, playerId);
            else localStorage.removeItem(PLAYER_ID_KEY);
        } catch {}

        const auth = (this.socket.auth || {}) as Record<string, any>;
        auth.playerId = playerId;
        this.socket.auth = auth;
    }

    // ─── احضر بيانات الجلسة المحفوظة ───
    public getSavedSession(): SavedSession | null {
        try {
            const raw = localStorage.getItem(SESSION_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw) as Partial<SavedSession>;
            if (!data?.roomId || !data?.username || !data?.role || !data?.ts) {
                localStorage.removeItem(SESSION_KEY);
                return null;
            }
            // الجلسة صالحة بس لو أقل من 4 ساعات
            if (Date.now() - data.ts > 4 * 60 * 60 * 1000) {
                localStorage.removeItem(SESSION_KEY);
                return null;
            }
            return {
                roomId: data.roomId,
                username: data.username,
                role: data.role,
                playerId: typeof data.playerId === "string" ? data.playerId : this.playerId,
                ts: data.ts,
            };
        } catch { return null; }
    }

    // ─── امسح الجلسة المحفوظة ───
    public clearSession() {
        localStorage.removeItem(SESSION_KEY);
    }

    public reset() {
        this.role     = null;
        this.roomId   = null;
        this.isAdmin  = false;
        this.username = null;
        this.pendingEvents = [];
        this.clearSession();
    }
}

export const socketService = new SocketService();
