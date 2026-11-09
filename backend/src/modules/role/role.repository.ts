import type { DatabaseClient } from '@config/database.js';

export class RoleRepository {
  constructor(private readonly db: DatabaseClient) {}

  findByName(name: string) {
    return this.db.role.findUnique({
      where: { name },
      select: { id: true, type: true },
    });
  }
}
