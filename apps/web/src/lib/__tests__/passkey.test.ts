import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateWallet = vi.fn();
const mockConnectWallet = vi.fn();
const mockSign = vi.fn();

function MockPasskeyKit() {
  return {
    createWallet: mockCreateWallet,
    connectWallet: mockConnectWallet,
    sign: mockSign,
  };
}

vi.mock("passkey-kit", () => ({
  PasskeyKit: MockPasskeyKit,
}));

vi.mock("../../lib/env", () => ({
  env: {
    NEXT_PUBLIC_PASSKEY_KIT_RPC_URL: "https://soroban-testnet.stellar.org",
    NEXT_PUBLIC_PASSKEY_KIT_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
    NEXT_PUBLIC_PASSKEY_KIT_WALLET_WASM_HASH: "abcdef",
  },
}));

import {
  clearStoredPasskey,
  connectPasskey,
  getStoredPasskey,
  registerPasskey,
  signWithPasskey,
} from "../passkey";

describe("passkey client", () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(store).forEach((k) => delete store[k]);
    Object.defineProperty(global, "localStorage", {
      value: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => {
          store[k] = v;
        },
        removeItem: (k: string) => {
          delete store[k];
        },
        clear: () => {
          Object.keys(store).forEach((k) => delete store[k]);
        },
      },
      writable: true,
    });
    Object.defineProperty(global, "PublicKeyCredential", { value: {}, writable: true });
  });

  it("registers a passkey and stores the credential", async () => {
    mockCreateWallet.mockResolvedValue({
      keyIdBase64: "kid-1",
      contractId: "C123",
    });

    const cred = await registerPasskey("Zelyo", "holder@example.com");

    expect(cred).toEqual({ keyIdBase64: "kid-1", contractId: "C123" });
    expect(getStoredPasskey()).toEqual(cred);
  });

  it("connects an existing passkey from storage without prompting", async () => {
    localStorage.setItem("zelyo:passkey", JSON.stringify({ keyIdBase64: "kid-1", contractId: "C123" }));

    const cred = await connectPasskey();

    expect(cred).toEqual({ keyIdBase64: "kid-1", contractId: "C123" });
    expect(mockConnectWallet).not.toHaveBeenCalled();
  });

  it("prompts to connect when no credential is stored", async () => {
    mockConnectWallet.mockResolvedValue({
      keyIdBase64: "kid-2",
      contractId: "C456",
    });

    const cred = await connectPasskey();

    expect(mockConnectWallet).toHaveBeenCalled();
    expect(cred).toEqual({ keyIdBase64: "kid-2", contractId: "C456" });
  });

  it("clears stored passkey", () => {
    localStorage.setItem("zelyo:passkey", JSON.stringify({ keyIdBase64: "kid-1", contractId: "C123" }));
    clearStoredPasskey();
    expect(getStoredPasskey()).toBeNull();
  });

  it("signs a transaction with the stored passkey", async () => {
    localStorage.setItem("zelyo:passkey", JSON.stringify({ keyIdBase64: "kid-1", contractId: "C123" }));
    mockSign.mockResolvedValue("signed-tx");

    const result = await signWithPasskey("tx-xdr" as never);

    expect(result).toBe("signed-tx");
    expect(mockSign).toHaveBeenCalledWith("tx-xdr", { keyId: "kid-1" });
  });
});
