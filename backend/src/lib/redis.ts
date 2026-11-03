import { Redis } from "ioredis";
import { env } from "../config/env.js";

// Pub/Sub needs a dedicated connection for subscribing, so expose a factory.
export const createRedis = () => new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

export const redis = createRedis();
