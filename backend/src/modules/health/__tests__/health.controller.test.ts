import { fromPartial } from "@total-typescript/shoehorn";
import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { HealthController } from "../health.controller.js";
import type { HealthService } from "../health.service.js";

function run(status: "ok" | "degraded") {
  const data = { status, database: "up", redis: status === "ok" ? "up" : "down" } as const;
  const service = fromPartial<HealthService>({ check: vi.fn().mockResolvedValue(data) });
  const json = vi.fn();
  const res = fromPartial<Response>({ status: vi.fn().mockReturnValue({ json }) });
  return new HealthController(service).get(fromPartial<Request>({}), res).then(() => ({ res, json, data }));
}

describe("HealthController", () => {
  it("returns 200 with a success envelope when healthy", async () => {
    const { res, json, data } = await run("ok");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ status: "success", data });
  });

  it("returns 503 when degraded", async () => {
    const { res } = await run("degraded");
    expect(res.status).toHaveBeenCalledWith(503);
  });
});
