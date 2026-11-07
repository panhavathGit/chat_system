import { WsClient, type WebSocketLike } from "./client";
import { MockSocket, dropMockConnections } from "./mock/socket";

/** True when VITE_TRANSPORT is not "chat-backend". Keeps the mock path working for offline UI work. */
export const isMockTransport = import.meta.env.VITE_TRANSPORT !== "chat-backend";

export const wsClient = new WsClient(() => (isMockTransport ? new MockSocket() : (new WebSocket("") as WebSocketLike)));

/** Only meaningful with the mock transport. */
export const simulateDisconnect = () => dropMockConnections();
