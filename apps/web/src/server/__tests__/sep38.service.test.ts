import { beforeEach, describe, expect, it, vi } from "vitest";

const { envState, rampCreate, rampFindUnique, rampFindFirst, redisGet, redisSet } = vi.hoisted(() => ({
  envState: {
    SEP38_ANCHOR_URL: "https://anchor.test" as string | undefined,
    SEP38_API_KEY: "test-key" as string | undefined,
  },
  rampCreate: vi.fn(),
  rampFindUnique: vi.fn(),
  rampFindFirst: vi.fn(),
  redisGet: vi.fn(),
  redisSet: vi.fn(),
}));

vi.mock("../../lib/db", () => ({
  db: {
    rampQuote: {
      create: rampCreate,
      findUnique: rampFindUnique,
      findFirst: rampFindFirst,
    },
  },
}));

vi.mock("../../lib/env", () => ({ env: envState }));

vi.mock("../../lib/redis", () => ({
  redis: { get: redisGet, set: redisSet },
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import { getPrices, getQuote, requestQuote } from "../sep38.service";
import { AppError } from "@/lib/errors";

function okJson(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}
function errResp(status: number, text = "boom") {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(text),
  };
}

const PRICES_QUERY = { sell_asset: "iso4217:USD", buy_asset: "stellar:native" };
const QUOTE_BODY = { sell_asset: "iso4217:USD", buy_asset: "stellar:native", sell_amount: "100" };

beforeEach(() => {
  envState.SEP38_ANCHOR_URL = "https://anchor.test";
  envState.SEP38_API_KEY = "test-key";
  rampCreate.mockReset();
  rampFindUnique.mockReset();
  rampFindFirst.mockReset();
  redisGet.mockReset();
  redisSet.mockReset();
  fetchMock.mockReset();
  redisGet.mockResolvedValue(null);
  redisSet.mockResolvedValue("OK");
});

describe("getPrices", () => {
  it("fetches from the anchor and caches the result when the cache is empty", async () => {
    fetchMock.mockResolvedValueOnce(okJson({ buy_assets: [{ asset: "stellar:native", price: "0.1" }] }));

    const res = await getPrices(PRICES_QUERY);

    expect(res.buy_assets?.[0]?.price).toBe("0.1");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://anchor.test/prices?sell_asset=iso4217%3AUSD&buy_asset=stellar%3Anative",
      expect.objectContaining({ method: "GET" }),
    );
    expect(redisSet).toHaveBeenCalledWith(
      expect.stringContaining("sep38:prices:"),
      expect.any(String),
      "EX",
      30,
    );
  });

  it("returns the cached value without calling the anchor", async () => {
    redisGet.mockResolvedValueOnce(JSON.stringify({ buy_assets: [{ asset: "x", price: "1" }] }));

    const res = await getPrices(PRICES_QUERY);

    expect(res.buy_assets?.[0]?.price).toBe("1");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws SEP38_ANCHOR_ERROR on a non-2xx anchor response", async () => {
    fetchMock.mockResolvedValueOnce(errResp(500));

    await expect(getPrices(PRICES_QUERY)).rejects.toMatchObject({ code: "SEP38_ANCHOR_ERROR" });
  });

  it("throws SEP38_NOT_CONFIGURED when the anchor URL is missing", async () => {
    envState.SEP38_ANCHOR_URL = undefined;

    await expect(getPrices(PRICES_QUERY)).rejects.toMatchObject({ code: "SEP38_NOT_CONFIGURED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("requestQuote", () => {
  it("posts with bearer auth and persists the quote", async () => {
    fetchMock.mockResolvedValueOnce(
      okJson({
        id: "anchor-q-1",
        expires_at: "2026-07-10T12:00:00.000Z",
        price: "0.1",
        total_price: "0.101",
        sell_asset: "iso4217:USD",
        buy_asset: "stellar:native",
        sell_amount: "100",
        buy_amount: "1000",
        fee: { asset: "iso4217:USD", amount: "1" },
      }),
    );
    rampCreate.mockResolvedValueOnce({ id: "local-1" });

    const res = await requestQuote(QUOTE_BODY);

    expect(res.id).toBe("anchor-q-1");
    expect(res.local_id).toBe("local-1");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://anchor.test/quote");
    expect((init.headers as Headers).get("authorization")).toBe("Bearer test-key");
    expect(rampCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          anchorQuoteId: "anchor-q-1",
          status: "FIRM",
          feeAsset: "iso4217:USD",
          feeAmount: "1",
        }),
      }),
    );
  });

  it("throws when the anchor response is missing an id", async () => {
    fetchMock.mockResolvedValueOnce(okJson({ price: "0.1" }));

    await expect(requestQuote(QUOTE_BODY)).rejects.toMatchObject({ code: "SEP38_ANCHOR_ERROR" });
    expect(rampCreate).not.toHaveBeenCalled();
  });

  it("throws SEP38_NOT_CONFIGURED when the API key is missing", async () => {
    envState.SEP38_API_KEY = undefined;

    await expect(requestQuote(QUOTE_BODY)).rejects.toMatchObject({ code: "SEP38_NOT_CONFIGURED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("getQuote", () => {
  it("returns a persisted quote by local id", async () => {
    rampFindUnique.mockResolvedValueOnce({
      id: "local-1",
      anchorQuoteId: "anchor-q-1",
      sellAsset: "iso4217:USD",
      buyAsset: "stellar:native",
      sellAmount: "100",
      buyAmount: "1000",
      price: "0.1",
      totalPrice: "0.101",
      feeAsset: null,
      feeAmount: null,
      expiresAt: new Date("2026-07-10T12:00:00.000Z"),
      status: "FIRM",
    });

    const res = await getQuote("local-1");

    expect(res.local_id).toBe("local-1");
    expect(res.id).toBe("anchor-q-1");
    expect(res.expires_at).toBe("2026-07-10T12:00:00.000Z");
    expect(res.fee).toBeUndefined();
  });

  it("falls back to an anchorQuoteId lookup", async () => {
    rampFindUnique.mockResolvedValueOnce(null);
    rampFindFirst.mockResolvedValueOnce({
      id: "local-2",
      anchorQuoteId: "anchor-q-9",
      sellAsset: "iso4217:USD",
      buyAsset: "stellar:native",
      sellAmount: null,
      buyAmount: "5",
      price: "1",
      totalPrice: "1",
      feeAsset: null,
      feeAmount: null,
      expiresAt: null,
      status: "FIRM",
    });

    const res = await getQuote("anchor-q-9");

    expect(res.local_id).toBe("local-2");
    expect(res.expires_at).toBe("");
  });

  it("throws NOT_FOUND when the quote does not exist", async () => {
    rampFindUnique.mockResolvedValueOnce(null);
    rampFindFirst.mockResolvedValueOnce(null);

    await expect(getQuote("nope")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
