import type { Server } from 'socket.io';
import type { ConversationRepository } from './conversation.repository.js';

export type MessageView = Awaited<ReturnType<ConversationRepository['createMessage']>>;

export const rooms = {
  staff: 'staff',
  user: (chatUserId: string) => `user:${chatUserId}`,
} as const;

// * Services announce what happened; how it reaches clients (Socket.io today) stays out of the business rules
export interface ChatEventPublisher {
  messageCreated(customerId: string, message: MessageView): void;
}

export class SocketChatEventPublisher implements ChatEventPublisher {
  constructor(private readonly io: Server) {}

  // * The customer's own room plus every staff member, since all staff read and reply to every conversation
  messageCreated(customerId: string, message: MessageView) {
    this.io.to([rooms.user(customerId), rooms.staff]).emit('message:new', message);
  }
}
