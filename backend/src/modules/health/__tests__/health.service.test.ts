import { fromPartial } from "@total-typescript/shoehorn";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HealthRepository } from "../health.repository.js";
import { HealthService } from "../health.service.js";

const mockRepo = {
  pingDatabase: vi.fn(),
  pingRedis: vi.fn(),
} satisfies Partial<Record<keyof HealthRepository, unknown>>;

const service = new HealthService(fromPartial<HealthRepository>(mockRepo));

describe("HealthService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reports ok when database and redis are up", async () => {
    mockRepo.pingDatabase.mockResolvedValue(undefined);
    mockRepo.pingRedis.mockResolvedValue(undefined);
    await expect(service.check()).resolves.toEqual({ status: "ok", database: "up", redis: "up" });
  });

  it("reports down when a dependency never responds", async () => {
    vi.useFakeTimers();
    mockRepo.pingDatabase.mockResolvedValue(undefined);
    mockRepo.pingRedis.mockReturnValue(new Promise(() => {}));
    const result = service.check();
    await vi.advanceTimersByTimeAsync(2_000);
    await expect(result).resolves.toEqual({ status: "degraded", database: "up", redis: "down" });
    vi.useRealTimers();
  });

  it("reports degraded when redis is down", async () => {
    mockRepo.pingDatabase.mockResolvedValue(undefined);
    mockRepo.pingRedis.mockRejectedValue(new Error("down"));
    await expect(service.check()).resolves.toEqual({ status: "degraded", database: "up", redis: "down" });
  });
});
