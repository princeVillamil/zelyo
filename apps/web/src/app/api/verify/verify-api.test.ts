import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "@/lib/errors";

vi.mock("@/server/verification.service", () => ({ verifyAndRegister: vi.fn() }));
vi.mock("@/lib/ratelimit", () => ({
  limiters: { verify: {} },
  consumeOrThrow: vi.fn(),
  clientIp: (headers: Headers) => (headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "unknown",
}));
vi.mock("@/lib/db", () => ({ db: { verification: { findFirst: vi.fn() } } }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));

import { POST as verify } from "./route";
import { GET as getVerify } from "./[txHash]/route";
import { verifyAndRegister } from "@/server/verification.service";
import { consumeOrThrow } from "@/lib/ratelimit";
import { db } from "@/lib/db";

const hex = (n: string) => "0x" + n.repeat(32);
const validBody = {
  proof: [1, 2, 3],
  publicInputs: {
    root: hex("ab"), scope: hex("cd"), boundAddress: hex("ef"),
    nullifier: hex("12"), disclosed: hex("34"),
  },
};
const post = (body: unknown) =>
  new Request("http://x/api/verify", { method: "POST", headers: { "x-forwarded-for": "1.1.1.1" }, body: JSON.stringify(body) });

beforeEach(() => vi.clearAllMocks());

describe("POST /api/verify", () => {
  it("validates, rate-limits, and returns the VerifyResult", async () => {
    vi.mocked(verifyAndRegister).mockResolvedValue({ ok: true, result: "VERIFIED", txHash: "TX", explorerUrl: "u" });
    const res = await verify(post(validBody));
    expect(consumeOrThrow).toHaveBeenCalledWith(expect.anything(), "1.1.1.1");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, result: "VERIFIED", txHash: "TX" });
    // proof reconstructed as bytes before reaching the service
    const arg = vi.mocked(verifyAndRegister).mock.calls[0]![0];
    expect(arg.proof).toBeInstanceOf(Uint8Array);
  });

  it("400 on malformed public inputs", async () => {
    const res = await verify(post({ proof: [1], publicInputs: { root: "nope" } }));
    expect(res.status).toBe(400);
    expect(verifyAndRegister).not.toHaveBeenCalled();
  });

  it("400 and never calls the service when the payload contains s", async () => {
    const res = await verify(post({ ...validBody, s: "0xdead" }));
    expect(res.status).toBe(400);
    expect(verifyAndRegister).not.toHaveBeenCalled();
  });

  it("propagates a 429 from the rate limiter", async () => {
    vi.mocked(consumeOrThrow).mockRejectedValue(new AppError("RATE_LIMITED", 429, "Slow down."));
    const res = await verify(post(validBody));
    expect(res.status).toBe(429);
  });
});

describe("GET /api/verify/[txHash]", () => {
  it("returns the mirrored verification", async () => {
    vi.mocked(db.verification.findFirst).mockResolvedValue({
      result: "VERIFIED", nullifierHex: hex("12"), disclosed: { value: hex("34") },
      boundAddress: hex("ef"), txHash: "TX", explorerUrl: "u",
    } as never);
    const res = await getVerify(new Request("http://x"), { params: Promise.resolve({ txHash: "TX" }) });
    expect(res.status).toBe(200);
    expect((await res.json()).result).toBe("VERIFIED");
  });

  it("404 when unknown", async () => {
    vi.mocked(db.verification.findFirst).mockResolvedValue(null as never);
    const res = await getVerify(new Request("http://x"), { params: Promise.resolve({ txHash: "NOPE" }) });
    expect(res.status).toBe(404);
  });
});
