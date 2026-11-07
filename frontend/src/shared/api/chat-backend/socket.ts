import { io, type Socket } from "socket.io-client";
import { CHAT_API } from "@/shared/config";

/** Lazy Socket.io singleton. Created on first access, auth token set before connect(). */
let _socket: Socket | null = null;

function getSocket(): Socket {
  if (!_socket) {
    _socket = io(CHAT_API, {
      autoConnect: false,
      auth: { token: "" },
    });
  }
  return _socket;
}

export const chatSocket = {
  /** Connect (or reconnect) with a fresh session token. */
  connect(token: string) {
    const s = getSocket();
    s.auth = { token };
    if (s.connected) s.disconnect();
    s.connect();
  },

  disconnect() {
    _socket?.disconnect();
  },

  on<T>(event: string, handler: (data: T) => void): () => void {
    const s = getSocket();
    s.on(event, handler);
    return () => s.off(event, handler);
  },

  emit(event: string, data?: unknown) {
    getSocket().emit(event, data);
  },

  get connected() {
    return _socket?.connected ?? false;
  },
};
