import { z } from 'zod';

export const customerSessionSchema = z.object({
  losToken: z.string().min(1),
});

export const staffSessionSchema = z.object({
  handoffToken: z.string().min(1),
});
