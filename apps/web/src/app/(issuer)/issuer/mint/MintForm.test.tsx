import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MintForm } from "./MintForm";

describe("MintForm", () => {
  it("renders the ledger fields and a single foil-stamp CTA", () => {
    render(<MintForm />);
    expect(screen.getByLabelText(/learner full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/course of study/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/grade/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/issue date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/disclosed predicate|track/i)).toBeInTheDocument();
    const seals = screen.getAllByRole("button", { name: /seal & authorize/i });
    expect(seals).toHaveLength(1);
  });

  it("blocks submit and shows a validation message when required fields are empty", async () => {
    render(<MintForm />);
    fireEvent.click(screen.getByRole("button", { name: /seal & authorize/i }));
    expect(await screen.findAllByText(/required/i)).not.toHaveLength(0);
  });

  it("renders the DATA→HASH→PROOF/ROOT schematic and the mint log console", () => {
    render(<MintForm />);
    expect(screen.getByText(/Fig 1\.1/i)).toBeInTheDocument();
    expect(screen.getByText(/commitment preview/i)).toBeInTheDocument();
    expect(screen.getByTestId("mint-log")).toBeInTheDocument();
  });
});
