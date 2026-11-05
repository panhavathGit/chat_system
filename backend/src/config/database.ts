import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../prisma/generated/prisma/client.js";
import { env } from "./env.js";

// Prisma 7 needs a driver adapter; @prisma/adapter-pg talks to PostgreSQL via `pg`.
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });
