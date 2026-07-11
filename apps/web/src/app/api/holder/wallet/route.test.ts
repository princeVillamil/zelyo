import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PUT, DELETE } from "@/app/api/holder/wallet/route";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

const {
  holderWalletFindMany,
  holderWalletUpsert,
  holderWalletUpdateMany,
  holderWalletFindFirst,
  holderWalletDelete,
} = vi.hoisted(() => ({
  holderWalletFindMany: vi.fn(),
  holderWalletUpsert: vi.fn(),
  holderWalletUpdateMany: vi.fn(),
  holderWalletFindFirst: vi.fn(),
  holderWalletDelete: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    holderWallet: {
      findMany: holderWalletFindMany,
      upsert: holderWalletUpsert,
      updateMany: holderWalletUpdateMany,
      findFirst: holderWalletFindFirst,
      delete: holderWalletDelete,
    },
  },
}));

vi.mock("@/lib/ratelimit", () => ({
  limiters: { holderWallet: {} },
  consumeOrThrow: vi.fn(),
  clientIp: () => "127.0.0.1",
}));

vi.mock("@/lib/audit", () => ({
  audit: vi.fn(),
}));

import { auth } from "@/auth";

const session = { user: { id: "user_1", role: "HOLDER", name: "alice" } };

function makeRequest(method: string, body?: unknown, query?: string): Request {
  const init: RequestInit = {
    method,
    headers: { "content-type": "application/json" },
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  return new Request(`http://localhost/api/holder/wallet${query ?? ""}`, init);
}

describe("GET /api/holder/wallet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(session);
    holderWalletFindMany.mockReset();
  });

  it("returns wallets ordered by default then createdAt", async () => {
    const wallets = [
      { id: "w1", address: "G...", isDefault: true },
      { id: "w2", address: "C...", isDefault: false },
    ];
    holderWalletFindMany.mockResolvedValue(wallets);

    const res = await GET(makeRequest("GET"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.wallets).toEqual(wallets);
    expect(holderWalletFindMany).toHaveBeenCalledWith({
      where: { userId: "user_1" },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
  });

  it("returns 401 when not authenticated as holder", async () => {
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await GET(makeRequest("GET"));
    expect(res.status).toBe(401);
  });
});

describe("PUT /api/holder/wallet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(session);
    holderWalletUpsert.mockReset();
    holderWalletUpdateMany.mockReset();
    holderWalletUpsert.mockResolvedValue({ id: "w1", address: "G...", isDefault: true });
    holderWalletUpdateMany.mockResolvedValue({ count: 0 });
  });

  it("upserts a stellar account wallet", async () => {
    const body = {
      type: "STELLAR_ACCOUNT",
      address: `G${"A".repeat(55)}`,
      makeDefault: true,
    };

    const res = await PUT(makeRequest("PUT", body));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.wallet).toBeDefined();
    expect(holderWalletUpsert).toHaveBeenCalledWith({
      where: { userId_address: { userId: "user_1", address: body.address } },
      create: {
        userId: "user_1",
        type: "STELLAR_ACCOUNT",
        address: body.address,
        credentialId: null,
        isDefault: true,
      },
      update: {
        type: "STELLAR_ACCOUNT",
        credentialId: null,
        isDefault: true,
      },
    });
    expect(holderWalletUpdateMany).toHaveBeenCalled();
  });

  it("upserts a passkey smart wallet", async () => {
    const body = {
      type: "PASSKEY_SMART_WALLET",
      address: `C${"A".repeat(55)}`,
      credentialId: "cred-id",
      makeDefault: false,
    };

    holderWalletUpsert.mockResolvedValue({ id: "w2", address: body.address, isDefault: false });

    const res = await PUT(makeRequest("PUT", body));
    expect(res.status).toBe(200);
    expect(holderWalletUpdateMany).not.toHaveBeenCalled();
  });

  it("rejects invalid addresses", async () => {
    const res = await PUT(
      makeRequest("PUT", { type: "STELLAR_ACCOUNT", address: "invalid" }),
    );
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/holder/wallet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(session);
    holderWalletFindFirst.mockReset();
    holderWalletDelete.mockReset();
  });

  it("deletes the wallet if it belongs to the holder", async () => {
    holderWalletFindFirst.mockResolvedValue({ id: "w1", address: "G...", type: "STELLAR_ACCOUNT" });

    const res = await DELETE(makeRequest("DELETE", undefined, "?id=w1"));
    expect(res.status).toBe(200);
    expect(holderWalletDelete).toHaveBeenCalledWith({ where: { id: "w1" } });
  });

  it("returns 404 for wallets not owned by the holder", async () => {
    holderWalletFindFirst.mockResolvedValue(null);

    const res = await DELETE(makeRequest("DELETE", undefined, "?id=w1"));
    expect(res.status).toBe(404);
  });
});
