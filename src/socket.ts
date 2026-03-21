import { io, Socket } from "socket.io-client";

const SESSION_KEY = "ss_session";

class SocketService {
    public socket: Socket;
    public role: string | null = null;
    public roomId: string | null = null;
    public isAdmin: boolean = false;
    public username: string | null = null;

    // أحداث معلقة تُعرض لما GameScene تفتح
    public pendingEvents: Array<{ msg: string; color: string }> = [];

    constructor() {
        this.socket = io("https://secret-society-server.onrender.com");

        this.socket.on("game_started", (data: any) => {
            console.log("Game started:", data);
            this.role   = data.role;
            this.roomId = data.roomId;

            if (data.role === "ADMIN") {
                this.isAdmin = true;
            }

            // ─── احفظ الجلسة في localStorage ───
            if (this.roomId && this.username) {
                localStorage.setItem(SESSION_KEY, JSON.stringify({
                    roomId:   this.roomId,
                    username: this.username,
                    role:     this.role,
                    ts:       Date.now(),
                }));
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

    // ─── احضر بيانات الجلسة المحفوظة ───
    public getSavedSession(): { roomId: string; username: string; role: string; ts: number } | null {
        try {
            const raw = localStorage.getItem(SESSION_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            // الجلسة صالحة بس لو أقل من 4 ساعات
            if (Date.now() - data.ts > 4 * 60 * 60 * 1000) {
                localStorage.removeItem(SESSION_KEY);
                return null;
            }
            return data;
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