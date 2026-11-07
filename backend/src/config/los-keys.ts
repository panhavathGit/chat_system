import { readFileSync } from 'node:fs';
import { createRemoteJWKSet, importSPKI, type JWTVerifyGetKey } from 'jose';
import { env } from './env.js';

// * JWKS in production (cached by jose, refetched when LOS rotates its key); a PEM file for local development
const loadLosKey = async (): Promise<JWTVerifyGetKey> => {
  if (env.LOS_JWKS_URI) return createRemoteJWKSet(new URL(env.LOS_JWKS_URI));
  const key = await importSPKI(readFileSync(env.LOS_PUBLIC_KEY_PATH as string, 'utf8'), 'RS256');
  return () => key;
};

export const losKey = await loadLosKey();
