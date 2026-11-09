import type { Request, Response } from 'express';
import { getAuthUser } from '@shared/middleware/auth.middleware.js';
import type { AuthService } from './auth.service.js';

// * Handlers are arrow-function properties so `this` stays bound when passed to the router
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  createCustomerSession = async (req: Request, res: Response) => {
    const session = await this.authService.exchangeCustomerToken(req.body.losToken, req.get('user-agent'));
    res.status(201).json({ status: 'success', data: session });
  };

  createStaffSession = async (req: Request, res: Response) => {
    const session = await this.authService.exchangeHandoff(req.body.handoffToken, req.get('user-agent'));
    res.status(201).json({ status: 'success', data: session });
  };

  refreshCustomerSession = async (req: Request, res: Response) => {
    const session = await this.authService.refresh(req.body.refreshToken, 'customer', req.get('user-agent'));
    res.status(200).json({ status: 'success', data: session });
  };

  refreshStaffSession = async (req: Request, res: Response) => {
    const session = await this.authService.refresh(req.body.refreshToken, 'staff', req.get('user-agent'));
    res.status(200).json({ status: 'success', data: session });
  };

  logoutCustomer = async (req: Request, res: Response) => {
    await this.authService.logout(req.body.refreshToken, 'customer');
    res.status(200).json({ status: 'success', data: null });
  };

  logoutStaff = async (req: Request, res: Response) => {
    await this.authService.logout(req.body.refreshToken, 'staff');
    res.status(200).json({ status: 'success', data: null });
  };

  me = (req: Request, res: Response) => {
    res.status(200).json({ status: 'success', data: getAuthUser(req) });
  };
}
