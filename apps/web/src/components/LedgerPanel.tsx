export function LedgerPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="ledger-line rounded border border-outline-variant p-stack-md">
      {children}
    </div>
  );
}
