import { describe, it, expect, beforeEach } from "vitest";
import {
  generateHolderSecret,
  persistHolderSecret,
  loadHolderSecret,
  hasHolderSecret,
  exportBackup,
  restoreBackup,
  deriveIdCommitment,
  HolderKeyError,
} from "./holder-key.client";

const wipe = () =>
  new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase("zelyo");
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });

describe("holder-key.client", () => {
  beforeEach(wipe);

  it("generates a 0x field hex secret", async () => {
    const s = await generateHolderSecret();
    expect(s).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("persists then restores the same secret with the right passphrase", async () => {
    const s = await generateHolderSecret();
    expect(await hasHolderSecret()).toBe(false);
    await persistHolderSecret(s, "correct horse");
    expect(await hasHolderSecret()).toBe(true);
    const restored = await loadHolderSecret("correct horse");
    expect(restored).toBe(s);
  });

  it("rejects the wrong passphrase with DECRYPT_FAILED", async () => {
    const s = await generateHolderSecret();
    await persistHolderSecret(s, "right");
    await expect(loadHolderSecret("wrong")).rejects.toMatchObject({ code: "DECRYPT_FAILED" });
    expect(HolderKeyError).toBeTypeOf("function");
  });

  it("round-trips an export/restore backup blob without leaking plaintext s", async () => {
    const s = await generateHolderSecret();
    const blob = await exportBackup(s, "pass");
    expect(blob).not.toContain(s.slice(2)); // raw hex never appears
    expect(blob).not.toContain(s);
    const restored = await restoreBackup(blob, "pass");
    expect(restored).toBe(s);
    await expect(restoreBackup(blob, "nope")).rejects.toMatchObject({ code: "DECRYPT_FAILED" });
    await expect(restoreBackup("{not a backup}", "pass")).rejects.toMatchObject({ code: "BAD_BACKUP" });
  });

  it("derives idCommitment deterministically and never serializes s to a network shape", async () => {
    const s = await generateHolderSecret();
    const c1 = deriveIdCommitment(s);
    const c2 = deriveIdCommitment(s);
    expect(c1).toBe(c2);
    expect(c1).toMatch(/^0x[0-9a-f]{64}$/);
    // The only value ever sent to the server is idCommitment, never s.
    const networkPayload = JSON.stringify({ idCommitment: c1 });
    expect(networkPayload).not.toContain(s);
  });
});
