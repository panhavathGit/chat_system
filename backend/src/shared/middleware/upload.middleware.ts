import type { RequestHandler } from 'express';
import multer from 'multer';
import { env } from '@config/env.js';
import { BadRequestError, PayloadTooLargeError, UnsupportedMediaTypeError } from '@shared/errors/AppError.js';
import { mediaCategoryOf } from '@shared/storage/media-types.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.UPLOAD_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, done) => {
    if (mediaCategoryOf(file.mimetype)) return done(null, true);
    done(new UnsupportedMediaTypeError(`File type ${file.mimetype} is not allowed`));
  },
});

// * Wraps multer so its errors go through errorHandler with our status codes instead of a generic 500
export const uploadSingle =
  (field: string): RequestHandler =>
  (req, res, next) => {
    upload.single(field)(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new PayloadTooLargeError(`File is larger than ${env.UPLOAD_MAX_BYTES} bytes`));
        }
        return next(new BadRequestError(err.message));
      }
      if (err) return next(err);
      if (!req.file) return next(new BadRequestError(`Missing file field "${field}"`));
      next();
    });
  };
