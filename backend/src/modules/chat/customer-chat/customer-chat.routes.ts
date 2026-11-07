import { Router } from 'express';
import { prisma } from '@config/database.js';
import { env } from '@config/env.js';
import { io } from '@config/socket.js';
import { authenticateCustomer } from '@modules/auth/index.js';
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
import { CustomerChatController } from './customer-chat.controller.js';
import { CustomerChatService } from './customer-chat.service.js';

const conversationRepository = new ConversationRepository(prisma);
const attachmentService = new AttachmentService(new AttachmentRepository(prisma), new LocalDiskDriver(env.UPLOAD_DIR));
const messageService = new MessageService(conversationRepository, attachmentService, new SocketChatEventPublisher(io));
const customerChatController = new CustomerChatController(new CustomerChatService(conversationRepository, messageService));
const attachmentController = new AttachmentController(attachmentService);

export const customerChatRouter = Router();

customerChatRouter.use(authenticateCustomer);

customerChatRouter.get('/conversation', customerChatController.getConversation);
customerChatRouter.get(
  '/conversation/messages',
  validate({ query: messagesQuerySchema }),
  customerChatController.listMessages,
);
customerChatRouter.post(
  '/conversation/messages',
  validate({ body: sendMessageSchema }),
  customerChatController.sendMessage,
);

// * uploadSingle runs before validate so multipart text fields (durationSec) are parsed into req.body first
customerChatRouter.post(
  '/attachments',
  uploadSingle('file'),
  validate({ body: uploadBodySchema }),
  attachmentController.upload,
);
customerChatRouter.get('/attachments/:id', validate({ params: idParamSchema }), attachmentController.download);
