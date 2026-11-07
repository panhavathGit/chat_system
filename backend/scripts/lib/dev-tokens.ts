// Dev only: signs LOS-shaped tokens with the dev key from dev-keys.ts, so chat_backend can be tested without LOS.
import { readFileSync } from 'node:fs';
import { importPKCS8, SignJWT } from 'jose';

export interface DevTokenOptions {
  user: number;
  name: string;
  role?: string;
  aud?: string;
  tokenType?: string;
  expired?: boolean;
  // * Overrides the LOS lifetimes (1h customer, 2 min handoff), e.g. for a Postman environment used by hand
  expiresInSec?: number;
  keyPath?: string;
}

// * Mirrors los_backendv2 jwt.util.ts: customer access token (aud luyleun) and the staff handoff token (aud chat)
export const signDevToken = async (kind: 'customer' | 'handoff', options: DevTokenOptions) => {
  const privateKey = await importPKCS8(readFileSync(options.keyPath ?? 'keys/dev-los-private.pem', 'utf8'), 'RS256');
  const now = Math.floor(Date.now() / 1000);

  const claims =
    kind === 'customer'
      ? { userId: options.user, username: options.name, type: 'customer', tokenType: options.tokenType ?? 'access' }
      : {
          userId: options.user,
          username: options.name,
          type: 'staff',
          role: options.role ?? 'CREDIT_SUPPORT_OFFICER',
          roleId: 0,
          tokenType: options.tokenType ?? 'chat-handoff',
        };

  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer('los-backend')
    .setAudience(options.aud ?? (kind === 'customer' ? 'luyleun' : 'chat'))
    .setIssuedAt(options.expired ? now - 7200 : now)
    .setExpirationTime(
      options.expired ? now - 3600 : now + (options.expiresInSec ?? (kind === 'customer' ? 3600 : 120)),
    )
    .sign(privateKey);
};
