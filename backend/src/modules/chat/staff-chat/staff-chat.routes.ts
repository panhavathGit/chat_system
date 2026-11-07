import { Router } from 'express';
import { prisma } from '@config/database.js';
import { env } from '@config/env.js';
import { io } from '@config/socket.js';
import { authenticateStaff } from '@modules/auth/index.js';
import { uploadSingle } from '@shared/middleware/upload.middleware.js';
import { validate } from '@shared/middleware/validate.middleware.js';
import { LocalDiskDriver } from '@shared/storage/local-disk.driver.js';
import { AttachmentController } from '../shared/attachment.controller.js';
import { AttachmentRepository } from '../shared/attachment.repository.js';
import { AttachmentService } from '../shared/attachment.service.js';
import { SocketChatEventPublisher } from '../shared/chat-events.js';
import { idParamSchema, messagesQuerySchema, sendMessageSchema, uploadBodySchema } from '../shared/chat.schema.js';
import { ConversationRepository } from '../shared/conversation.repository.js';
import { MessageService } from '../shared/message.service.js';
import { StaffChatController } from './staff-chat.controller.js';
import { StaffChatService } from './staff-chat.service.js';
import { listConversationsQuerySchema } from './staff-chat.schema.js';

const conversationRepository = new ConversationRepository(prisma);
const attachmentService = new AttachmentService(new AttachmentRepository(prisma), new LocalDiskDriver(env.UPLOAD_DIR));
const messageService = new MessageService(conversationRepository, attachmentService, new SocketChatEventPublisher(io));
const staffChatController = new StaffChatController(new StaffChatService(conversationRepository, messageService));
const attachmentController = new AttachmentController(attachmentService);

export const staffChatRouter = Router();

staffChatRouter.use(authenticateStaff);

const byId = validate({ params: idParamSchema });

staffChatRouter.get(
  '/conversations',
  validate({ query: listConversationsQuerySchema }),
  staffChatController.listConversations,
);
staffChatRouter.get('/conversations/:id', byId, staffChatController.getConversation);
staffChatRouter.get(
  '/conversations/:id/messages',
  validate({ params: idParamSchema, query: messagesQuerySchema }),
  staffChatController.listMessages,
);
staffChatRouter.post(
  '/conversations/:id/messages',
  validate({ params: idParamSchema, body: sendMessageSchema }),
  staffChatController.sendMessage,
);

// * uploadSingle runs before validate so multipart text fields (durationSec) are parsed into req.body first
staffChatRouter.post(
  '/attachments',
  uploadSingle('file'),
  validate({ body: uploadBodySchema }),
  attachmentController.upload,
);
staffChatRouter.get('/attachments/:id', byId, attachmentController.download);
