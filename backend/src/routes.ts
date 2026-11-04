import { Router } from "express";
import { healthRoutes } from "@modules/health/index.js";

// Mount each module's router here under /api.
export const apiRouter = Router();

apiRouter.use("/health", healthRoutes);
