import { describe, it, expect, vi, beforeEach } from "vitest";

const queryRaw = vi.fn();
const ping = vi.fn();
const getHealth = vi.fn();
vi.mock("@/lib/db", () => ({ db: { $queryRaw: queryRaw } }));
vi.mock("@/lib/redis", () => ({ redis: { ping } }));
vi.mock("@/lib/stellar", () => ({ rpcServer: { getHealth } }));

describe("GET /api/health", () => {
  beforeEach(() => { queryRaw.mockReset(); ping.mockReset(); getHealth.mockReset(); });

  it("200 when all dependencies are healthy", async () => {
    queryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);
    ping.mockResolvedValueOnce("PONG");
    getHealth.mockResolvedValueOnce({ status: "healthy" });
    const { GET } = await import("../route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ status: "ok", checks: { db: true, redis: true, rpc: true } });
  });

  it("503 when a dependency fails", async () => {
    queryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);
    ping.mockRejectedValueOnce(new Error("down"));
    getHealth.mockResolvedValueOnce({ status: "healthy" });
    const { GET } = await import("../route");
    const res = await GET();
    expect(res.status).toBe(503);
    expect((await res.json()).checks.redis).toBe(false);
  });
});
