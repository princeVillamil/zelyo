import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "@/lib/errors";

vi.mock("@/server/sep12.service", () => ({
  getCustomer: vi.fn(),
  putCustomer: vi.fn(),
  getCustomerQuerySchema: { safeParse: vi.fn() },
  putCustomerBodySchema: { safeParse: vi.fn() },
}));
vi.mock("@/lib/ratelimit", () => ({
  limiters: { sep12: {} },
  consumeOrThrow: vi.fn(),
  clientIp: (headers: Headers) => (headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "unknown",
}));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));

import { GET, PUT } from "./route";
import { getCustomer, putCustomer, getCustomerQuerySchema, putCustomerBodySchema } from "@/server/sep12.service";
import { consumeOrThrow } from "@/lib/ratelimit";

const ACCOUNT = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";

const getReq = (search: string) =>
  new Request(`http://x/api/sep12/customer?${search}`, { headers: { "x-forwarded-for": "1.1.1.1" } });
const putReq = (body: unknown) =>
  new Request("http://x/api/sep12/customer", {
    method: "PUT",
    headers: { "x-forwarded-for": "1.1.1.1", "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(consumeOrThrow).mockResolvedValue(undefined);
});

describe("GET /api/sep12/customer", () => {
  it("returns customer status", async () => {
    vi.mocked(getCustomerQuerySchema.safeParse).mockReturnValue({ success: true, data: { account: ACCOUNT } } as never);
    vi.mocked(getCustomer).mockResolvedValue({ id: "c1", status: "ACCEPTED" });

    const res = await GET(getReq(`account=${ACCOUNT}`));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: "c1", status: "ACCEPTED" });
    expect(consumeOrThrow).toHaveBeenCalledWith(expect.anything(), "1.1.1.1");
  });

  it("returns 400 for invalid query", async () => {
    vi.mocked(getCustomerQuerySchema.safeParse).mockReturnValue({ success: false, error: {} } as never);

    const res = await GET(getReq("account=bad"));

    expect(res.status).toBe(400);
    expect(getCustomer).not.toHaveBeenCalled();
  });

  it("propagates 429 from rate limiter", async () => {
    vi.mocked(consumeOrThrow).mockRejectedValue(new AppError("RATE_LIMITED", 429, "Slow down."));

    const res = await GET(getReq(`account=${ACCOUNT}`));

    expect(res.status).toBe(429);
  });
});

describe("PUT /api/sep12/customer", () => {
  it("creates/updates a customer", async () => {
    vi.mocked(putCustomerBodySchema.safeParse).mockReturnValue({ success: true, data: { account: ACCOUNT, verification_id: "v1" } } as never);
    vi.mocked(putCustomer).mockResolvedValue({ id: "c1", status: "ACCEPTED" });

    const res = await PUT(putReq({ account: ACCOUNT, verification_id: "v1" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: "c1", status: "ACCEPTED" });
  });

  it("returns 400 for invalid body", async () => {
    vi.mocked(putCustomerBodySchema.safeParse).mockReturnValue({ success: false, error: {} } as never);

    const res = await PUT(putReq({ account: "bad" }));

    expect(res.status).toBe(400);
    expect(putCustomer).not.toHaveBeenCalled();
  });
});
