import { Router } from 'express';
import { prisma } from '@config/database.js';
import { losKey } from '@config/los-keys.js';
import { createAuthMiddleware } from '@shared/middleware/auth.middleware.js';
import { validate } from '@shared/middleware/validate.middleware.js';
import { RoleRepository } from '@modules/role/index.js';
import { AuthController } from './auth.controller.js';
import { AuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';
import { customerSessionSchema, refreshTokenSchema, staffSessionSchema } from './auth.schema.js';

const authRepository = new AuthRepository(prisma);
const roleRepository = new RoleRepository(prisma);
// * Exported so other modules' middleware and the Socket.io handshake share this same instance
export const authService = new AuthService(authRepository, roleRepository, losKey);
export const { authenticateCustomer, authenticateStaff } = createAuthMiddleware(authService);
const authController = new AuthController(authService);

// * /auth/session is the only place an LOS token is accepted; everything else needs our session token.
// * /auth/refresh and /auth/logout take the refresh token in the body, not a Bearer header.
export const customerAuthRouter = Router();
customerAuthRouter.post('/session', validate({ body: customerSessionSchema }), authController.createCustomerSession);
customerAuthRouter.post('/refresh', validate({ body: refreshTokenSchema }), authController.refreshCustomerSession);
customerAuthRouter.post('/logout', validate({ body: refreshTokenSchema }), authController.logoutCustomer);
customerAuthRouter.get('/me', authenticateCustomer, authController.me);

export const staffAuthRouter = Router();
staffAuthRouter.post('/session', validate({ body: staffSessionSchema }), authController.createStaffSession);
staffAuthRouter.post('/refresh', validate({ body: refreshTokenSchema }), authController.refreshStaffSession);
staffAuthRouter.post('/logout', validate({ body: refreshTokenSchema }), authController.logoutStaff);
staffAuthRouter.get('/me', authenticateStaff, authController.me);
