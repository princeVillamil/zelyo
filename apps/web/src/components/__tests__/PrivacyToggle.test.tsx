import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PrivacyToggle } from "../PrivacyToggle";

const attributes = {
  learnerName: "Ada Lovelace",
  courseName: "Distributed Systems",
  grade: "A+",
  track: "Data Engineering",
  issueDate: "2026-01-15",
};
const disclosed = { track: "Data Engineering" };

function renderToggle(props: Partial<Parameters<typeof PrivacyToggle>[0]> = {}) {
  return render(
    <PrivacyToggle
      attributes={attributes}
      disclosed={disclosed}
      boundAddress="0xcafebabe"
      nullifier="0xdeadbeef"
      {...props}
    />,
  );
}

describe("PrivacyToggle", () => {
  it("defaults to the Zelyo view: disclosed value only, everything else hidden", () => {
    renderToggle();
    expect(screen.getByText(/what zelyo reveals/i)).toBeInTheDocument();
    expect(screen.getByText(/“Data Engineering”/)).toBeInTheDocument();
    expect(screen.queryByText("A+")).not.toBeInTheDocument();
    expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();
    expect(screen.getAllByText(/\[hidden\]/i).length).toBeGreaterThan(0);
  });

  it("reveals the full credential on the normal-platform side", () => {
    renderToggle();
    fireEvent.click(screen.getByRole("tab", { name: /a normal platform sees/i }));
    expect(screen.getByText(/“Ada Lovelace”/)).toBeInTheDocument();
    expect(screen.getByText(/“A\+”/)).toBeInTheDocument();
    expect(screen.getByText(/stored in their database/i)).toBeInTheDocument();
  });

  it("degrades to the privacy summary without a toggle when no credential is linked", () => {
    renderToggle({ attributes: null });
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getByText(/your privacy summary/i)).toBeInTheDocument();
    expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();
  });
});
