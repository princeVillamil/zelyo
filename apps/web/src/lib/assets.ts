/**
 * Canonical Stellar/fiat asset reference and SEP-38 asset-id formatting.
 *
 * Zelyo represents assets inline as `{ code, issuer }` with the convention that
 * an empty-string issuer means native XLM (see lib/stellar.ts, jobgate.service.ts).
 * SEP-38 uses a URI-style asset identification format:
 *   - native XLM:        "stellar:native"
 *   - Stellar asset:     "stellar:<CODE>:<ISSUER>"
 *   - off-chain fiat:    "iso4217:<CODE>"  (e.g. "iso4217:USD")
 *   - other schemes:     "<scheme>:<identifier>" (passed through)
 *
 * This helper is shared by SEP-38 now and by the Anchor Platform / Circle /
 * MoneyGram integrations later, so asset conversion lives in one place.
 * @see https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0038.md#asset-identification-format
 */

export interface StellarAssetRef {
  code: string;
  /** Empty string (or omitted) denotes native XLM. */
  issuer?: string;
}

const STELLAR_NATIVE = "stellar:native";
const STELLAR_SCHEME = "stellar";
const ISO4217_SCHEME = "iso4217";

export function isNativeAsset(ref: StellarAssetRef): boolean {
  return !ref.issuer || ref.issuer.length === 0;
}

/** Convert a Zelyo `{ code, issuer }` ref into a SEP-38 asset id string. */
export function toSep38AssetId(ref: StellarAssetRef): string {
  if (isNativeAsset(ref)) return STELLAR_NATIVE;
  return `${STELLAR_SCHEME}:${ref.code}:${ref.issuer}`;
}

export interface ParsedSep38Asset {
  scheme: string;
  /** Asset code (e.g. "USDC", "USD", "native"). */
  code: string;
  /** Stellar issuer G... when scheme === "stellar" and not native; otherwise null. */
  issuer: string | null;
}

/** Parse a SEP-38 asset id into its components. */
export function parseSep38AssetId(id: string): ParsedSep38Asset {
  const parts = id.split(":");
  const scheme = parts[0] ?? "";

  if (scheme === STELLAR_SCHEME) {
    if (id === STELLAR_NATIVE) {
      return { scheme, code: "native", issuer: null };
    }
    // stellar:CODE:ISSUER (issuers are base32, so no ":" appears; join defensively)
    const code = parts[1] ?? "";
    const issuer = parts.slice(2).join(":") || null;
    return { scheme, code, issuer };
  }

  if (scheme === ISO4217_SCHEME) {
    return { scheme, code: parts[1] ?? "", issuer: null };
  }

  // Unknown/other scheme: keep the remainder as the identifier in `code`.
  return { scheme, code: parts.slice(1).join(":"), issuer: null };
}

/**
 * Lightweight validation: a SEP-38 asset id must be "<scheme>:<rest>" with
 * non-empty scheme and identifier. Stellar assets must include an issuer unless
 * they are the native sentinel.
 */
export function isValidSep38AssetId(id: string): boolean {
  if (!id || typeof id !== "string") return false;
  const idx = id.indexOf(":");
  if (idx <= 0 || idx === id.length - 1) return false;
  if (id === STELLAR_NATIVE) return true;
  const parsed = parseSep38AssetId(id);
  if (parsed.scheme === STELLAR_SCHEME) {
    return Boolean(parsed.code && parsed.issuer);
  }
  return Boolean(parsed.code);
}
