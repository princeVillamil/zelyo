import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/sep10/token/route";

const { verifyChallenge } = vi.hoisted(() => ({
  verifyChallenge: vi.fn(),
}));

vi.mock("@/server/sep10.service", () => ({
  verifyChallenge,
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

const { holderWalletUpsert, holderWalletUpdateMany } = vi.hoisted(() => ({
  holderWalletUpsert: vi.fn(),
  holderWalletUpdateMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    holderWallet: {
      upsert: holderWalletUpsert,
      updateMany: holderWalletUpdateMany,
    },
  },
}));

vi.mock("@/lib/ratelimit", () => ({
  limiters: { sep10: {} },
  consumeOrThrow: vi.fn(),
  clientIp: () => "127.0.0.1",
}));

vi.mock("@/lib/audit", () => ({
  audit: vi.fn(),
}));

import { auth } from "@/auth";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/sep10/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/sep10/token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyChallenge.mockReset();
    holderWalletUpsert.mockReset();
    holderWalletUpdateMany.mockReset();
  });

  it("returns token and address for a holder with a valid signed challenge", async () => {
    const session = { user: { id: "user_1", role: "HOLDER", name: "alice" } };
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(session);

    verifyChallenge.mockResolvedValue({ account: "GCLIENT", token: "jwt-token" });
    holderWalletUpsert.mockResolvedValue({ id: "wallet_1" });
    holderWalletUpdateMany.mockResolvedValue({ count: 0 });

    const res = await POST(makeRequest({ transaction: "signed-xdr" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ token: "jwt-token", address: "GCLIENT" });
    expect(holderWalletUpsert).toHaveBeenCalledWith({
      where: { userId_address: { userId: "user_1", address: "GCLIENT" } },
      create: {
        userId: "user_1",
        type: "STELLAR_ACCOUNT",
        address: "GCLIENT",
        isDefault: true,
      },
      update: {
        type: "STELLAR_ACCOUNT",
        isDefault: true,
      },
    });
    expect(holderWalletUpdateMany).toHaveBeenCalledWith({
      where: { userId: "user_1", address: { not: "GCLIENT" } },
      data: { isDefault: false },
    });
  });

  it("returns 401 when not authenticated as a holder", async () => {
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await POST(makeRequest({ transaction: "signed-xdr" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid body", async () => {
    const session = { user: { id: "user_1", role: "HOLDER", name: "alice" } };
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(session);

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("propagates verifyChallenge errors", async () => {
    const session = { user: { id: "user_1", role: "HOLDER", name: "alice" } };
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(session);

    verifyChallenge.mockRejectedValue(new Error("bad sig"));

    const res = await POST(makeRequest({ transaction: "signed-xdr" }));
    expect(res.status).toBe(500);
  });
});
