// * Builds the OpenAPI document from each module's *.openapi.ts. Dev tooling only: served at /docs outside
// * production and written to openapi.json by `pnpm run openapi`. Add a module by spreading its paths below.
import { createDocument } from 'zod-openapi';
import { authOpenApiPaths } from '@modules/auth/auth.openapi.js';
import { BEARER_AUTH } from '@shared/openapi/openapi.common.js';

export const buildOpenApiDocument = () =>
  createDocument({
    openapi: '3.1.0',
    info: {
      title: 'chat_backend',
      version: '1.0.0',
      description:
        'Chat service for the LOS system. Integration guide: docs/backend/features/auth/los-chat-handoff.md. ' +
        'Errors always use the ErrorResponse envelope.',
    },
    servers: [{ url: 'http://localhost:3000', description: 'Local development' }],
    tags: [
      { name: 'Auth (customer)', description: 'Flutter app: `/customer/api/v1/auth`' },
      { name: 'Auth (staff)', description: 'chat_web inside los_web: `/agent/api/v1/auth`' },
    ],
    components: {
      securitySchemes: {
        [BEARER_AUTH]: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Chat session `accessToken` from /auth/session or /auth/refresh (never an LOS token)',
        },
      },
    },
    paths: {
      ...authOpenApiPaths,
    },
  });
