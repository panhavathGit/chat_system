import type { Request, Response } from 'express';
import { getAuthUser } from '@shared/middleware/auth.middleware.js';
import type { StaffChatService } from './staff-chat.service.js';

// * Handlers are arrow-function properties so `this` stays bound when passed to the router
export class StaffChatController {
  constructor(private readonly staffChatService: StaffChatService) {}

  listConversations = async (req: Request, res: Response) => {
    const { items, meta } = await this.staffChatService.listConversations(req.query);
    res.status(200).json({ status: 'success', data: items, meta });
  };

  getConversation = async (req: Request, res: Response) => {
    const conversation = await this.staffChatService.getConversation(req.params.id as string);
    res.status(200).json({ status: 'success', data: conversation });
  };

  listMessages = async (req: Request, res: Response) => {
    const { items, meta } = await this.staffChatService.listMessages(req.params.id as string, req.query);
    res.status(200).json({ status: 'success', data: items, meta });
  };

  sendMessage = async (req: Request, res: Response) => {
    const message = await this.staffChatService.sendMessage(getAuthUser(req), req.params.id as string, req.body);
    res.status(201).json({ status: 'success', data: message });
  };
}
