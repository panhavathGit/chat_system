import type { Request, RequestHandler } from 'express';
import { UnauthorizedError } from '@shared/errors/AppError.js';
import type { AuthService } from '@modules/auth/index.js';

export const readBearerToken = (header: string | undefined): string => {
  const [scheme, token] = header?.split(' ') ?? [];
  if (scheme !== 'Bearer' || !token) throw new UnauthorizedError('Invalid or missing access token');
  return token;
};

// * Built in the auth composition root (auth.routes.ts) so the middleware shares its AuthService instance
export const createAuthMiddleware = (authService: AuthService) => {
  const authenticateCustomer: RequestHandler = async (req, _res, next) => {
    req.user = await authService.verifySession(readBearerToken(req.headers.authorization), 'customer');
    next();
  };

  const authenticateStaff: RequestHandler = async (req, _res, next) => {
    req.user = await authService.verifySession(readBearerToken(req.headers.authorization), 'staff');
    next();
  };

  return { authenticateCustomer, authenticateStaff };
};

export const getAuthUser = (req: Request): Express.User => {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
};
