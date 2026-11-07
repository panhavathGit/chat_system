import type { Server, Socket } from 'socket.io';
import type { AuthService } from '@modules/auth/index.js';
import { logger } from '@config/logger.js';
import { rooms } from '../shared/chat-events.js';
import type { ConversationRepository } from '../shared/conversation.repository.js';

const userOf = (socket: Socket) => socket.data.user as Express.User;

export class ChatSocketHandlers {
  constructor(
    private readonly authService: AuthService,
    private readonly conversationRepository: ConversationRepository,
  ) {}

  register(io: Server) {
    io.use(this.authenticate);
    io.on('connection', this.onConnection);
  }

  // * Same as REST: a chat session token of either kind; LOS tokens are only accepted by /auth/session
  // * The Authorization header is a fallback for clients that can't set auth (e.g. Postman); browsers use auth.token
  private authenticate = async (socket: Socket, next: (err?: Error) => void) => {
    const header = socket.handshake.headers.authorization;
    const token: unknown = socket.handshake.auth?.token ?? (header?.startsWith('Bearer ') ? header.slice(7) : undefined);
    if (typeof token !== 'string' || !token) return next(new Error('Missing auth.token'));
    try {
      socket.data.user = await this.authService
        .verifySession(token, 'staff')
        .catch(() => this.authService.verifySession(token, 'customer'));
      next();
    } catch (err) {
      logger.debug({ err }, 'Socket handshake rejected');
      next(new Error('Invalid or expired token'));
    }
  };

  private onConnection = (socket: Socket) => {
    const user = userOf(socket);
    void socket.join(rooms.user(user.id));
    if (user.kind === 'staff') void socket.join(rooms.staff);

    socket.on('typing', (payload: unknown) => {
      this.relayTyping(socket, payload).catch((err: unknown) =>
        logger.warn({ err, userId: user.id }, 'Failed to relay typing event'),
      );
    });
  };

  // * Typing is the only client → server event; every write goes through REST
  private async relayTyping(socket: Socket, payload: unknown) {
    const user = userOf(socket);
    const isTyping = (payload as { isTyping?: unknown } | null)?.isTyping !== false;

    if (user.kind === 'customer') {
      const conversation = await this.conversationRepository.findByCustomer(user.id);
      if (!conversation) return;
      socket.to(rooms.staff).emit('typing', { conversationId: conversation.id, user: this.summary(user), isTyping });
      return;
    }

    const conversationId = (payload as { conversationId?: unknown } | null)?.conversationId;
    if (typeof conversationId !== 'string') return;
    const conversation = await this.conversationRepository.findById(conversationId).catch(() => null);
    if (!conversation) return;
    socket
      .to([rooms.user(conversation.customerId), rooms.staff])
      .emit('typing', { conversationId, user: this.summary(user), isTyping });
  }

  private summary(user: Express.User) {
    return { id: user.id, username: user.username, kind: user.kind };
  }
}
