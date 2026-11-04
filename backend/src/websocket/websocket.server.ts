import type { Server } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { createRedis } from "@config/redis.js";

// Every API instance publishes chat events to this channel and relays what it
// receives to its own sockets, so the gateway scales past one process.
export const EVENTS_CHANNEL = "chat:events";

export function attachWebSocketServer(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });
  const subscriber = createRedis();

  void subscriber.subscribe(EVENTS_CHANNEL);
  subscriber.on("message", (_channel, payload) => {
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(payload);
    }
  });

  const alive = new WeakSet<WebSocket>();
  wss.on("connection", (socket) => {
    alive.add(socket);
    socket.on("pong", () => alive.add(socket));
  });

  // Drop connections that missed the previous heartbeat.
  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      if (!alive.has(socket)) {
        socket.terminate();
        continue;
      }
      alive.delete(socket);
      socket.ping();
    }
  }, 30_000);

  wss.on("close", () => {
    clearInterval(heartbeat);
    subscriber.disconnect();
  });

  return wss;
}
