import "server-only";
import { ChannelsClient } from "@openzeppelin/relayer-plugin-channels";
import { env } from "./env";

export interface ChannelsSubmitResult {
  /** Transaction hash returned by the relayer / underlying RPC submission. */
  hash: string;
  /** Optional status field echoed by the relayer. */
  status?: string;
  /** The relayer returns the underlying submission response; keep the type loose. */
  [key: string]: unknown;
}

function getChannelsConfig(): { url: string; apiKey: string } {
  const url = env.CHANNELS_URL;
  const apiKey = env.CHANNELS_API_KEY;
  if (!url || !apiKey) {
    throw new Error(
      "Channels fee sponsorship is enabled (USE_CHANNELS=true) but CHANNELS_URL or CHANNELS_API_KEY is missing.",
    );
  }
  return { url, apiKey };
}

/**
 * Submit a signed transaction XDR to OpenZeppelin Stellar Channels for fee-sponsored
 * network submission.
 *
 * The relayer accepts a pre-signed envelope via `submitTransaction({ xdr })` and pays
 * the transaction fee from a channel account. The response contains the underlying
 * RPC/Horizon submission result; we require a `hash` string to identify the transaction.
 */
export async function submitSponsored(txXdr: string): Promise<ChannelsSubmitResult> {
  const { url, apiKey } = getChannelsConfig();

  const client = new ChannelsClient({ baseUrl: url, apiKey });
  const data = await client.submitTransaction({ xdr: txXdr });

  if (!data.hash || typeof data.hash !== "string") {
    throw new Error("Channels response did not include a transaction hash.");
  }
  return data as unknown as ChannelsSubmitResult;
}
