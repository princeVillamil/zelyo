// @vitest-environment node

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Keypair, Networks, TransactionBuilder } from "@stellar/stellar-sdk";
import { buildChallenge, verifyChallenge } from "@/server/sep10.service";

interface ManageDataOperation {
  type: "manageData";
  source: string;
  name: string;
  value?: Buffer | null;
}

const { serverSecret, clientSecret } = vi.hoisted(() => ({
  serverSecret: "SB7JWGXOY6MURVZEK624RTMK4MD3R73DRZPG37TP4M7ZOXXEURJGSZYI",
  clientSecret: "SDTJJ3YUKFXXV2YQ3NMJ7G4GGRAY6G7XFPZ53DN65HF2NK3L7L7YEY4B",
}));

vi.mock("@/lib/env", () => ({
  env: {
    SEP10_HOME_DOMAIN: "localhost:3000",
    SEP10_SIGNER_SECRET: serverSecret,
    SEP10_CHALLENGE_TTL_SECONDS: 300,
    SEP10_JWT_MAX_AGE_SECONDS: 900,
    SEP10_JWT_SECRET: "test-secret-must-be-at-least-32-characters-long",
    AUTH_SECRET: "fallback-auth-secret-must-be-at-least-32-chars",
    NETWORK_PASSPHRASE: Networks.TESTNET,
  },
}));

const { redisGet, redisSet } = vi.hoisted(() => ({
  redisGet: vi.fn(),
  redisSet: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({
  redis: {
    get: redisGet,
    set: redisSet,
  },
}));

const serverAccount = Keypair.fromSecret(serverSecret).publicKey();
const clientKeypair = Keypair.fromSecret(clientSecret);

describe("sep10.service", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    redisGet.mockReset();
    redisSet.mockReset();
    redisGet.mockResolvedValue(null);
    redisSet.mockResolvedValue("OK");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds a parseable challenge transaction", async () => {
    const xdr = await buildChallenge(clientKeypair.publicKey());
    const tx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET) as import("@stellar/stellar-sdk").Transaction;
    expect(tx.source).toBe(serverAccount);
    expect(tx.sequence).toBe("0");
    expect(tx.operations).toHaveLength(2);

    const domainOp = tx.operations[0] as ManageDataOperation;
    expect(domainOp.type).toBe("manageData");
    expect(domainOp.name).toBe("localhost:3000 auth");
    expect(domainOp.source).toBe(clientKeypair.publicKey());
    expect(domainOp.value?.length).toBe(48);

    const webAuthOp = tx.operations[1] as ManageDataOperation;
    expect(webAuthOp.type).toBe("manageData");
    expect(webAuthOp.name).toBe("web_auth_domain");
    expect(webAuthOp.value?.toString()).toBe("localhost:3000");
  });

  it("rejects invalid client accounts", async () => {
    await expect(buildChallenge("notanaccount")).rejects.toThrow("Account must be a Stellar public key");
  });

  it("verifies a correctly signed challenge and returns a JWT", async () => {
    const xdr = await buildChallenge(clientKeypair.publicKey());
    const tx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET) as import("@stellar/stellar-sdk").Transaction;
    tx.sign(Keypair.fromSecret(clientSecret));
    const signedXdr = tx.toEnvelope().toXDR("base64");

    const result = await verifyChallenge(signedXdr);
    expect(result.account).toBe(clientKeypair.publicKey());
    expect(result.token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(redisSet).toHaveBeenCalledWith(
      expect.stringMatching(/^sep10:nonce:/),
      "1",
      "EX",
      1200,
    );
  });

  it("rejects a challenge missing the client signature", async () => {
    const xdr = await buildChallenge(clientKeypair.publicKey());
    // Server signed, client not signed.
    await expect(verifyChallenge(xdr)).rejects.toThrow("Client signature missing or invalid");
  });

  it("rejects a challenge with a bad client signature", async () => {
    const xdr = await buildChallenge(clientKeypair.publicKey());
    const tx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET) as import("@stellar/stellar-sdk").Transaction;
    const otherKeypair = Keypair.random();
    tx.sign(otherKeypair);
    const signedXdr = tx.toEnvelope().toXDR("base64");

    await expect(verifyChallenge(signedXdr)).rejects.toThrow("Client signature missing or invalid");
  });

  it("rejects an expired challenge", async () => {
    const xdr = await buildChallenge(clientKeypair.publicKey());
    const tx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET) as import("@stellar/stellar-sdk").Transaction;
    tx.sign(Keypair.fromSecret(clientSecret));
    const signedXdr = tx.toEnvelope().toXDR("base64");

    // Advance past the 5-minute TTL.
    vi.advanceTimersByTime(6 * 60 * 1000);

    await expect(verifyChallenge(signedXdr)).rejects.toThrow("Challenge transaction has expired");
  });

  it("rejects a replayed nonce", async () => {
    const xdr = await buildChallenge(clientKeypair.publicKey());
    const tx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET) as import("@stellar/stellar-sdk").Transaction;
    tx.sign(Keypair.fromSecret(clientSecret));
    const signedXdr = tx.toEnvelope().toXDR("base64");

    redisGet.mockResolvedValueOnce(null).mockResolvedValueOnce("1");

    await verifyChallenge(signedXdr);
    await expect(verifyChallenge(signedXdr)).rejects.toThrow("Challenge has already been used");
  });

  it("rejects malformed XDR", async () => {
    await expect(verifyChallenge("not-valid-xdr")).rejects.toThrow("Could not parse signed transaction envelope");
  });
});
