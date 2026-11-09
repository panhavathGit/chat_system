import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { buildOpenApiDocument } from './openapi.js';

// * Built once at startup; restart the dev server (tsx watch does it) to pick up spec changes
const document = buildOpenApiDocument();

export const docsRouter = Router();
docsRouter.get('/openapi.json', (_req, res) => {
  res.status(200).json(document);
});
docsRouter.use('/', swaggerUi.serve, swaggerUi.setup(document));
