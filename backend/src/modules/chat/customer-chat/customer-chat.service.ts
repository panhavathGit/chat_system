import type { ConversationRepository } from '../shared/conversation.repository.js';
import type { MessageService } from '../shared/message.service.js';

export class CustomerChatService {
  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly messageService: MessageService,
  ) {}

  // * Opening the chat screen creates the customer's one permanent thread
  getConversation(user: Express.User) {
    return this.conversationRepository.upsertForCustomer(user.id);
  }

  async listMessages(user: Express.User, { before, size }: any) {
    const conversation = await this.conversationRepository.findByCustomer(user.id);
    if (!conversation) return { items: [], meta: { size, nextCursor: null } };
    const { items, nextCursor } = await this.conversationRepository.listMessages(conversation.id, { before, size });
    return { items, meta: { size, nextCursor } };
  }

  sendMessage(user: Express.User, input: any) {
    return this.messageService.send(user, (tx) => this.conversationRepository.upsertForCustomer(user.id, tx), input);
  }
}
