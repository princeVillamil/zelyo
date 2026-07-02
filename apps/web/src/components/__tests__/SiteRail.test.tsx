import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteRail } from "../SiteRail";

let pathname = "/jobs";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

// Board / Help (and role links) render in both the mobile strip and the desktop rail,
// so assert on counts rather than a single element.
describe("SiteRail", () => {
  it("always shows the Board link, the Zelyo wordmark, and Help", () => {
    render(<SiteRail role={null} username={null} />);
    expect(screen.getAllByRole("link", { name: "Board" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Zelyo" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Help" }).length).toBeGreaterThan(0);
  });

  it("shows Sign in and Register when signed out — never Sign out", () => {
    render(<SiteRail role={null} username={null} />);
    expect(screen.getAllByRole("link", { name: "Sign in" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Register" }).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Sign out/)).not.toBeInTheDocument();
  });

  it("shows Wallet (not Issuer) and the username for a HOLDER", () => {
    render(<SiteRail role="HOLDER" username="alice" />);
    expect(screen.getAllByRole("link", { name: "Wallet" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Issuer" })).not.toBeInTheDocument();
    expect(screen.getByText("alice")).toBeInTheDocument();
  });

  it("shows Issuer (not Wallet) for an ADMIN", () => {
    render(<SiteRail role="ADMIN" username="root" />);
    expect(screen.getAllByRole("link", { name: "Issuer" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Wallet" })).not.toBeInTheDocument();
  });

  it("marks the active section link with aria-current on a child route", () => {
    pathname = "/wallet/keys";
    render(<SiteRail role="HOLDER" username="alice" />);
    const wallet = screen.getAllByRole("link", { name: "Wallet" });
    expect(wallet.some((l) => l.getAttribute("aria-current") === "page")).toBe(true);
    pathname = "/jobs";
  });
});
