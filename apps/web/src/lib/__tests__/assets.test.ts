import { describe, expect, it } from "vitest";
import {
  isNativeAsset,
  isValidSep38AssetId,
  parseSep38AssetId,
  toSep38AssetId,
} from "../assets";

const ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

describe("assets", () => {
  it("treats empty/omitted issuer as native XLM", () => {
    expect(isNativeAsset({ code: "XLM", issuer: "" })).toBe(true);
    expect(isNativeAsset({ code: "XLM" })).toBe(true);
    expect(isNativeAsset({ code: "USDC", issuer: ISSUER })).toBe(false);
  });

  it("formats SEP-38 asset ids", () => {
    expect(toSep38AssetId({ code: "XLM", issuer: "" })).toBe("stellar:native");
    expect(toSep38AssetId({ code: "USDC", issuer: ISSUER })).toBe(`stellar:USDC:${ISSUER}`);
  });

  it("parses SEP-38 asset ids", () => {
    expect(parseSep38AssetId("stellar:native")).toEqual({ scheme: "stellar", code: "native", issuer: null });
    expect(parseSep38AssetId(`stellar:USDC:${ISSUER}`)).toEqual({
      scheme: "stellar",
      code: "USDC",
      issuer: ISSUER,
    });
    expect(parseSep38AssetId("iso4217:USD")).toEqual({ scheme: "iso4217", code: "USD", issuer: null });
  });

  it("validates SEP-38 asset ids", () => {
    expect(isValidSep38AssetId("stellar:native")).toBe(true);
    expect(isValidSep38AssetId(`stellar:USDC:${ISSUER}`)).toBe(true);
    expect(isValidSep38AssetId("iso4217:USD")).toBe(true);
    expect(isValidSep38AssetId("")).toBe(false);
    expect(isValidSep38AssetId("nocolon")).toBe(false);
    expect(isValidSep38AssetId("stellar:USDC")).toBe(false); // missing issuer
    expect(isValidSep38AssetId("stellar:")).toBe(false);
  });
});
