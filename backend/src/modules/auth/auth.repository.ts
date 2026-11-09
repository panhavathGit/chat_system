import type { DatabaseClient, DbClient } from '@config/database.js';

export const chatUserSelect = {
  id: true,
  losUserId: true,
  type: true,
  username: true,
} as const;

const refreshTokenSelect = {
  id: true,
  familyId: true,
  expiresAt: true,
  revokedAt: true,
  user: { select: chatUserSelect },
} as const;

export class AuthRepository {
  constructor(private readonly db: DatabaseClient) {}

  transaction<T>(fn: (tx: DbClient) => Promise<T>) {
    return this.db.$transaction(fn);
  }

  // * LOS owns the accounts; we keep a local row per LOS user so messages and files can reference it
  upsertCustomer(data: { losUserId: number; username: string; roleId: number }) {
    return this.db.chatUser.upsert({
      where: { losUserId_type: { losUserId: data.losUserId, type: 'CUSTOMER' } },
      create: { losUserId: data.losUserId, type: 'CUSTOMER', username: data.username, roleId: data.roleId },
      update: { username: data.username, lastSeenAt: new Date() },
      select: chatUserSelect,
    });
  }

  upsertStaff(data: { losUserId: number; username: string; roleId: number }) {
    return this.db.chatUser.upsert({
      where: { losUserId_type: { losUserId: data.losUserId, type: 'STAFF' } },
      create: { losUserId: data.losUserId, type: 'STAFF', username: data.username, roleId: data.roleId },
      update: { username: data.username, roleId: data.roleId, lastSeenAt: new Date() },
      select: chatUserSelect,
    });
  }

  createRefreshToken(
    data: { id?: string; userId: string; familyId: string; tokenHash: string; expiresAt: Date; userAgent?: string },
    tx: DbClient = this.db,
  ) {
    return tx.refreshToken.create({ data, select: { id: true } });
  }

  findRefreshTokenByHash(tokenHash: string, tx: DbClient = this.db) {
    return tx.refreshToken.findUnique({ where: { tokenHash }, select: refreshTokenSelect });
  }

  // * Conditional on revokedAt IS NULL: of two concurrent refreshes with the same token, only one gets count 1
  revokeRefreshToken(id: string, replacedById: string, tx: DbClient = this.db) {
    return tx.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date(), replacedById },
    });
  }

  revokeFamily(familyId: string, tx: DbClient = this.db) {
    return tx.refreshToken.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  deleteExpiredRefreshTokens(userId: string) {
    return this.db.refreshToken.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } });
  }
}
