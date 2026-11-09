import type { DbClient } from '@config/database.js';
import type { AttachmentService } from './attachment.service.js';
import type { ChatEventPublisher } from './chat-events.js';
import type { ConversationRepository } from './conversation.repository.js';

// * Sending is the same for both audiences once the conversation is known; only who may send differs
export class MessageService {
  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly attachmentService: AttachmentService,
    private readonly events: ChatEventPublisher,
  ) {}

  // * resolveConversation runs inside the transaction: the customer side creates the thread, the staff side looks it up
  async send(
    user: Express.User,
    resolveConversation: (tx: DbClient) => Promise<{ id: string; customerId: string }>,
    input: any,
  ) {
    const result = await this.conversationRepository.transaction(async (tx) => {
      const conversation = await resolveConversation(tx);

      const duplicate = await this.conversationRepository.findMessageByClientId(user.id, input.clientMessageId, tx);
      if (duplicate) return { message: duplicate, duplicate: true, customerId: conversation.customerId };

      if (input.attachmentId) await this.attachmentService.assertSendable(user.id, input.attachmentId, input.type, tx);
      const message = await this.conversationRepository.createMessage(
        {
          conversationId: conversation.id,
          senderId: user.id,
          type: input.type,
          text: input.text,
          attachmentId: input.attachmentId,
          clientMessageId: input.clientMessageId,
        },
        tx,
      );
      await this.conversationRepository.touch(conversation.id, message.createdAt, tx);
      return { message, duplicate: false, customerId: conversation.customerId };
    });

    // * A retried send returns the original and doesn't notify anyone a second time
    if (!result.duplicate) this.events.messageCreated(result.customerId, result.message);
    return result.message;
  }
}
