import type { DatabaseClient } from '@config/database.js';

export const chatUserSelect = {
  id: true,
  losUserId: true,
  kind: true,
  username: true,
} as const;

export class AuthRepository {
  constructor(private readonly db: DatabaseClient) {}

  // * LOS owns the accounts; we keep a local row per LOS user so messages and files can reference it
  upsertCustomer(data: { losUserId: number; username: string; roleId: number }) {
    return this.db.chatUser.upsert({
      where: { losUserId_kind: { losUserId: data.losUserId, kind: 'CUSTOMER' } },
      create: { losUserId: data.losUserId, kind: 'CUSTOMER', username: data.username, roleId: data.roleId },
      update: { username: data.username, lastSeenAt: new Date() },
      select: chatUserSelect,
    });
  }

  upsertStaff(data: { losUserId: number; username: string; roleId: number }) {
    return this.db.chatUser.upsert({
      where: { losUserId_kind: { losUserId: data.losUserId, kind: 'STAFF' } },
      create: { losUserId: data.losUserId, kind: 'STAFF', username: data.username, roleId: data.roleId },
      update: { username: data.username, roleId: data.roleId, lastSeenAt: new Date() },
      select: chatUserSelect,
    });
  }
}
