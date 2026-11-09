// Writes the OpenAPI spec to openapi.json (repo: backend/openapi.json) for other repos to read or generate clients from.
//
//   pnpm run openapi
import { writeFile } from 'node:fs/promises';
import { buildOpenApiDocument } from '../src/docs/openapi.js';

const out = new URL('../openapi.json', import.meta.url);
await writeFile(out, `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`);
process.stdout.write(`Wrote ${out.pathname}\n`);
