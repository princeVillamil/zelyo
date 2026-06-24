import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const { handlers, sub } = vi.hoisted(() => {
  const handlers = new Map<string, (channel: string, message: string) => void>();
  const sub = {
    subscribe: vi.fn(async () => undefined),
    on: vi.fn((evt: string, cb: (channel: string, message: string) => void) => handlers.set(evt, cb)),
    unsubscribe: vi.fn(async () => undefined),
    quit: vi.fn(async () => undefined),
  };
  return { handlers, sub };
});
vi.mock("@/lib/redis", () => ({ redisSubscriber: () => sub }));

import { GET } from "./route";
import { auth } from "@/auth";

describe("GET /api/issuer/credentials/mint-log", () => {
  beforeEach(() => { handlers.clear(); vi.clearAllMocks(); });

  it("403 for non-admin", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { role: "HOLDER" } } as never);
    const res = await GET(new Request("http://localhost/api/issuer/credentials/mint-log?jobId=j1"));
    expect(res.status).toBe(403);
  });

  it("422 when jobId is missing", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "a", role: "ADMIN" } } as never);
    const res = await GET(new Request("http://localhost/api/issuer/credentials/mint-log"));
    expect(res.status).toBe(422);
  });

  it("returns an SSE stream subscribed to the job channel for an admin", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "a", role: "ADMIN" } } as never);
    const res = await GET(new Request("http://localhost/api/issuer/credentials/mint-log?jobId=j1"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(sub.subscribe).toHaveBeenCalledWith("zelyo:mintlog:j1");
  });
});
