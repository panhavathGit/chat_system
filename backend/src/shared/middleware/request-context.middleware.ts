import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import { requestContext } from "@config/request-context.js";

export const withRequestContext: RequestHandler = (req, res, next) => {
  const requestId = req.header("x-request-id") ?? randomUUID();
  res.setHeader("x-request-id", requestId);
  requestContext.run({ requestId }, next);
};
