import "server-only";
import {
  Account,
  Keypair,
  Transaction,
  TransactionBuilder,
  Operation,
  BASE_FEE,
} from "@stellar/stellar-sdk";
import { env } from "@/lib/env";
import { redis } from "@/lib/redis";
import { AppError } from "@/lib/errors";

const WEB_AUTH_DOMAIN_KEY = "web_auth_domain";

/** Lazily build the SEP-10 ManageData key from the configured home domain.
 *  This must not run at module load time, because `env` parsing would fail
 *  during `next build` when server secrets are not available. */
function homeDomainKey(): string {
  return `${env.SEP10_HOME_DOMAIN} auth`;
}

/** Load and validate the SEP-10 server signer key at runtime. */
function getSep10Signer(): Keypair {
  const secret = env.SEP10_SIGNER_SECRET;
  if (!secret) {
    throw new AppError("SEP10_NOT_CONFIGURED", 500, "SEP-10 signer secret is not configured.");
  }
  return Keypair.fromSecret(secret);
}

/** Read the SEP-10 JWT secret, falling back to AUTH_SECRET. */
function jwtSecret(): ArrayBuffer {
  const raw = env.SEP10_JWT_SECRET || env.AUTH_SECRET;
  return new TextEncoder().encode(raw).buffer as ArrayBuffer;
}

/** URL-safe Base64 encode without padding. */
function b64u(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
  const base64 = Buffer.from(bytes).toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Build a compact JWS (HS256) JWT for SEP-10. */
async function buildSep10Jwt(account: string, nonce: Buffer): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const maxAge = env.SEP10_JWT_MAX_AGE_SECONDS;
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    sub: account,
    iat: now,
    exp: now + maxAge,
    jti: nonce.toString("hex"),
  };

  const encodedHeader = b64u(new TextEncoder().encode(JSON.stringify(header)));
  const encodedPayload = b64u(new TextEncoder().encode(JSON.stringify(payload)));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    "raw",
    jwtSecret(),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput));

  return `${signingInput}.${b64u(signature)}`;
}

/** Extract the 48-byte nonce from a SEP-10 challenge transaction. */
function extractNonce(tx: Transaction): Buffer {
  const key = homeDomainKey();
  const nonceOp = tx.operations.find((op) => {
    if (op.type !== "manageData") return false;
    const md = op as ManageDataOperation;
    return md.name === key;
  }) as ManageDataOperation | undefined;
  if (!nonceOp || !nonceOp.value || nonceOp.value.length !== 48) {
    throw new AppError("INVALID_CHALLENGE", 400, "Challenge missing valid nonce.");
  }
  return nonceOp.value;
}

interface ManageDataOperation {
  type: "manageData";
  source: string;
  name: string;
  value?: Buffer | null;
}

/** Redis key for consumed nonces. */
function nonceKey(nonceHex: string): string {
  return `sep10:nonce:${nonceHex}`;
}

/**
 * Build a SEP-10 authentication challenge transaction.
 * @see https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md
 */
export async function buildChallenge(clientAccount: string): Promise<string> {
  if (!clientAccount.startsWith("G") || clientAccount.length !== 56) {
    throw new AppError("INVALID_ACCOUNT", 400, "Account must be a Stellar public key.");
  }

  const signer = getSep10Signer();
  const serverAccount = signer.publicKey();
  const nonce = crypto.getRandomValues(new Uint8Array(48));
  const now = Math.floor(Date.now() / 1000);
  const ttl = env.SEP10_CHALLENGE_TTL_SECONDS;

  // SEP-10 challenge tx: source is server signer, sequence 0, timebounds now..now+ttl,
  // with ManageData ops for domain auth and web_auth_domain.
  // NOTE: TransactionBuilder internally increments the source sequence by 1, so we
  // pass "-1" to end up with a transaction whose sequence is "0".
  const tx = new TransactionBuilder(
    new Account(serverAccount, "-1"),
    {
      fee: BASE_FEE,
      networkPassphrase: env.NETWORK_PASSPHRASE,
      timebounds: { minTime: now, maxTime: now + ttl },
    },
  )
    .addOperation(
      Operation.manageData({
        name: homeDomainKey(),
        value: Buffer.from(nonce),
        source: clientAccount,
      }),
    )
    .addOperation(
      Operation.manageData({
        name: WEB_AUTH_DOMAIN_KEY,
        value: env.SEP10_HOME_DOMAIN,
        source: serverAccount,
      }),
    )
    .build();

  tx.sign(signer);
  return tx.toEnvelope().toXDR("base64");
}

/**
 * Verify a signed SEP-10 challenge transaction and return the authenticated
 * Stellar account plus a SEP-10 JWT.
 */
export async function verifyChallenge(signedXdr: string): Promise<{ account: string; token: string }> {
  if (!signedXdr || typeof signedXdr !== "string") {
    throw new AppError("INVALID_INPUT", 400, "Signed transaction XDR is required.");
  }

  const signer = getSep10Signer();
  const serverAccount = signer.publicKey();

  let tx: Transaction;
  try {
    tx = TransactionBuilder.fromXDR(signedXdr, env.NETWORK_PASSPHRASE) as Transaction;
  } catch {
    throw new AppError("INVALID_XDR", 400, "Could not parse signed transaction envelope.");
  }

  // 1. Must be a simple transaction, not fee-bump.
  if ("innerTransaction" in tx) {
    throw new AppError("UNSUPPORTED_TX", 400, "Fee-bump transactions are not supported.");
  }

  // 2. Source account must be the server signer and sequence 0.
  if (tx.source !== serverAccount) {
    throw new AppError("INVALID_CHALLENGE", 400, "Challenge source account mismatch.");
  }
  if (tx.sequence !== "0") {
    throw new AppError("INVALID_CHALLENGE", 400, "Challenge sequence must be 0.");
  }

  // 3. Validate timebounds.
  const now = Math.floor(Date.now() / 1000);
  const timebounds = tx.timeBounds;
  if (!timebounds || now < Number(timebounds.minTime) || now > Number(timebounds.maxTime)) {
    throw new AppError("CHALLENGE_EXPIRED", 400, "Challenge transaction has expired.");
  }

  // 4. Validate ManageData operations.
  const domainKey = homeDomainKey();
  const domainOp = tx.operations.find((op) => {
    if (op.type !== "manageData") return false;
    const md = op as ManageDataOperation;
    return md.name === domainKey && md.source !== serverAccount;
  }) as ManageDataOperation | undefined;
  if (!domainOp) {
    throw new AppError("INVALID_CHALLENGE", 400, "Challenge missing domain auth operation.");
  }
  const clientAccount = domainOp.source;
  if (!clientAccount || (!clientAccount.startsWith("G") || clientAccount.length !== 56)) {
    throw new AppError("INVALID_CHALLENGE", 400, "Invalid client account in challenge.");
  }

  const webAuthOp = tx.operations.find((op) => {
    if (op.type !== "manageData") return false;
    const md = op as ManageDataOperation;
    return md.name === WEB_AUTH_DOMAIN_KEY && md.source === serverAccount;
  }) as ManageDataOperation | undefined;
  if (!webAuthOp || webAuthOp.value?.toString() !== env.SEP10_HOME_DOMAIN) {
    throw new AppError("INVALID_CHALLENGE", 400, "Challenge web_auth_domain mismatch.");
  }

  // 5. Verify server signature.
  const serverSigValid = tx.signatures.some((sig) =>
    signer.verify(tx.hash(), sig.signature() as Buffer),
  );
  if (!serverSigValid) {
    throw new AppError("INVALID_SIGNATURE", 400, "Server signature missing or invalid.");
  }

  // 6. Verify client signature.
  const clientKeypair = Keypair.fromPublicKey(clientAccount);
  const clientSigValid = tx.signatures.some((sig) =>
    clientKeypair.verify(tx.hash(), sig.signature() as Buffer),
  );
  if (!clientSigValid) {
    throw new AppError("INVALID_SIGNATURE", 400, "Client signature missing or invalid.");
  }

  // 7. Replay protection: nonce must not have been consumed.
  const nonce = extractNonce(tx);
  const nonceHex = nonce.toString("hex");
  const consumed = await redis.get(nonceKey(nonceHex));
  if (consumed) {
    throw new AppError("CHALLENGE_REPLAY", 400, "Challenge has already been used.");
  }

  // 8. Mark nonce consumed for ttl + max_age to prevent late replays.
  const ttl = env.SEP10_CHALLENGE_TTL_SECONDS;
  const maxAge = env.SEP10_JWT_MAX_AGE_SECONDS;
  await redis.set(nonceKey(nonceHex), "1", "EX", ttl + maxAge);

  // 9. Issue SEP-10 JWT.
  const token = await buildSep10Jwt(clientAccount, nonce);
  return { account: clientAccount, token };
}
