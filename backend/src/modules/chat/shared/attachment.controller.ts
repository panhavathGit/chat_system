import { pipeline } from 'node:stream/promises';
import type { Request, Response } from 'express';
import { getAuthUser } from '@shared/middleware/auth.middleware.js';
import type { AttachmentService } from './attachment.service.js';

// * Handlers are arrow-function properties so `this` stays bound when passed to the router
export class AttachmentController {
  constructor(private readonly attachmentService: AttachmentService) {}

  upload = async (req: Request, res: Response) => {
    const file = req.file as Express.Multer.File; // * uploadSingle() guarantees it
    const attachment = await this.attachmentService.upload(getAuthUser(req), file, req.body.durationSec);
    res.status(201).json({ status: 'success', data: attachment });
  };

  download = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const file = await this.attachmentService.openForDownload(getAuthUser(req), id);
    // * Images and audio play in place; documents are always downloaded, never rendered by the browser
    const inline = file.mimeType.startsWith('image/') || file.mimeType.startsWith('audio/');
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', String(file.sizeBytes));
    res.setHeader(
      'Content-Disposition',
      `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
    );
    res.setHeader('Cache-Control', 'private, max-age=3600');
    await pipeline(file.stream, res);
  };
}
