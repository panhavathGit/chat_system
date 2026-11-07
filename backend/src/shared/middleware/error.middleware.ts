import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@config/database.js';
import { logger } from '@config/logger.js';
import { AppError, ConflictError, NotFoundError } from '@shared/errors/AppError.js';

export const notFoundHandler: RequestHandler = (req) => {
  throw new NotFoundError(`Route ${req.method} ${req.path} not found`);
};

const toAppError = (err: unknown): AppError | null => {
  if (err instanceof AppError) return err;
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return new ConflictError('Resource already exists', err.meta);
    if (err.code === 'P2025') return new NotFoundError('Resource not found');
  }
  return null;
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const appError = toAppError(err);

  if (!appError) {
    logger.error({ err, method: req.method, path: req.path }, 'Unhandled error');
    res.status(500).json({
      status: 'error',
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Something went wrong' },
    });
    return;
  }

  res.status(appError.statusCode).json({
    status: 'error',
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details !== undefined && { details: appError.details }),
    },
  });
};
