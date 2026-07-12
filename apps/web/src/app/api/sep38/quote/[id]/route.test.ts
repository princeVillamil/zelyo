import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "@/lib/errors";

vi.mock("@/server/sep38.service", () => ({
  getQuote: vi.fn(),
}));
vi.mock("@/lib/ratelimit", () => ({
  limiters: { sep38: {} },
  consumeOrThrow: vi.fn(),
  clientIp: (headers: Headers) =>
    (headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "unknown",
}));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));

import { GET } from "./route";
import { getQuote } from "@/server/sep38.service";
import { consumeOrThrow } from "@/lib/ratelimit";

const getReq = () =>
  new Request("http://x/api/sep38/quote/local-1", {
    headers: { "x-forwarded-for": "1.1.1.1" },
  });

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(consumeOrThrow).mockResolvedValue(undefined);
});

describe("GET /api/sep38/quote/[id]", () => {
  it("returns a persisted quote", async () => {
    vi.mocked(getQuote).mockResolvedValue({
      local_id: "local-1",
      id: "anchor-q-1",
      sell_asset: "iso4217:USD",
      buy_asset: "stellar:native",
    } as never);

    const res = await GET(getReq(), ctx("local-1"));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ local_id: "local-1", id: "anchor-q-1" });
    expect(getQuote).toHaveBeenCalledWith("local-1");
  });

  it("returns 404 when the quote is missing", async () => {
    vi.mocked(getQuote).mockRejectedValue(new AppError("NOT_FOUND", 404, "Quote not found."));

    const res = await GET(getReq(), ctx("missing"));

    expect(res.status).toBe(404);
  });

  it("propagates 429 from the rate limiter", async () => {
    vi.mocked(consumeOrThrow).mockRejectedValue(new AppError("RATE_LIMITED", 429, "Slow down."));

    const res = await GET(getReq(), ctx("local-1"));

    expect(res.status).toBe(429);
  });
});
