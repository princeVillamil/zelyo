import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { env } from "@/lib/env";
import { computeScope } from "@zelyo/zk-shared";
import { handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(_req: Request): Promise<Response> {
  try {
    const dir = join(process.cwd(), "public", "circuit");
    const acir = await readFile(join(dir, "zelyo_credential.json"));
    const abi = JSON.parse(acir.toString("utf8")) as { abi?: unknown };
    const hash = "0x" + createHash("sha256").update(acir).digest("hex");
    const scope = computeScope(env.ZK_SCOPE_APP_ID, env.NETWORK_PASSPHRASE, env.CREDENTIAL_REGISTRY_CONTRACT_ID);
    return Response.json({
      artifact: {
        acirUrl: `${env.CIRCUIT_ARTIFACT_BASE}/zelyo_credential.json`,
        vkeyUrl: `${env.CIRCUIT_ARTIFACT_BASE}/vk`,
      },
      hash,
      abi: abi.abi ?? null,
      scope,
      scopeParams: {
        appId: env.ZK_SCOPE_APP_ID,
        chainId: env.NETWORK_PASSPHRASE,
        registryId: env.CREDENTIAL_REGISTRY_CONTRACT_ID,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
