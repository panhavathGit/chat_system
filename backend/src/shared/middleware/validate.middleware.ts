import type { RequestHandler } from 'express';
import { z } from 'zod';
import { BadRequestError } from '@shared/errors/AppError.js';

interface ValidationSchemas {
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
}

export const validate =
  (schemas: ValidationSchemas): RequestHandler =>
  (req, _res, next) => {
    for (const key of ['body', 'query', 'params'] as const) {
      const schema = schemas[key];
      if (!schema) continue;

      const result = schema.safeParse(req[key]);
      if (!result.success) {
        throw new BadRequestError(`Invalid request ${key}`, z.flattenError(result.error).fieldErrors);
      }

      // * Express 5 exposes req.query as a getter, so it can't be reassigned directly
      Object.defineProperty(req, key, { value: result.data, writable: true, enumerable: true });
    }

    next();
  };
