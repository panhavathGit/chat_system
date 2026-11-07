import type { Request, Response } from 'express';
import { getAuthUser } from '@shared/middleware/auth.middleware.js';
import type { CustomerChatService } from './customer-chat.service.js';

// * Handlers are arrow-function properties so `this` stays bound when passed to the router
export class CustomerChatController {
  constructor(private readonly customerChatService: CustomerChatService) {}

  getConversation = async (req: Request, res: Response) => {
    const conversation = await this.customerChatService.getConversation(getAuthUser(req));
    res.status(200).json({ status: 'success', data: conversation });
  };

  listMessages = async (req: Request, res: Response) => {
    const { items, meta } = await this.customerChatService.listMessages(getAuthUser(req), req.query);
    res.status(200).json({ status: 'success', data: items, meta });
  };

  sendMessage = async (req: Request, res: Response) => {
    const message = await this.customerChatService.sendMessage(getAuthUser(req), req.body);
    res.status(201).json({ status: 'success', data: message });
  };
}
