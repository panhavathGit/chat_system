import type { DatabaseClient, DbClient } from '@config/database.js';
import type { MessageType } from '@shared/types/chat-types.js';

const userSummarySelect = { id: true, username: true, type: true } as const;

export const attachmentSummarySelect = {
  id: true,
  mimeType: true,
  sizeBytes: true,
  fileName: true,
  durationSec: true,
} as const;

// * Only these columns ever reach the client; a new column stays private until it is added here
export const messageSelect = {
  id: true,
  conversationId: true,
  type: true,
  text: true,
  clientMessageId: true,
  createdAt: true,
  sender: { select: userSummarySelect },
  attachment: { select: attachmentSummarySelect },
} as const;

export const conversationSelect = {
  id: true,
  customerId: true,
  lastMessageAt: true,
  createdAt: true,
} as const;

// * Staff inbox row: who the customer is and the latest message, so the list needs no second request
export const staffConversationSelect = {
  ...conversationSelect,
  customer: { select: { id: true, losUserId: true, username: true } },
  messages: { orderBy: { seq: 'desc' }, take: 1, select: messageSelect },
} as const;

export class ConversationRepository {
  constructor(private readonly db: DatabaseClient) {}

  transaction<T>(fn: (tx: DbClient) => Promise<T>) {
    return this.db.$transaction(fn);
  }

  findById(id: string, tx: DbClient = this.db) {
    return tx.conversation.findUnique({ where: { id }, select: conversationSelect });
  }

  findByCustomer(customerId: string) {
    return this.db.conversation.findUnique({ where: { customerId }, select: conversationSelect });
  }

  findForStaff(id: string) {
    return this.db.conversation.findUnique({ where: { id }, select: staffConversationSelect });
  }

  // * Most recent activity first; customers who opened chat but never wrote are left out
  async listForStaff({ skip, take }: { skip: number; take: number }) {
    const where = { lastMessageAt: { not: null } };
    const [items, total] = await this.db.$transaction([
      this.db.conversation.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        skip,
        take,
        select: staffConversationSelect,
      }),
      this.db.conversation.count({ where }),
    ]);
    return { items, total };
  }

  upsertForCustomer(customerId: string, tx: DbClient = this.db) {
    return tx.conversation.upsert({
      where: { customerId },
      create: { customerId },
      update: {},
      select: conversationSelect,
    });
  }

  touch(conversationId: string, at: Date, tx: DbClient = this.db) {
    return tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: at }, select: { id: true } });
  }

  // * Newest first; `before` is the id of the oldest message the client already has
  async listMessages(conversationId: string, { before, size }: { before?: string | undefined; size: number }) {
    const items = await this.db.message.findMany({
      where: { conversationId },
      orderBy: { seq: 'desc' },
      take: size,
      ...(before && { cursor: { id: before }, skip: 1 }),
      select: messageSelect,
    });
    return { items, nextCursor: items.length === size ? (items.at(-1)?.id ?? null) : null };
  }

  findMessageByClientId(senderId: string, clientMessageId: string, tx: DbClient = this.db) {
    return tx.message.findUnique({
      where: { senderId_clientMessageId: { senderId, clientMessageId } },
      select: messageSelect,
    });
  }

  createMessage(
    data: {
      conversationId: string;
      senderId: string;
      type: MessageType;
      text?: string | null | undefined;
      attachmentId?: string | null | undefined;
      clientMessageId: string;
    },
    tx: DbClient = this.db,
  ) {
    return tx.message.create({
      data: {
        conversationId: data.conversationId,
        senderId: data.senderId,
        type: data.type,
        text: data.text ?? null,
        attachmentId: data.attachmentId ?? null,
        clientMessageId: data.clientMessageId,
      },
      select: messageSelect,
    });
  }
}
