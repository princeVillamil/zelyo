import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "@/lib/errors";

vi.mock("@/server/sep38.service", () => ({
  requestQuote: vi.fn(),
  postQuoteBodySchema: { safeParse: vi.fn() },
}));
vi.mock("@/lib/ratelimit", () => ({
  limiters: { sep38: {} },
  consumeOrThrow: vi.fn(),
  clientIp: (headers: Headers) =>
    (headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "unknown",
}));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));
vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { POST } from "./route";
import { requestQuote, postQuoteBodySchema } from "@/server/sep38.service";
import { consumeOrThrow } from "@/lib/ratelimit";
import { auth } from "@/auth";

const postReq = (body: unknown) =>
  new Request("http://x/api/sep38/quote", {
    method: "POST",
    headers: { "x-forwarded-for": "1.1.1.1", "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const VALID_BODY = { sell_asset: "iso4217:USD", buy_asset: "stellar:native", sell_amount: "100" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(consumeOrThrow).mockResolvedValue(undefined);
  vi.mocked(auth).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as never);
});

describe("POST /api/sep38/quote", () => {
  it("creates a firm quote for an ADMIN session", async () => {
    vi.mocked(postQuoteBodySchema.safeParse).mockReturnValue({
      success: true,
      data: VALID_BODY,
    } as never);
    vi.mocked(requestQuote).mockResolvedValue({
      id: "anchor-q-1",
      local_id: "local-1",
      sell_asset: "iso4217:USD",
      buy_asset: "stellar:native",
    } as never);

    const res = await POST(postReq(VALID_BODY));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: "anchor-q-1", local_id: "local-1" });
    expect(requestQuote).toHaveBeenCalledWith(VALID_BODY);
  });

  it("returns 401 when there is no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const res = await POST(postReq(VALID_BODY));

    expect(res.status).toBe(401);
    expect(requestQuote).not.toHaveBeenCalled();
  });

  it("returns 401 for a non-ADMIN session", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "h-1", role: "HOLDER" } } as never);

    const res = await POST(postReq(VALID_BODY));

    expect(res.status).toBe(401);
    expect(requestQuote).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid body", async () => {
    vi.mocked(postQuoteBodySchema.safeParse).mockReturnValue({ success: false, error: {} } as never);

    const res = await POST(postReq({ sell_asset: "bad" }));

    expect(res.status).toBe(400);
    expect(requestQuote).not.toHaveBeenCalled();
  });

  it("propagates 429 from the rate limiter", async () => {
    vi.mocked(consumeOrThrow).mockRejectedValue(new AppError("RATE_LIMITED", 429, "Slow down."));

    const res = await POST(postReq(VALID_BODY));

    expect(res.status).toBe(429);
  });
});
