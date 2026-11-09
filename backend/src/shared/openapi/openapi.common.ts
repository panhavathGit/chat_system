// * Documentation only: these schemas describe responses for the OpenAPI spec and are never used to validate
// * at runtime. Only src/docs imports this, and only outside production (zod-openapi is a dev dependency).
import type {} from 'zod-openapi'; // * type augmentation so .meta() accepts `id`
import type { ZodOpenApiResponseObject } from 'zod-openapi';
import { z } from 'zod';

export const BEARER_AUTH = 'bearerAuth';
export const bearerSecurity = [{ [BEARER_AUTH]: [] }];

export const errorResponseSchema = z
  .object({
    status: z.literal('error'),
    error: z.object({
      code: z.string().meta({ example: 'UNAUTHORIZED' }),
      message: z.string().meta({ example: 'Invalid or missing access token' }),
      details: z.unknown().optional().meta({
        description: 'Validation errors (field → messages), or the failed token check outside production',
      }),
    }),
  })
  .meta({ id: 'ErrorResponse' });

// * The success envelope every handler sends: { status: 'success', data }
export const success = <T extends z.ZodType>(data: T) => z.object({ status: z.literal('success'), data });

export const jsonResponse = (description: string, schema: z.ZodType): ZodOpenApiResponseObject => ({
  description,
  content: { 'application/json': { schema } },
});

export const errorResponse = (description: string) => jsonResponse(description, errorResponseSchema);
