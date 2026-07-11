import { describe, it, expect, vi, beforeEach } from "vitest";

const createWallet = vi.fn();
const connectWallet = vi.fn();
const sign = vi.fn();

vi.mock("passkey-kit", () => ({
  PasskeyKit: class MockPasskeyKit {
    createWallet = createWallet;
    connectWallet = connectWallet;
    sign = sign;
  },
}));

import {
  isPasskeySupported,
  isPasskitConfigured,
  loadStoredPasskeyWallet,
  clearStoredPasskeyWallet,
  registerPasskeyWallet,
  connectPasskeyWallet,
  signWithPasskey,
} from "@/lib/passkey.client";

describe("passkey.client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createWallet.mockReset();
    connectWallet.mockReset();
    sign.mockReset();

    // Reset localStorage mock
    Object.defineProperty(window, "localStorage", {
      writable: true,
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
    });
  });

  describe("isPasskeySupported", () => {
    it("returns true when PublicKeyCredential and credentials are available", () => {
      Object.defineProperty(window, "PublicKeyCredential", { value: vi.fn(), writable: true });
      Object.defineProperty(navigator, "credentials", { value: {}, writable: true });
      expect(isPasskeySupported()).toBe(true);
    });

    it("returns false when PublicKeyCredential is missing", () => {
      Object.defineProperty(window, "PublicKeyCredential", { value: undefined, writable: true });
      expect(isPasskeySupported()).toBe(false);
    });
  });

  describe("isPasskitConfigured", () => {
    it("returns true when all required public env vars are set and SEP45_ENABLED is true", () => {
      process.env.NEXT_PUBLIC_PASSKEY_KIT_RPC_URL = "https://rpc";
      process.env.NEXT_PUBLIC_PASSKEY_KIT_NETWORK_PASSPHRASE = "passphrase";
      process.env.NEXT_PUBLIC_PASSKEY_KIT_WALLET_WASM_HASH = "hash";
      process.env.NEXT_PUBLIC_SEP45_ENABLED = "true";
      expect(isPasskitConfigured()).toBe(true);
    });

    it("returns false when SEP45_ENABLED is not true", () => {
      process.env.NEXT_PUBLIC_PASSKEY_KIT_RPC_URL = "https://rpc";
      process.env.NEXT_PUBLIC_PASSKEY_KIT_NETWORK_PASSPHRASE = "passphrase";
      process.env.NEXT_PUBLIC_PASSKEY_KIT_WALLET_WASM_HASH = "hash";
      process.env.NEXT_PUBLIC_SEP45_ENABLED = "false";
      expect(isPasskitConfigured()).toBe(false);
    });
  });

  describe("registerPasskeyWallet", () => {
    it("creates a wallet and stores it in localStorage", async () => {
      Object.defineProperty(window, "PublicKeyCredential", { value: vi.fn(), writable: true });
      Object.defineProperty(navigator, "credentials", { value: {}, writable: true });

      createWallet.mockResolvedValue({
        keyIdBase64: "key-id",
        contractId: "CONTRACTIDCONTRACTIDCONTRACTIDCONTRACTIDCONTRACT",
      });

      const wallet = await registerPasskeyWallet("Zelyo", "user@example.com");

      expect(wallet).toEqual({
        keyIdBase64: "key-id",
        contractId: "CONTRACTIDCONTRACTIDCONTRACTIDCONTRACTIDCONTRACT",
      });
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        "zelyo:passkey-wallet",
        JSON.stringify(wallet),
      );
    });

    it("throws when passkeys are not supported", async () => {
      Object.defineProperty(window, "PublicKeyCredential", { value: undefined, writable: true });
      await expect(registerPasskeyWallet("Zelyo", "user")).rejects.toThrow(
        "Passkeys are not supported",
      );
    });
  });

  describe("connectPasskeyWallet", () => {
    it("returns the stored wallet without prompting when available", async () => {
      const stored = {
        keyIdBase64: "stored-key",
        contractId: "STOREDCONTRACTIDCONTRACTIDCONTRACTIDCONTRACTID",
      };
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(stored));

      const wallet = await connectPasskeyWallet();
      expect(wallet).toEqual(stored);
      expect(connectWallet).not.toHaveBeenCalled();
    });

    it("prompts WebAuthn when no wallet is stored", async () => {
      Object.defineProperty(window, "PublicKeyCredential", { value: vi.fn(), writable: true });
      Object.defineProperty(navigator, "credentials", { value: {}, writable: true });

      connectWallet.mockResolvedValue({
        keyIdBase64: "key-id",
        contractId: "CONTRACTIDCONTRACTIDCONTRACTIDCONTRACTIDCONTRACT",
      });

      await connectPasskeyWallet();
      expect(connectWallet).toHaveBeenCalled();
    });
  });

  describe("signWithPasskey", () => {
    it("throws when no wallet is stored", async () => {
      await expect(signWithPasskey("tx-xdr")).rejects.toThrow("No passkey wallet connected");
    });

    it("signs a transaction with the stored keyId", async () => {
      const stored = {
        keyIdBase64: "stored-key",
        contractId: "STOREDCONTRACTIDCONTRACTIDCONTRACTIDCONTRACTID",
      };
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(stored));

      sign.mockResolvedValue({
        toEnvelope: () => ({
          toXDR: (fmt: string) => `signed-${fmt}`,
        }),
      });

      const signed = await signWithPasskey("tx-xdr");
      expect(signed).toBe("signed-base64");
      expect(sign).toHaveBeenCalledWith("tx-xdr", { keyId: "stored-key" });
    });
  });

  describe("loadStoredPasskeyWallet / clearStoredPasskeyWallet", () => {
    it("loads and clears stored wallets", () => {
      const stored = {
        keyIdBase64: "key",
        contractId: "CONTRACTIDCONTRACTIDCONTRACTIDCONTRACTIDCONTRACT",
      };
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(stored));

      expect(loadStoredPasskeyWallet()).toEqual(stored);
      clearStoredPasskeyWallet();
      expect(window.localStorage.removeItem).toHaveBeenCalledWith("zelyo:passkey-wallet");
    });

    it("returns null for invalid stored data", () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue("not-json");
      expect(loadStoredPasskeyWallet()).toBeNull();
      expect(window.localStorage.removeItem).toHaveBeenCalledWith("zelyo:passkey-wallet");
    });
  });
});
