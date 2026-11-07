import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma as PrismaTypes } from '../../generated/prisma/client.js';
import { env } from './env.js';

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });

export type DatabaseClient = typeof prisma;

// * A client usable both outside and inside db.$transaction, so a repository method can join a caller's transaction
export type DbClient = DatabaseClient | PrismaTypes.TransactionClient;

export { Prisma } from '../../generated/prisma/client.js';
