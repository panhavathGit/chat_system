import 'dotenv/config';
import { z } from 'zod';

const commaList = z
  .string()
  .optional()
  .transform((value) =>
    value
      ? value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      : [],
  );

const duration = z.string().regex(/^\d+[smhd]$/, 'Durations look like 15m, 1h or 7d');

// * `KEY=` with nothing after it counts as unset, so commenting a value out and blanking it behave the same
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.url(),
    CORS_ORIGIN: commaList,

    // * LOS signs every token with one RSA key pair; we only ever hold the public half
    LOS_JWKS_URI: optional(z.url()),
    LOS_PUBLIC_KEY_PATH: optional(z.string()),
    LOS_ISSUER: z.string().default('los-backend'),
    LOS_CUSTOMER_AUDIENCE: z.string().default('luyleun'),
    LOS_HANDOFF_AUDIENCE: z.string().default('chat'),
    LOS_HANDOFF_TOKEN_TYPE: z.string().default('chat-handoff'),

    // * Signs chat_backend's own session tokens; LOS tokens are only accepted by the /auth/session exchanges
    CHAT_SESSION_SECRET: z.string().min(32, 'CHAT_SESSION_SECRET must be at least 32 characters'),
    CHAT_CUSTOMER_SESSION_EXPIRES_IN: duration.default('1h'),
    CHAT_STAFF_SESSION_EXPIRES_IN: duration.default('15m'),
    // * Absolute max age of a login (both types); refreshing rotates the token but never extends this
    CHAT_REFRESH_EXPIRES_IN: duration.default('24h'),

    UPLOAD_DIR: z.string().default('uploads'),
    UPLOAD_MAX_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .default(20 * 1024 * 1024),
  })
  .refine((data) => data.LOS_JWKS_URI || data.LOS_PUBLIC_KEY_PATH, {
    message: 'Set LOS_JWKS_URI (production) or LOS_PUBLIC_KEY_PATH (local development)',
    path: ['LOS_JWKS_URI'],
  })
  // * Borrowing the analytics-dashboard handoff is a dev-only stopgap until LOS issues aud 'chat'
  .refine((data) => data.NODE_ENV !== 'production' || data.LOS_HANDOFF_AUDIENCE !== 'analytics-dashboard', {
    message: "LOS_HANDOFF_AUDIENCE=analytics-dashboard is for development only; use 'chat' in production",
    path: ['LOS_HANDOFF_AUDIENCE'],
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // ! The logger depends on env, so this is the one place a raw stderr write is unavoidable
  process.stderr.write(`Invalid environment variables:\n${z.prettifyError(parsed.error)}\n`);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
