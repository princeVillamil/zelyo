import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "@/lib/errors";

vi.mock("@/server/sep8.service", () => ({
  approveTransaction: vi.fn(),
  approveTransactionBodySchema: { safeParse: vi.fn() },
}));

vi.mock("@/lib/ratelimit", () => ({
  limiters: { sep8: {} },
  consumeOrThrow: vi.fn(),
  clientIp: (headers: Headers) =>
    (headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "unknown",
}));

vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));

import { POST } from "./route";
import {
  approveTransaction,
  approveTransactionBodySchema,
} from "@/server/sep8.service";
import { consumeOrThrow } from "@/lib/ratelimit";

const TX = "AAAA...";

const postReq = (body: unknown) =>
  new Request("http://x/api/sep8/approve", {
    method: "POST",
    headers: {
      "x-forwarded-for": "1.1.1.1",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(consumeOrThrow).mockResolvedValue(undefined);
});

describe("POST /api/sep8/approve", () => {
  it("returns an approved SEP-8 response", async () => {
    vi.mocked(approveTransactionBodySchema.safeParse).mockReturnValue({
      success: true,
      data: { tx: TX },
    } as never);
    vi.mocked(approveTransaction).mockResolvedValue({
      status: "approved",
      tx: "SIGNEDXDR",
    });

    const res = await POST(postReq({ tx: TX }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "approved", tx: "SIGNEDXDR" });
    expect(consumeOrThrow).toHaveBeenCalledWith(expect.anything(), "1.1.1.1");
  });

  it("returns a rejected SEP-8 response", async () => {
    vi.mocked(approveTransactionBodySchema.safeParse).mockReturnValue({
      success: true,
      data: { tx: TX },
    } as never);
    vi.mocked(approveTransaction).mockResolvedValue({
      status: "rejected",
      error: "Destination is not Zelyo-verified.",
    });

    const res = await POST(postReq({ tx: TX }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "rejected",
      error: "Destination is not Zelyo-verified.",
    });
  });

  it("returns 400 for an invalid body", async () => {
    vi.mocked(approveTransactionBodySchema.safeParse).mockReturnValue({
      success: false,
      error: {},
    } as never);

    const res = await POST(postReq({ bad: true }));

    expect(res.status).toBe(400);
    expect(approveTransaction).not.toHaveBeenCalled();
  });

  it("propagates 429 from the rate limiter", async () => {
    vi.mocked(consumeOrThrow).mockRejectedValue(
      new AppError("RATE_LIMITED", 429, "Slow down."),
    );

    const res = await POST(postReq({ tx: TX }));

    expect(res.status).toBe(429);
  });
});
