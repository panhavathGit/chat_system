import { fromPartial } from "@total-typescript/shoehorn";
import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { BadRequestError } from "@shared/errors/AppError.js";
import { validate } from "../validate.middleware.js";

const res = fromPartial<Response>({});

describe("validate", () => {
  it("replaces req.query with the parsed value", () => {
    const req = fromPartial<Request>({ query: { page: "2" } });
    const next = vi.fn();
    validate({ query: z.object({ page: z.coerce.number() }) })(req, res, next);
    expect(req.query).toEqual({ page: 2 });
    expect(next).toHaveBeenCalledWith();
  });

  it("forwards a BadRequestError with issues when invalid", () => {
    const req = fromPartial<Request>({ body: { amount: -1 } });
    const next = vi.fn();
    validate({ body: z.object({ amount: z.number().positive() }) })(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
  });
});
