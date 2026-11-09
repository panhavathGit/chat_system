// * OpenAPI description of the auth routes (documentation only; see @shared/openapi/openapi.common.ts).
// * Request bodies reuse the Zod schemas the routes validate with, so the spec can't drift from them.
// * Imported directly by src/docs (not through index.ts), so building the spec doesn't start Prisma.
import type { ZodOpenApiPathsObject } from 'zod-openapi';
import { z } from 'zod';
import {
  bearerSecurity,
  errorResponse,
  jsonResponse,
  success,
} from '@shared/openapi/openapi.common.js';
import { customerSessionSchema, refreshTokenSchema, staffSessionSchema } from './auth.schema.js';

const sessionUserSchema = z
  .object({
    id: z.uuid().meta({ description: 'Chat user id (shown as sender.id, customerId, …). Not the LOS id.' }),
    losUserId: z.number().int().meta({ description: 'The LOS userId', example: 2 }),
    type: z.enum(['customer', 'staff']).meta({ description: 'Lowercase here; message sender.type is uppercase' }),
    username: z.string().meta({ example: 'admin' }),
  })
  .meta({ id: 'SessionUser' });

const sessionSchema = z
  .object({
    accessToken: z.string().meta({ description: 'Chat session JWT. Send as `Authorization: Bearer …` and Socket.io `auth.token`.' }),
    expiresIn: z.string().meta({ description: 'Access token lifetime: customer `1h`, staff `15m`', example: '15m' }),
    user: sessionUserSchema,
    refreshToken: z.string().meta({
      description: 'Opaque and single-use. Replace the stored value after every refresh.',
    }),
    refreshExpiresAt: z.iso.datetime().meta({
      description: 'Absolute end of this login (24 h after sign-in); refreshing does not move it',
    }),
  })
  .meta({ id: 'Session' });

const refreshBody = refreshTokenSchema.meta({ id: 'RefreshTokenRequest' });

const audiences = [
  {
    prefix: '/customer/api/v1/auth',
    tag: 'Auth (customer)',
    login: customerSessionSchema.meta({ id: 'CustomerSessionRequest' }),
    loginSummary: 'Exchange an LOS customer access token for a chat session',
    loginDescription:
      'Accepts the LOS access token the app already holds (`aud=luyleun`, `type=customer`, `tokenType=access`). ' +
      'Finds or creates the chat user and returns a 1 h chat session plus a 24 h refresh token.',
  },
  {
    prefix: '/agent/api/v1/auth',
    tag: 'Auth (staff)',
    login: staffSessionSchema.meta({ id: 'StaffSessionRequest' }),
    loginSummary: 'Exchange an LOS staff handoff token for a chat session',
    loginDescription:
      'Accepts the 2-minute handoff token los_web gets from los_backend (`aud=chat`, `type=staff`, ' +
      '`tokenType=chat-handoff`). The `role` claim must be a known staff role. Returns a 15 min chat session ' +
      'plus a 24 h refresh token.',
  },
] as const;

export const authOpenApiPaths: ZodOpenApiPathsObject = Object.fromEntries(
  audiences.flatMap(({ prefix, tag, login, loginSummary, loginDescription }) => [
    [
      `${prefix}/session`,
      {
        post: {
          tags: [tag],
          summary: loginSummary,
          security: [],
          description: loginDescription,
          requestBody: { content: { 'application/json': { schema: login } } },
          responses: {
            201: jsonResponse('Chat session created', success(sessionSchema)),
            400: errorResponse('Body is missing the token'),
            401: errorResponse('Invalid, expired or wrong-audience LOS token, or unknown role'),
          },
        },
      },
    ],
    [
      `${prefix}/refresh`,
      {
        post: {
          tags: [tag],
          summary: 'Swap a refresh token for a new session and a new refresh token',
          security: [],
          description:
            'Rotation: the refresh token sent stops working. Sending an already-used token ends the whole ' +
            'login (theft detection), so send one refresh at a time. A refresh token only works on its own ' +
            "audience's endpoint.",
          requestBody: { content: { 'application/json': { schema: refreshBody } } },
          responses: {
            200: jsonResponse('New session', success(sessionSchema)),
            400: errorResponse('Body is missing refreshToken'),
            401: errorResponse('Unknown, expired, revoked or already-used refresh token: sign in again'),
          },
        },
      },
    ],
    [
      `${prefix}/logout`,
      {
        post: {
          tags: [tag],
          summary: 'End the login behind a refresh token',
          security: [],
          description: 'Revokes every refresh token of that login. Always succeeds, even for an unknown token.',
          requestBody: { content: { 'application/json': { schema: refreshBody } } },
          responses: {
            200: jsonResponse('Logged out', success(z.null())),
            400: errorResponse('Body is missing refreshToken'),
          },
        },
      },
    ],
    [
      `${prefix}/me`,
      {
        get: {
          tags: [tag],
          summary: 'The signed-in chat user',
          security: bearerSecurity,
          responses: {
            200: jsonResponse('Current user', success(sessionUserSchema)),
            401: errorResponse('Missing, expired or wrong-audience access token'),
          },
        },
      },
    ],
  ]),
);
