import type { Request, Response } from "express";
import type { HealthService } from "./health.service.js";

export class HealthController {
  constructor(private readonly service: HealthService) {}

  get = async (_req: Request, res: Response) => {
    const data = await this.service.check();
    res.status(data.status === "ok" ? 200 : 503).json({ status: "success", data });
  };
}
