import { createServer } from "node:http";
import { prisma } from "../prisma/client.js";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { redis } from "./lib/redis.js";
import { attachWebSocketGateway } from "./ws/gateway.js";

const server = createServer(app);
const wss = attachWebSocketGateway(server);

server.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT} (ws at /ws)`);
});

async function shutdown() {
  wss.close();
  server.close();
  await Promise.allSettled([prisma.$disconnect(), redis.quit()]);
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
