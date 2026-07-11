import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/verify/route";

const { verifyAndRegister } = vi.hoisted(() => ({
  verifyAndRegister: vi.fn(),
}));

vi.mock("@/server/verification.service", () => ({
  verifyAndRegister,
}));

vi.mock("@/lib/db", () => ({
  db: {
    jobGate: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/ratelimit", () => ({
  limiters: { verify: {} },
  consumeOrThrow: vi.fn(),
  clientIp: () => "127.0.0.1",
}));

vi.mock("@/lib/audit", () => ({
  audit: vi.fn(),
}));

const validPayload = {
  proof: [1, 2, 3],
  publicInputs: {
    root: "0x0000000000000000000000000000000000000000000000000000000000000001",
    scope: "0x0000000000000000000000000000000000000000000000000000000000000002",
    boundAddress: "0x0000000000000000000000000000000000000000000000000000000000000003",
    nullifier: "0x0000000000000000000000000000000000000000000000000000000000000004",
    disclosed: {
      value: "0x0000000000000000000000000000000000000000000000000000000000000005",
      raw: { track: "engineering" },
    },
  },
  boundStellarAddress: `G${"A".repeat(55)}`,
};

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyAndRegister.mockReset();
    verifyAndRegister.mockResolvedValue({ ok: true, result: "VERIFIED", txHash: "txhash" });
  });

  it("accepts a G... bound address", async () => {
    const res = await POST(makeRequest(validPayload));
    expect(res.status).toBe(200);
    expect(verifyAndRegister).toHaveBeenCalledWith(
      expect.objectContaining({
        boundStellarAddress: validPayload.boundStellarAddress,
      }),
    );
  });

  it("accepts a C... smart-wallet bound address", async () => {
    const payload = {
      ...validPayload,
      boundStellarAddress: `C${"A".repeat(55)}`,
    };
    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(200);
    expect(verifyAndRegister).toHaveBeenCalledWith(
      expect.objectContaining({
        boundStellarAddress: `C${"A".repeat(55)}`,
      }),
    );
  });

  it("rejects an invalid bound address", async () => {
    const payload = { ...validPayload, boundStellarAddress: "invalid" };
    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(400);
  });
});
