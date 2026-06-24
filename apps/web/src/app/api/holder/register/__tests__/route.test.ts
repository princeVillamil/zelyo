import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "@/lib/errors";

const registerHolder = vi.fn();
const consumeOrThrow = vi.fn();
vi.mock("@/server/holder.service", () => ({ registerHolder }));
vi.mock("@/lib/ratelimit", () => ({
  limiters: { register: {} },
  consumeOrThrow,
  clientIp: () => "1.1.1.1",
}));

function req(body: unknown) {
  return new Request("http://localhost/api/holder/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/holder/register", () => {
  beforeEach(() => { registerHolder.mockReset(); consumeOrThrow.mockReset(); });

  it("201 on success", async () => {
    registerHolder.mockResolvedValueOnce({ id: "u1", username: "alice" });
    const { POST } = await import("../route");
    const res = await POST(req({ username: "alice", password: "supersecret" }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: "u1", username: "alice" });
  });

  it("400 on invalid body", async () => {
    const { POST } = await import("../route");
    const res = await POST(req({ username: "a", password: "x" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION");
  });

  it("429 when rate limited", async () => {
    consumeOrThrow.mockRejectedValueOnce(
      Object.assign(new AppError("RATE_LIMITED", 429, "Too many requests. Please retry shortly."), { retryAfter: 30 }),
    );
    const { POST } = await import("../route");
    const res = await POST(req({ username: "alice", password: "supersecret" }));
    expect(res.status).toBe(429);
  });
});
