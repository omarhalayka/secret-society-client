import { io, Socket } from "socket.io-client";

class SocketService {
    public socket: Socket;
    public role: string | null = null;
    public roomId: string | null = null;
    public isAdmin: boolean = false;

    // أحداث معلقة تُعرض لما GameScene تفتح
    public pendingEvents: Array<{ msg: string; color: string }> = [];

    constructor() {
        this.socket = io("https://secret-society-server.onrender.com");

        this.socket.on("game_started", (data: any) => {
            console.log("Game started:", data);
            this.role = data.role;
            this.roomId = data.roomId;

            if (data.role === "ADMIN") {
                this.isAdmin = true;
                console.log("✅ Admin detected from role");
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

    public reset() {
        this.role = null;
        this.roomId = null;
        this.isAdmin = false;
        this.pendingEvents = [];
    }
}

export const socketService = new SocketService();