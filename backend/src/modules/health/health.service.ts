import type { HealthRepository } from "./health.repository.js";
import type { Check, HealthStatus } from "./health.types.js";

const CHECK_TIMEOUT_MS = 2_000;

// ioredis queues commands forever while disconnected, so an unreachable dependency must time out to report "down".
const toCheck = (ping: Promise<void>): Promise<Check> => {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("health check timed out")), CHECK_TIMEOUT_MS);
  });
  return Promise.race([ping, timeout])
    .then(
      (): Check => "up",
      (): Check => "down",
    )
    .finally(() => clearTimeout(timer));
};

export class HealthService {
  constructor(private readonly repository: HealthRepository) {}

  async check(): Promise<HealthStatus> {
    const [database, redis] = await Promise.all([
      toCheck(this.repository.pingDatabase()),
      toCheck(this.repository.pingRedis()),
    ]);
    return { status: database === "up" && redis === "up" ? "ok" : "degraded", database, redis };
  }
}
