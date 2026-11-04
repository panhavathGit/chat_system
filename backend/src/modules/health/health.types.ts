export type Check = "up" | "down";

export type HealthStatus = {
  status: "ok" | "degraded";
  database: Check;
  redis: Check;
};
