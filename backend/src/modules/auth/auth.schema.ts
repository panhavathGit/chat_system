import { z } from 'zod';

export const customerSessionSchema = z.object({
  losToken: z.string().min(1),
});

export const staffSessionSchema = z.object({
  handoffToken: z.string().min(1),
});

// * Used by both /auth/refresh and /auth/logout, for both audiences
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1).max(256),
});
