import { beforeEach, describe, expect, it, vi } from "vitest";

const { listGates, getGate, claimGate, enforceRateLimit, audit } = vi.hoisted(() => ({
  listGates: vi.fn(),
  getGate: vi.fn(),
  claimGate: vi.fn(),
  enforceRateLimit: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("../../../../server/jobgate.service", () => ({ listGates, getGate, claimGate }));
vi.mock("../../../../lib/rate-limit", () => ({
  enforceRateLimit,
  clientIp: (_headers: Headers) => "1.2.3.4",
}));
vi.mock("../../../../lib/audit", () => ({ audit }));

import { GET as listRoute } from "../gates/route";
import { GET as detailRoute } from "../gates/[slug]/route";
import { POST as claimRoute } from "../gates/[slug]/claim/route";

beforeEach(() => {
  for (const m of [listGates, getGate, claimGate, enforceRateLimit, audit]) m.mockReset();
  enforceRateLimit.mockResolvedValue(undefined);
});

const claimReq = (body: unknown) =>
  new Request("http://localhost/api/jobboard/gates/data-engineering/claim", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "1.2.3.4" },
    body: JSON.stringify(body),
  });

describe("jobboard routes", () => {
  it("GET gates returns the list", async () => {
    listGates.mockResolvedValue([
      { slug: "data-engineering", title: "T", description: "D", requiredPredicate: { attribute: "track", equals: "Data Engineering" }, rewardType: "CLAIMABLE_BALANCE" },
    ]);
    const res = await listRoute();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ gates: [{ slug: "data-engineering" }] });
  });

  it("GET gate 404s for unknown slug", async () => {
    getGate.mockResolvedValue(null);
    const res = await detailRoute(new Request("http://localhost"), { params: Promise.resolve({ slug: "nope" }) });
    expect(res.status).toBe(404);
  });

  it("POST claim validates body and calls claimGate, rate-limited", async () => {
    claimGate.mockResolvedValue({ txHash: "CBTX", rewardType: "CLAIMABLE_BALANCE" });
    const body = { nullifierHex: "0xdeadbeef", boundAddress: "G" + "A".repeat(55), txHash: "tx1" };
    const res = await claimRoute(claimReq(body), { params: Promise.resolve({ slug: "data-engineering" }) });
    expect(enforceRateLimit).toHaveBeenCalledWith("claim", "1.2.3.4");
    expect(claimGate).toHaveBeenCalledWith("data-engineering", "0xdeadbeef", "G" + "A".repeat(55), "tx1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ txHash: "CBTX", rewardType: "CLAIMABLE_BALANCE" });
    expect(audit).toHaveBeenCalled();
  });

  it("POST claim rejects an invalid body with 400", async () => {
    const res = await claimRoute(claimReq({ nullifierHex: "bad" }), { params: Promise.resolve({ slug: "data-engineering" }) });
    expect(res.status).toBe(400);
    expect(claimGate).not.toHaveBeenCalled();
  });
});
