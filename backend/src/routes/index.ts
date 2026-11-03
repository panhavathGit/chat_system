import { Router } from "express";
import { healthRoutes } from "./health.routes.js";

export const apiRouter = Router();

apiRouter.use("/health", healthRoutes);
