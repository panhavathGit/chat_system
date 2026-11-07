import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { DbClient } from '@config/database.js';
import { BadRequestError, NotFoundError, UnsupportedMediaTypeError } from '@shared/errors/AppError.js';
import { mediaCategoryOf } from '@shared/storage/media-types.js';
import type { StorageDriver } from '@shared/storage/storage.driver.js';
import type { AttachmentRepository } from './attachment.repository.js';

const safeExtension = (fileName: string) => {
  const ext = path.extname(fileName).toLowerCase();
  return /^\.[a-z0-9]{1,8}$/.test(ext) ? ext : '';
};

// * Shared by both audiences: uploading, checking an attachment can be sent, and download access
export class AttachmentService {
  constructor(
    private readonly attachmentRepository: AttachmentRepository,
    private readonly storage: StorageDriver,
  ) {}

  async upload(user: Express.User, file: Express.Multer.File, durationSec?: number) {
    const category = mediaCategoryOf(file.mimetype);
    if (!category) throw new UnsupportedMediaTypeError(`File type ${file.mimetype} is not allowed`);

    const now = new Date();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const storageKey = `${now.getUTCFullYear()}/${month}/${randomUUID()}${safeExtension(file.originalname)}`;
    await this.storage.put(storageKey, file.buffer);

    try {
      return await this.attachmentRepository.create({
        uploaderId: user.id,
        storageKey,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        fileName: file.originalname.slice(0, 255),
        durationSec: category === 'VOICE' ? durationSec : null,
      });
    } catch (err) {
      // * Don't leave an orphan file on disk when the row can't be written
      await this.storage.delete(storageKey);
      throw err;
    }
  }

  // * Called inside the send transaction: the file must be the sender's own, unsent, and match the message type
  async assertSendable(senderId: string, attachmentId: string, type: 'VOICE' | 'IMAGE' | 'FILE', tx: DbClient) {
    const attachment = await this.attachmentRepository.findForAccess(attachmentId, tx);
    if (!attachment || attachment.uploaderId !== senderId) throw new BadRequestError('Unknown attachmentId');
    if (attachment.message) throw new BadRequestError('This attachment was already sent');

    const category = mediaCategoryOf(attachment.mimeType);
    if (type !== 'FILE' && category !== type) {
      throw new BadRequestError(`A ${type} message needs a ${type === 'VOICE' ? 'audio' : 'image'} attachment`);
    }
  }

  async openForDownload(user: Express.User, attachmentId: string) {
    const attachment = await this.attachmentRepository.findForAccess(attachmentId);
    // * 404 rather than 403 so other people's attachment ids aren't confirmed to exist
    if (!attachment || !this.canRead(user, attachment)) throw new NotFoundError('Attachment not found');

    return {
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      fileName: attachment.fileName,
      stream: this.storage.getStream(attachment.storageKey),
    };
  }

  private canRead(
    user: Express.User,
    attachment: { uploaderId: string; message: { conversation: { customerId: string } } | null },
  ) {
    if (attachment.uploaderId === user.id) return true;
    if (!attachment.message) return false;
    // * Staff may read every conversation; a customer only their own
    return user.kind === 'staff' || attachment.message.conversation.customerId === user.id;
  }
}
