import { describe, it, expect } from "vitest";
import { AppError, toErrorResponse } from "../errors";

describe("AppError boundary", () => {
  it("maps an AppError to its public shape", () => {
    const r = toErrorResponse(new AppError("UNAUTHORIZED", 401, "Sign in required"));
    expect(r.status).toBe(401);
    expect(r.body).toEqual({ error: { code: "UNAUTHORIZED", message: "Sign in required" } });
  });

  it("includes details when provided, omits them otherwise", () => {
    const withDetails = toErrorResponse(
      new AppError("ALREADY_CLAIMED", 409, "Already claimed.", { txHash: "abc" }),
    );
    expect(withDetails.body.error.details).toEqual({ txHash: "abc" });

    const without = toErrorResponse(new AppError("UNAUTHORIZED", 401, "Sign in required"));
    expect(without.body.error).not.toHaveProperty("details");
  });

  it("never leaks unknown errors", () => {
    const r = toErrorResponse(new Error("connect ECONNREFUSED 5432 password=hunter2"));
    expect(r.status).toBe(500);
    expect(r.body.error.code).toBe("INTERNAL");
    expect(JSON.stringify(r.body)).not.toContain("hunter2");
  });
});
