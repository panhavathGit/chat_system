import type { Request, Response } from 'express';
import { getAuthUser } from '@shared/middleware/auth.middleware.js';
import type { AuthService } from './auth.service.js';

// * Handlers are arrow-function properties so `this` stays bound when passed to the router
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  createCustomerSession = async (req: Request, res: Response) => {
    const session = await this.authService.exchangeCustomerToken(req.body.losToken);
    res.status(201).json({ status: 'success', data: session });
  };

  createStaffSession = async (req: Request, res: Response) => {
    const session = await this.authService.exchangeHandoff(req.body.handoffToken);
    res.status(201).json({ status: 'success', data: session });
  };

  me = (req: Request, res: Response) => {
    res.status(200).json({ status: 'success', data: getAuthUser(req) });
  };
}
