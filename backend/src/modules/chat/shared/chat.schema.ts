import { z } from 'zod';
import { MESSAGE_TYPES } from '@shared/types/chat-types.js';

export const sendMessageSchema = z
  .object({
    // * Made by the client per message; a retry with the same value returns the original instead of a duplicate
    clientMessageId: z.string().trim().min(1).max(64),
    type: z.enum(MESSAGE_TYPES),
    text: z.string().trim().min(1).max(4000).optional(),
    attachmentId: z.uuid().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'TEXT' && !data.text) {
      ctx.addIssue({ code: 'custom', path: ['text'], message: 'text is required for TEXT messages' });
    }
    if (data.type === 'TEXT' && data.attachmentId) {
      ctx.addIssue({ code: 'custom', path: ['attachmentId'], message: 'TEXT messages take no attachment' });
    }
    if (data.type !== 'TEXT' && !data.attachmentId) {
      ctx.addIssue({ code: 'custom', path: ['attachmentId'], message: `attachmentId is required for ${data.type}` });
    }
  });

export const messagesQuerySchema = z.object({
  before: z.uuid().optional(),
  size: z.coerce.number().int().min(1).max(100).default(30),
});

export const idParamSchema = z.object({
  id: z.uuid(),
});

export const uploadBodySchema = z.object({
  durationSec: z.coerce.number().int().min(1).max(3600).optional(),
});
