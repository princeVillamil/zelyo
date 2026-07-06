"use client";

import { AppError } from "./errors";

export type LaunchtubeSubmitResult = {
  ok: boolean;
  status: number;
  data: unknown;
  creditsRemaining?: number;
};

/**
 * Submit a signed Stellar transaction XDR to the server-side Launchtube relay.
 * The Launchtube JWT never leaves the server.
 */
export async function submitViaLaunchtubeRelay(xdr: string): Promise<LaunchtubeSubmitResult> {
  const res = await fetch("/api/launchtube/submit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ xdr }),
  });

  const data = (await res.json().catch(() => ({ message: "Unknown error" }))) as { error?: { message?: string } };

  if (!res.ok) {
    throw new AppError(
      "LAUNCHTUBE_SUBMIT_FAILED",
      res.status,
      data.error?.message ?? `Launchtube relay failed (${res.status})`,
    );
  }

  return data as unknown as LaunchtubeSubmitResult;
}
