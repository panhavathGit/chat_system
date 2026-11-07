export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', details?: unknown) {
    super(message, 400, 'BAD_REQUEST', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', details?: unknown) {
    super(message, 401, 'UNAUTHORIZED', details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', details?: unknown) {
    super(message, 403, 'FORBIDDEN', details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found', details?: unknown) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict', details?: unknown) {
    super(message, 409, 'CONFLICT', details);
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = 'Payload too large', details?: unknown) {
    super(message, 413, 'PAYLOAD_TOO_LARGE', details);
  }
}

export class UnsupportedMediaTypeError extends AppError {
  constructor(message = 'Unsupported media type', details?: unknown) {
    super(message, 415, 'UNSUPPORTED_MEDIA_TYPE', details);
  }
}
