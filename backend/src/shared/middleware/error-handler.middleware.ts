import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { logger } from "@config/logger.js";
import { AppError, BadRequestError, ConflictError, NotFoundError } from "@shared/errors/AppError.js";

// Prisma constraint errors are identified by code so services never import Prisma error classes.
function fromPrismaError(err: unknown): AppError | undefined {
  const code = typeof err === "object" && err !== null && "code" in err ? err.code : undefined;
  if (code === "P2002") return new ConflictError("Resource already exists");
  if (code === "P2025") return new NotFoundError("Resource not found");
  return undefined;
}

// Express 5 forwards rejected promises from async handlers here automatically.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const appError =
    err instanceof AppError
      ? err
      : err instanceof ZodError
        ? new BadRequestError("Validation failed", err.issues)
        : fromPrismaError(err);

  if (!appError) {
    logger.error({ err }, "Unhandled error");
    res
      .status(500)
      .json({ status: "error", error: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" } });
    return;
  }

  res.status(appError.status).json({
    status: "error",
    error: { code: appError.code, message: appError.message, details: appError.details },
  });
};
