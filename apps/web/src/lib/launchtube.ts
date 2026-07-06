import "server-only";
import { env } from "./env";
import { AppError } from "./errors";

export type LaunchtubeResult = {
  ok: boolean;
  status: number;
  data: unknown;
  creditsRemaining?: number | undefined;
};

export class LaunchtubeError extends Error {
  constructor(
    public readonly code: "NOT_CONFIGURED" | "SUBMIT_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "LaunchtubeError";
  }
}

export function isLaunchtubeEnabled(): boolean {
  return env.LAUNCHTUBE_ENABLED && Boolean(env.LAUNCHTUBE_URL && env.LAUNCHTUBE_JWT);
}

/**
 * Submit a pre-built, signed Stellar transaction XDR to Launchtube for fee sponsorship.
 * @see https://github.com/stellar/launchtube
 */
export async function submitViaLaunchtube(signedXdr: string): Promise<LaunchtubeResult> {
  if (!isLaunchtubeEnabled()) {
    throw new LaunchtubeError("NOT_CONFIGURED", "Launchtube fee sponsorship is not configured.");
  }

  const url = env.LAUNCHTUBE_URL!;
  const jwt = env.LAUNCHTUBE_JWT!;

  const params = new URLSearchParams();
  params.set("xdr", signedXdr);
  params.set("sim", "true");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Bearer ${jwt}`,
    },
    body: params.toString(),
  });

  const creditsRemaining = parseInt(res.headers.get("X-Credits-Remaining") ?? "", 10) || undefined;
  const data = (await res.json().catch(() => null)) as unknown;

  if (!res.ok) {
    throw new AppError(
      "LAUNCHTUBE_FAILED",
      502,
      `Launchtube submission failed (${res.status}): ${JSON.stringify(data)}`,
    );
  }

  return { ok: true, status: res.status, data, creditsRemaining };
}
