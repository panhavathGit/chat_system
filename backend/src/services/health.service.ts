import { healthRepository } from "../repositories/health.repository.js";

type Check = "up" | "down";

export const healthService = {
  async check() {
    const [database, cache] = await Promise.all([
      healthRepository.pingDatabase().then(
        () => "up" as Check,
        () => "down" as Check,
      ),
      healthRepository.pingRedis().then(
        () => "up" as Check,
        () => "down" as Check,
      ),
    ]);
    return { status: database === "up" && cache === "up" ? "ok" : "degraded", database, redis: cache };
  },
};
