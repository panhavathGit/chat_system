import { NotFoundError } from '@shared/errors/AppError.js';
import type { ConversationRepository } from '../shared/conversation.repository.js';
import type { MessageService } from '../shared/message.service.js';

// * Every staff member sees every conversation and may reply to any of them; there is no assignment
export class StaffChatService {
  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly messageService: MessageService,
  ) {}

  async listConversations({ page, size }: any) {
    const { items, total } = await this.conversationRepository.listForStaff({ skip: (page - 1) * size, take: size });
    return {
      items: items.map(({ messages, ...conversation }) => ({ ...conversation, lastMessage: messages[0] ?? null })),
      meta: { total, page, size, totalPages: Math.ceil(total / size) },
    };
  }

  async getConversation(conversationId: string) {
    const conversation = await this.conversationRepository.findForStaff(conversationId);
    if (!conversation) throw new NotFoundError('Conversation not found');
    const { messages, ...rest } = conversation;
    return { ...rest, lastMessage: messages[0] ?? null };
  }

  async listMessages(conversationId: string, { before, size }: any) {
    const conversation = await this.conversationRepository.findById(conversationId);
    if (!conversation) throw new NotFoundError('Conversation not found');
    const { items, nextCursor } = await this.conversationRepository.listMessages(conversationId, { before, size });
    return { items, meta: { size, nextCursor } };
  }

  sendMessage(user: Express.User, conversationId: string, input: any) {
    return this.messageService.send(
      user,
      async (tx) => {
        const conversation = await this.conversationRepository.findById(conversationId, tx);
        if (!conversation) throw new NotFoundError('Conversation not found');
        return conversation;
      },
      input,
    );
  }
}
