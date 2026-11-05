import { createServer } from "node:http";
import { app } from "./app.js";
import { prisma } from "@config/database.js";
import { env } from "@config/env.js";
import { logger } from "@config/logger.js";
import { redis } from "@config/redis.js";
import { attachWebSocketServer } from "./websocket/websocket.server.js";

const server = createServer(app);
const wss = attachWebSocketServer(server);

server.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "API listening (ws at /ws)");
});

async function shutdown() {
  wss.close();
  server.close();
  await Promise.allSettled([prisma.$disconnect(), redis.quit()]);
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
