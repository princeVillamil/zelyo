import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "@/lib/errors";

vi.mock("@/server/sep38.service", () => ({
  getPrices: vi.fn(),
  pricesQuerySchema: { safeParse: vi.fn() },
}));
vi.mock("@/lib/ratelimit", () => ({
  limiters: { sep38: {} },
  consumeOrThrow: vi.fn(),
  clientIp: (headers: Headers) =>
    (headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "unknown",
}));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));

import { GET } from "./route";
import { getPrices, pricesQuerySchema } from "@/server/sep38.service";
import { consumeOrThrow } from "@/lib/ratelimit";

const getReq = (search: string) =>
  new Request(`http://x/api/sep38/prices?${search}`, {
    headers: { "x-forwarded-for": "1.1.1.1" },
  });

const VALID_QUERY = "sell_asset=iso4217%3AUSD&buy_asset=stellar%3Anative";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(consumeOrThrow).mockResolvedValue(undefined);
});

describe("GET /api/sep38/prices", () => {
  it("returns indicative prices", async () => {
    vi.mocked(pricesQuerySchema.safeParse).mockReturnValue({
      success: true,
      data: { sell_asset: "iso4217:USD", buy_asset: "stellar:native" },
    } as never);
    vi.mocked(getPrices).mockResolvedValue({ buy_assets: [{ asset: "stellar:native", price: "0.1" }] });

    const res = await GET(getReq(VALID_QUERY));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ buy_assets: [{ price: "0.1" }] });
    expect(consumeOrThrow).toHaveBeenCalledWith(expect.anything(), "1.1.1.1");
  });

  it("returns 400 for an invalid query", async () => {
    vi.mocked(pricesQuerySchema.safeParse).mockReturnValue({ success: false, error: {} } as never);

    const res = await GET(getReq("sell_asset=bad"));

    expect(res.status).toBe(400);
    expect(getPrices).not.toHaveBeenCalled();
  });

  it("propagates 429 from the rate limiter", async () => {
    vi.mocked(consumeOrThrow).mockRejectedValue(new AppError("RATE_LIMITED", 429, "Slow down."));

    const res = await GET(getReq(VALID_QUERY));

    expect(res.status).toBe(429);
  });
});
