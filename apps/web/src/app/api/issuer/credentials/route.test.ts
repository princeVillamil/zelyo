import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/ratelimit", () => ({ rateLimit: vi.fn(async () => ({ ok: true, retryAfter: 0 })) }));
vi.mock("@/server/credential.service", () => ({
  mintCredential: vi.fn(async () => ({ id: "cred1", leafIndex: 0, merkleRootHex: "0x" + "11".repeat(32), vcFileKey: "vc/cred1.json" })),
}));
vi.mock("@/lib/db", () => ({
  db: { credential: { findMany: vi.fn(async () => []), count: vi.fn(async () => 0) } },
}));

import { POST, GET } from "./route";
import { auth } from "@/auth";
import { mintCredential } from "@/server/credential.service";
import { rateLimit } from "@/lib/ratelimit";

const adminSession = { user: { id: "admin1", role: "ADMIN", username: "admin" } };

function req(body: unknown): Request {
  return new Request("http://localhost/api/issuer/credentials", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "10.0.0.1" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  holder: { username: "ada" },
  attributes: { track: "Data Engineering", grade: "A", issueDate: "2026-06-23", courseName: "DS", learnerName: "Ada" },
};

describe("POST /api/issuer/credentials", () => {
  beforeEach(() => vi.clearAllMocks());

  it("403 for non-admin", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "u", role: "HOLDER" } } as never);
    const res = await POST(req(validBody));
    expect(res.status).toBe(403);
  });

  it("401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await POST(req(validBody));
    expect(res.status).toBe(401);
  });

  it("422 on invalid body", async () => {
    vi.mocked(auth).mockResolvedValue(adminSession as never);
    const res = await POST(req({ holder: {}, attributes: {} }));
    expect(res.status).toBe(422);
  });

  it("429 when rate-limited with Retry-After", async () => {
    vi.mocked(auth).mockResolvedValue(adminSession as never);
    vi.mocked(rateLimit).mockResolvedValueOnce({ ok: false, retryAfter: 30 });
    const res = await POST(req(validBody));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
  });

  it("200 mints and returns the summary for an admin", async () => {
    vi.mocked(auth).mockResolvedValue(adminSession as never);
    const res = await POST(req(validBody));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ id: "cred1", leafIndex: 0 });
    expect(mintCredential).toHaveBeenCalledWith(
      expect.objectContaining({ holder: { username: "ada" } }),
      expect.objectContaining({ actorUserId: "admin1", ip: "10.0.0.1" }),
    );
  });
});

describe("GET /api/issuer/credentials", () => {
  it("403 for non-admin", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { role: "HOLDER" } } as never);
    const res = await GET(new Request("http://localhost/api/issuer/credentials"));
    expect(res.status).toBe(403);
  });
});
