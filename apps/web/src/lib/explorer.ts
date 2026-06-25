import { env } from "./env";

/** Build a Stellar testnet explorer URL for a transaction hash. Trailing-slash-safe. */
export function explorerTxUrl(txHash: string): string {
  const base = (env.NEXT_PUBLIC_EXPLORER_BASE ?? "").replace(/\/+$/, "");
  return `${base}/tx/${txHash}`;
}
