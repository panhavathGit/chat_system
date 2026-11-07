import { prisma } from '@config/database.js';
import { io } from '@config/socket.js';
import { authService } from '@modules/auth/index.js';
import { ConversationRepository } from '../shared/conversation.repository.js';
import { ChatSocketHandlers } from './chat-socket.handlers.js';

// * The Socket.io composition root, the counterpart of the REST *.routes.ts files
export const registerChatSocket = () => {
  new ChatSocketHandlers(authService, new ConversationRepository(prisma)).register(io);
};
