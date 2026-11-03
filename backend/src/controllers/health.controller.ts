import type { Request, Response } from "express";
import { healthService } from "../services/health.service.js";

export const healthController = {
  async get(_req: Request, res: Response) {
    const result = await healthService.check();
    res.status(result.status === "ok" ? 200 : 503).json(result);
  },
};
