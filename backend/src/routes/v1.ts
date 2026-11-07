import { Router } from 'express';
import { customerAuthRouter, staffAuthRouter } from '@modules/auth/index.js';
import { customerChatRouter, staffChatRouter } from '@modules/chat/index.js';

// * Mobile app (customers, LOS access token)
export const customerV1Router = Router();
customerV1Router.use('/auth', customerAuthRouter);
customerV1Router.use('/chat', customerChatRouter);

// * chat_web inside los_web (agents and supervisors, chat session token)
export const agentV1Router = Router();
agentV1Router.use('/auth', staffAuthRouter);
agentV1Router.use('/chat', staffChatRouter);
