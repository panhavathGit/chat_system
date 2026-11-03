import { prisma } from "../../prisma/client.js";
import { redis } from "../lib/redis.js";

export const healthRepository = {
  async pingDatabase(): Promise<void> {
    await prisma.$queryRaw`SELECT 1`;
  },
  async pingRedis(): Promise<void> {
    await redis.ping();
  },
};
