import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { errors, jwtVerify, SignJWT, type JWTPayload, type JWTVerifyGetKey } from 'jose';
import { env } from '@config/env.js';
import { logger } from '@config/logger.js';
import { UnauthorizedError } from '@shared/errors/AppError.js';
import type { RoleRepository } from '@modules/role/index.js';
import type { ChatUserType } from '@shared/types/chat-types.js';
import type { AuthRepository } from './auth.repository.js';

type SessionType = 'customer' | 'staff';

const SESSION_ISSUER = 'chat-backend';
// * One audience per type, so a customer session is rejected on staff routes and vice versa
const SESSION_AUDIENCE: Record<SessionType, string> = { customer: 'chat-customer', staff: 'chat-staff' };
const SESSION_EXPIRES_IN: Record<SessionType, string> = {
  customer: env.CHAT_CUSTOMER_SESSION_EXPIRES_IN,
  staff: env.CHAT_STAFF_SESSION_EXPIRES_IN,
};
const sessionSecret = new TextEncoder().encode(env.CHAT_SESSION_SECRET);
const MAX_INT32 = 2 ** 31 - 1;

const DURATION_UNIT_MS = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;
// * env.ts already guarantees the `<number><s|m|h|d>` shape
const durationToMs = (duration: string) =>
  Number(duration.slice(0, -1)) * DURATION_UNIT_MS[duration.slice(-1) as keyof typeof DURATION_UNIT_MS];
const REFRESH_TTL_MS = durationToMs(env.CHAT_REFRESH_EXPIRES_IN);

// * Opaque and high-entropy, so a plain SHA-256 is enough to store it (no bcrypt needed)
const newRefreshToken = () => randomBytes(32).toString('base64url');
const hashRefreshToken = (token: string) => createHash('sha256').update(token).digest('hex');

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

// * row.type is plain TEXT; the roles CHECK constraint guarantees it is CUSTOMER or STAFF
const toUser = (row: { id: string; losUserId: number; type: string; username: string }): Express.User => ({
  id: row.id,
  losUserId: row.losUserId,
  type: row.type === 'CUSTOMER' ? 'customer' : 'staff',
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
  async exchangeCustomerToken(losToken: string, userAgent?: string) {
    const claims = await this.verifyLosToken(losToken, env.LOS_CUSTOMER_AUDIENCE);
    if (claims.type !== 'customer' || claims.tokenType !== 'access') {
      throw new UnauthorizedError('Not an LOS customer access token');
    }
    const { losUserId, username } = this.readIdentity(claims);
    // * LOS customer access tokens carry no role claim; every customer gets the seeded CUSTOMER role
    const roleId = await this.resolveRole('CUSTOMER', 'CUSTOMER');
    const user = toUser(await this.authRepository.upsertCustomer({ losUserId, username, roleId }));
    return this.startLogin(user, userAgent);
  }

  // * chat_web gets a chat-only, 2-minute LOS handoff token from los_web; the real LOS staff token never leaves los_web
  async exchangeHandoff(handoffToken: string, userAgent?: string) {
    const claims = await this.verifyLosToken(handoffToken, env.LOS_HANDOFF_AUDIENCE);
    if (claims.type !== 'staff' || claims.tokenType !== env.LOS_HANDOFF_TOKEN_TYPE) {
      throw new UnauthorizedError('Not an LOS staff handoff token');
    }
    const { losUserId, username } = this.readIdentity(claims);
    // * Validate the role exists in our roles table and is a STAFF type
    const roleId = await this.resolveRole(claims.role, 'STAFF');
    const user = toUser(await this.authRepository.upsertStaff({ losUserId, username, roleId }));
    return this.startLogin(user, userAgent);
  }

  // * Swaps a refresh token for a new access token + a new refresh token (rotation); the old one stops working.
  // * Does not ask LOS: a user blocked in LOS keeps chat access until the refresh token's absolute expiry.
  async refresh(refreshToken: string, type: SessionType, userAgent?: string) {
    const row = await this.authRepository.findRefreshTokenByHash(hashRefreshToken(refreshToken));
    if (!row) throw new UnauthorizedError('Invalid refresh token');
    const user = toUser(row.user);
    // * Same rule as the audiences: a customer refresh token is rejected on the staff endpoint and vice versa
    if (user.type !== type) throw new UnauthorizedError('Invalid refresh token');
    if (row.revokedAt) {
      await this.handleReuse(row.familyId, user.id);
      throw new UnauthorizedError('Refresh token has already been used');
    }
    if (row.expiresAt <= new Date()) throw new UnauthorizedError('Refresh token has expired');

    const next = newRefreshToken();
    const nextId = randomUUID();
    const rotated = await this.authRepository.transaction(async (tx) => {
      const { count } = await this.authRepository.revokeRefreshToken(row.id, nextId, tx);
      // * 0 = a concurrent refresh with the same token won the race
      if (count === 0) return false;
      await this.authRepository.createRefreshToken(
        {
          id: nextId,
          userId: user.id,
          familyId: row.familyId,
          tokenHash: hashRefreshToken(next),
          expiresAt: row.expiresAt,
          userAgent,
        },
        tx,
      );
      return true;
    });
    if (!rotated) {
      await this.handleReuse(row.familyId, user.id);
      throw new UnauthorizedError('Refresh token has already been used');
    }

    return { ...(await this.issueSession(user)), refreshToken: next, refreshExpiresAt: row.expiresAt };
  }

  // * Ends the whole login (every rotation of it). Idempotent: an unknown or already-revoked token still succeeds.
  async logout(refreshToken: string, type: SessionType) {
    const row = await this.authRepository.findRefreshTokenByHash(hashRefreshToken(refreshToken));
    if (!row || toUser(row.user).type !== type) return;
    await this.authRepository.revokeFamily(row.familyId);
  }

  // * Stateless: the session carries everything req.user needs, so no database call per request
  async verifySession(token: string, type: SessionType): Promise<Express.User> {
    const claims = await this.verifyOrUnauthorized(() =>
      jwtVerify<SessionClaims>(token, sessionSecret, {
        algorithms: ['HS256'],
        issuer: SESSION_ISSUER,
        audience: SESSION_AUDIENCE[type],
      }),
    );
    const { sub, losUserId, username } = claims;
    if (!sub || typeof losUserId !== 'number' || typeof username !== 'string') {
      throw new UnauthorizedError('Malformed chat session token');
    }
    return { id: sub, losUserId, type, username };
  }

  // * A login (LOS exchange) starts a new refresh-token family with a fresh absolute expiry
  private async startLogin(user: Express.User, userAgent?: string) {
    await this.authRepository.deleteExpiredRefreshTokens(user.id);
    const refreshToken = newRefreshToken();
    const refreshExpiresAt = new Date(Date.now() + REFRESH_TTL_MS);
    await this.authRepository.createRefreshToken({
      userId: user.id,
      familyId: randomUUID(),
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: refreshExpiresAt,
      userAgent,
    });
    return { ...(await this.issueSession(user)), refreshToken, refreshExpiresAt };
  }

  // * An already-rotated token came back: either the client replayed it or someone stole it. Kill the family.
  private async handleReuse(familyId: string, userId: string) {
    await this.authRepository.revokeFamily(familyId);
    logger.warn({ familyId, userId }, 'Refresh token reuse detected; revoked the login');
  }

  private async issueSession(user: Express.User) {
    const expiresIn = SESSION_EXPIRES_IN[user.type];
    const accessToken = await new SignJWT({ losUserId: user.losUserId, username: user.username })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuer(SESSION_ISSUER)
      .setAudience(SESSION_AUDIENCE[user.type])
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(sessionSecret);
    return { accessToken, expiresIn, user };
  }

  // * Rejects tokens whose role is unknown to this service or whose type doesn't match what the endpoint expects
  private async resolveRole(roleClaim: unknown, expectedType: ChatUserType): Promise<number> {
    if (typeof roleClaim !== 'string') throw new UnauthorizedError('Token is missing a role claim');
    const role = await this.roleRepository.findByName(roleClaim);
    if (!role || role.type !== expectedType) throw new UnauthorizedError(`Unknown or invalid role: ${roleClaim}`);
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
