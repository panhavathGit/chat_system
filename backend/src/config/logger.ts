import { pino } from "pino";
import { env } from "./env.js";
import { requestContext } from "./request-context.js";

export const logger = pino({
  level: env.LOG_LEVEL,
  // Every line logged while handling a request carries its requestId.
  mixin: () => requestContext.getStore() ?? {},
  ...(env.NODE_ENV === "development" && { transport: { target: "pino-pretty" } }),
});
