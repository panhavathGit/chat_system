import { errors, jwtVerify, SignJWT, type JWTPayload, type JWTVerifyGetKey } from 'jose';
import { env } from '@config/env.js';
import { UnauthorizedError } from '@shared/errors/AppError.js';
import type { RoleRepository } from '@modules/role/index.js';
import type { AuthRepository } from './auth.repository.js';

type SessionKind = 'customer' | 'staff';

const SESSION_ISSUER = 'chat-backend';
// * One audience per kind, so a customer session is rejected on staff routes and vice versa
const SESSION_AUDIENCE: Record<SessionKind, string> = { customer: 'chat-customer', staff: 'chat-staff' };
const SESSION_EXPIRES_IN: Record<SessionKind, string> = {
  customer: env.CHAT_CUSTOMER_SESSION_EXPIRES_IN,
  staff: env.CHAT_STAFF_SESSION_EXPIRES_IN,
};
const sessionSecret = new TextEncoder().encode(env.CHAT_SESSION_SECRET);
const MAX_INT32 = 2 ** 31 - 1;

type LosClaims = JWTPayload & {
  userId?: unknown;
  username?: unknown;
  type?: unknown;
  tokenType?: unknown;
  role?: unknown;
};

type SessionClaims = JWTPayload & {
  losUserId?: unknown;
  username?: unknown;
};

const toUser = (row: { id: string; losUserId: number; kind: 'CUSTOMER' | 'STAFF'; username: string }): Express.User => ({
  id: row.id,
  losUserId: row.losUserId,
  kind: row.kind === 'CUSTOMER' ? 'customer' : 'staff',
  username: row.username,
});

// * "Sign in with LOS": an LOS-signed token proves who someone is, we map them to a chat_users row
// * (find-or-create by LOS id), then every chat request uses our own session token, never the LOS one
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly roleRepository: RoleRepository,
    private readonly losKey: JWTVerifyGetKey,
  ) {}

  // * Mobile sends the LOS access token it already holds, once, straight to us
  async exchangeCustomerToken(losToken: string) {
    const claims = await this.verifyLosToken(losToken, env.LOS_CUSTOMER_AUDIENCE);
    if (claims.type !== 'customer' || claims.tokenType !== 'access') {
      throw new UnauthorizedError('Not an LOS customer access token');
    }
    const { losUserId, username } = this.readIdentity(claims);
    // * LOS customer access tokens carry no role claim; every customer gets the seeded CUSTOMER role
    const roleId = await this.resolveRole('CUSTOMER', 'CUSTOMER');
    return this.issueSession(toUser(await this.authRepository.upsertCustomer({ losUserId, username, roleId })));
  }

  // * chat_web gets a chat-only, 2-minute LOS handoff token from los_web; the real LOS staff token never leaves los_web
  async exchangeHandoff(handoffToken: string) {
    const claims = await this.verifyLosToken(handoffToken, env.LOS_HANDOFF_AUDIENCE);
    if (claims.type !== 'staff' || claims.tokenType !== env.LOS_HANDOFF_TOKEN_TYPE) {
      throw new UnauthorizedError('Not an LOS staff handoff token');
    }
    const { losUserId, username } = this.readIdentity(claims);
    // * Validate the role exists in our roles table and is a STAFF kind
    const roleId = await this.resolveRole(claims.role, 'STAFF');
    return this.issueSession(toUser(await this.authRepository.upsertStaff({ losUserId, username, roleId })));
  }

  // * Stateless: the session carries everything req.user needs, so no database call per request
  async verifySession(token: string, kind: SessionKind): Promise<Express.User> {
    const claims = await this.verifyOrUnauthorized(() =>
      jwtVerify<SessionClaims>(token, sessionSecret, {
        algorithms: ['HS256'],
        issuer: SESSION_ISSUER,
        audience: SESSION_AUDIENCE[kind],
      }),
    );
    const { sub, losUserId, username } = claims;
    if (!sub || typeof losUserId !== 'number' || typeof username !== 'string') {
      throw new UnauthorizedError('Malformed chat session token');
    }
    return { id: sub, losUserId, kind, username };
  }

  private async issueSession(user: Express.User) {
    const expiresIn = SESSION_EXPIRES_IN[user.kind];
    const accessToken = await new SignJWT({ losUserId: user.losUserId, username: user.username })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuer(SESSION_ISSUER)
      .setAudience(SESSION_AUDIENCE[user.kind])
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(sessionSecret);
    return { accessToken, expiresIn, user };
  }

  // * Rejects tokens whose role is unknown to this service or whose kind doesn't match what the endpoint expects
  private async resolveRole(roleClaim: unknown, expectedKind: 'CUSTOMER' | 'STAFF'): Promise<number> {
    if (typeof roleClaim !== 'string') throw new UnauthorizedError('Token is missing a role claim');
    const role = await this.roleRepository.findByName(roleClaim);
    if (!role || role.kind !== expectedKind) throw new UnauthorizedError(`Unknown or invalid role: ${roleClaim}`);
    return role.id;
  }

  private verifyLosToken(token: string, audience: string) {
    return this.verifyOrUnauthorized(() =>
      jwtVerify<LosClaims>(token, this.losKey, { algorithms: ['RS256'], issuer: env.LOS_ISSUER, audience }),
    );
  }

  private readIdentity(claims: LosClaims) {
    const { userId, username } = claims;
    // * LOS ids are MySQL INT; anything else would fail at the database as a 500
    const isLosId = typeof userId === 'number' && Number.isInteger(userId) && userId > 0 && userId <= MAX_INT32;
    if (!isLosId || typeof username !== 'string') {
      throw new UnauthorizedError('Token is missing a valid userId or username');
    }
    return { losUserId: userId, username };
  }

  // * Every jose failure (bad signature, expired, wrong iss/aud) becomes a 401 instead of a 500.
  // * Outside production the reason is included, because "Invalid token" alone hides which check failed.
  private async verifyOrUnauthorized<T extends JWTPayload>(verify: () => Promise<{ payload: T }>): Promise<T> {
    try {
      return (await verify()).payload;
    } catch (err) {
      if (err instanceof errors.JWTExpired) throw new UnauthorizedError('Token has expired');
      if (err instanceof errors.JOSEError) {
        throw new UnauthorizedError('Invalid token', env.NODE_ENV === 'production' ? undefined : this.describe(err));
      }
      throw err;
    }
  }

  private describe(err: InstanceType<typeof errors.JOSEError>) {
    if (err instanceof errors.JWTClaimValidationFailed) return { reason: err.reason, claim: err.claim };
    if (err instanceof errors.JWSSignatureVerificationFailed) return { reason: 'signature does not match the key' };
    if (err instanceof errors.JWKSNoMatchingKey) return { reason: 'no LOS key matches this token' };
    if (err instanceof errors.JOSEAlgNotAllowed) return { reason: 'algorithm not allowed' };
    return { reason: err.code };
  }
}
