import type { DatabaseClient, DbClient } from '@config/database.js';
import { attachmentSummarySelect } from './conversation.repository.js';

export class AttachmentRepository {
  constructor(private readonly db: DatabaseClient) {}

  create(data: {
    uploaderId: string;
    storageKey: string;
    mimeType: string;
    sizeBytes: number;
    fileName: string;
    durationSec?: number | null | undefined;
  }) {
    return this.db.attachment.create({
      data: { ...data, durationSec: data.durationSec ?? null },
      select: attachmentSummarySelect,
    });
  }

  // * Internal: includes storageKey and ownership, never sent to the client as-is
  findForAccess(id: string, tx: DbClient = this.db) {
    return tx.attachment.findUnique({
      where: { id },
      select: {
        id: true,
        uploaderId: true,
        storageKey: true,
        mimeType: true,
        sizeBytes: true,
        fileName: true,
        message: { select: { id: true, conversation: { select: { customerId: true } } } },
      },
    });
  }
}
