import { Router } from "express";
import { HealthController } from "./health.controller.js";
import { HealthRepository } from "./health.repository.js";
import { HealthService } from "./health.service.js";

const controller = new HealthController(new HealthService(new HealthRepository()));

export const healthRoutes = Router();

healthRoutes.get("/", controller.get);
