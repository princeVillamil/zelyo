import "server-only";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { redis } from "@/lib/redis";
import { AppError } from "@/lib/errors";
import { isValidSep38AssetId } from "@/lib/assets";

/**
 * SEP-38 Anchor RFQ client.
 * @see https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0038.md
 *
 * Provides indicative prices (GET /prices, cached in Redis) and firm quotes
 * (POST /quote, authenticated + persisted to RampQuote). The anchor is configured
 * via SEP38_ANCHOR_URL / SEP38_API_KEY; without a partner the integration stays
 * mock-backed (see __tests__/sep38.service.test.ts).
 */

const PRICES_CACHE_TTL_SECONDS = 30;

const assetId = z
  .string()
  .min(1)
  .refine(isValidSep38AssetId, { message: "Invalid SEP-38 asset id" });
const amount = z
  .string()
  .regex(/^\d+(\.\d+)?$/, "Amount must be a positive decimal string");
const country = z.string().regex(/^[A-Z]{2,3}$/, "Country must be an ISO-3166 code");

export const pricesQuerySchema = z.object({
  sell_asset: assetId,
  buy_asset: assetId,
  sell_amount: amount.optional(),
  buy_amount: amount.optional(),
  sell_delivery_method: z.string().optional(),
  buy_delivery_method: z.string().optional(),
  country_code: country.optional(),
});

export const postQuoteBodySchema = z
  .object({
    sell_asset: assetId,
    buy_asset: assetId,
    sell_amount: amount.optional(),
    buy_amount: amount.optional(),
    expire_after: z.string().datetime().optional(),
    country: country.optional(),
  })
  .refine((d) => Boolean(d.sell_amount) !== Boolean(d.buy_amount), {
    message: "Exactly one of sell_amount or buy_amount is required",
    path: ["sell_amount"],
  });

export interface Sep38Price {
  asset: string;
  price: string;
  decimals?: number;
  [key: string]: unknown;
}

export interface Sep38PricesResponse {
  buy_assets?: Sep38Price[];
  sell_assets?: Sep38Price[];
  [key: string]: unknown;
}

export interface Sep38Quote {
  id: string;
  expires_at: string;
  price: string;
  total_price: string;
  sell_asset: string;
  buy_asset: string;
  sell_amount: string;
  buy_amount: string;
  fee?: { asset: string; amount: string };
  [key: string]: unknown;
}

function getAnchorConfig(): { baseUrl: string; apiKey?: string } {
  const baseUrl = env.SEP38_ANCHOR_URL;
  if (!baseUrl) {
    throw new AppError(
      "SEP38_NOT_CONFIGURED",
      503,
      "SEP-38 is not configured (SEP38_ANCHOR_URL is missing).",
    );
  }
  const cfg: { baseUrl: string; apiKey?: string } = { baseUrl: baseUrl.replace(/\/+$/, "") };
  if (env.SEP38_API_KEY) cfg.apiKey = env.SEP38_API_KEY;
  return cfg;
}

type AnchorFetchInit = RequestInit & { auth?: boolean };

async function anchorFetch(path: string, init: AnchorFetchInit = {}): Promise<unknown> {
  const { baseUrl, apiKey } = getAnchorConfig();
  const { auth, ...rest } = init;

  const headers = new Headers(rest.headers);
  headers.set("accept", "application/json");
  if (auth) {
    if (!apiKey) {
      throw new AppError(
        "SEP38_NOT_CONFIGURED",
        503,
        "SEP-38 firm quotes require SEP38_API_KEY.",
      );
    }
    headers.set("authorization", `Bearer ${apiKey}`);
  }
  if (rest.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const res = await fetch(`${baseUrl}${path}`, { ...rest, headers });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new AppError(
      "SEP38_ANCHOR_ERROR",
      502,
      `Anchor SEP-38 request failed (${res.status}): ${text.slice(0, 200)}`,
    );
  }
  return res.json();
}

function pricesCacheKey(query: z.infer<typeof pricesQuerySchema>): string {
  const entries = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== "")
    .sort(([a], [b]) => a.localeCompare(b));
  return `sep38:prices:${entries.map(([k, v]) => `${k}=${v}`).join("&")}`;
}

/** Indicative prices from the anchor, cached in Redis for a short TTL. */
export async function getPrices(
  query: z.infer<typeof pricesQuerySchema>,
): Promise<Sep38PricesResponse> {
  const key = pricesCacheKey(query);
  const cached = await redis.get(key);
  if (cached) {
    return JSON.parse(cached) as Sep38PricesResponse;
  }

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== "") params.set(k, v);
  }
  const data = (await anchorFetch(`/prices?${params.toString()}`, {
    method: "GET",
  })) as Sep38PricesResponse;

  await redis.set(key, JSON.stringify(data), "EX", PRICES_CACHE_TTL_SECONDS);
  return data;
}

/** Request a firm (expiring) quote from the anchor and persist it. */
export async function requestQuote(
  body: z.infer<typeof postQuoteBodySchema>,
): Promise<Sep38Quote & { local_id: string }> {
  const data = (await anchorFetch("/quote", {
    method: "POST",
    auth: true,
    body: JSON.stringify(body),
  })) as Sep38Quote;

  if (!data.id || typeof data.id !== "string") {
    throw new AppError("SEP38_ANCHOR_ERROR", 502, "Anchor quote response missing id.");
  }

  const record = await db.rampQuote.create({
    data: {
      anchorQuoteId: data.id,
      sellAsset: data.sell_asset ?? body.sell_asset,
      buyAsset: data.buy_asset ?? body.buy_asset,
      sellAmount: data.sell_amount ?? body.sell_amount ?? null,
      buyAmount: data.buy_amount ?? body.buy_amount ?? null,
      price: data.price ?? null,
      totalPrice: data.total_price ?? null,
      feeAsset: data.fee?.asset ?? null,
      feeAmount: data.fee?.amount ?? null,
      expiresAt: data.expires_at ? new Date(data.expires_at) : null,
      status: "FIRM",
      rawResponse: data as unknown as Prisma.InputJsonValue,
    },
  });

  return { ...data, local_id: record.id };
}

/** Retrieve a previously-requested firm quote by local id or anchor quote id. */
export async function getQuote(id: string): Promise<Sep38Quote & { local_id: string }> {
  const record =
    (await db.rampQuote.findUnique({ where: { id } })) ??
    (await db.rampQuote.findFirst({ where: { anchorQuoteId: id } }));

  if (!record) {
    throw new AppError("NOT_FOUND", 404, "Quote not found.");
  }

  return {
    local_id: record.id,
    id: record.anchorQuoteId ?? record.id,
    expires_at: record.expiresAt?.toISOString() ?? "",
    price: record.price ?? "",
    total_price: record.totalPrice ?? "",
    sell_asset: record.sellAsset,
    buy_asset: record.buyAsset,
    sell_amount: record.sellAmount ?? "",
    buy_amount: record.buyAmount ?? "",
    ...(record.feeAsset && record.feeAmount
      ? { fee: { asset: record.feeAsset, amount: record.feeAmount } }
      : {}),
  };
}
