import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,TESTQR"),
  },
}));

import { ProofQr } from "../ProofQr";

describe("ProofQr", () => {
  it("renders a placeholder while generating, then the QR image with the receipt URL", async () => {
    render(<ProofQr url="https://zelyo.test/verify/result/tx1" />);

    expect(screen.getByLabelText(/generating qr code/i)).toBeInTheDocument();

    const img = await screen.findByRole("img", {
      name: /https:\/\/zelyo\.test\/verify\/result\/tx1/i,
    });
    expect(img).toHaveAttribute("src", "data:image/png;base64,TESTQR");
  });
});
