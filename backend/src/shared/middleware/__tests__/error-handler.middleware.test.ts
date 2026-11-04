import { fromPartial } from "@total-typescript/shoehorn";
import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ConflictError } from "@shared/errors/AppError.js";
import { errorHandler } from "../error-handler.middleware.js";

vi.mock("@config/logger.js", () => ({ logger: { error: vi.fn() } }));

function handle(err: unknown) {
  const json = vi.fn();
  const res = fromPartial<Response>({ status: vi.fn().mockReturnValue({ json }) });
  errorHandler(err, fromPartial<Request>({}), res, vi.fn());
  return { status: vi.mocked(res.status).mock.calls[0]?.[0], body: json.mock.calls[0]?.[0] };
}

describe("errorHandler", () => {
  it("serializes an AppError with its code and details", () => {
    const { status, body } = handle(new ConflictError("dup", { field: "id" }));
    expect(status).toBe(409);
    expect(body).toEqual({ status: "error", error: { code: "CONFLICT", message: "dup", details: { field: "id" } } });
  });

  it("maps ZodError to 400", () => {
    const parsed = z.object({ a: z.string() }).safeParse({});
    expect(handle(parsed.error).status).toBe(400);
  });

  it("maps Prisma P2002 to 409 and P2025 to 404", () => {
    expect(handle({ code: "P2002" }).status).toBe(409);
    expect(handle({ code: "P2025" }).status).toBe(404);
  });

  it("hides internals on unknown errors", () => {
    const { status, body } = handle(new Error("secret"));
    expect(status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("secret");
  });
});
