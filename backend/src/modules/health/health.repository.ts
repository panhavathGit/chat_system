import { prisma } from "@config/database.js";
import { redis } from "@config/redis.js";

export class HealthRepository {
  async pingDatabase(): Promise<void> {
    await prisma.$queryRaw`SELECT 1`;
  }

  async pingRedis(): Promise<void> {
    await redis.ping();
  }
}
