import { MintForm } from "./MintForm";

export const metadata = { title: "Mint New Credential — Zelyo" };

export default function MintPage() {
  return (
    <main className="py-stack-lg">
      <p className="font-label text-[11px] tracking-[0.14em] uppercase text-secondary">Issuer Portal</p>
      <h1 className="font-display text-display-lg text-primary mt-stack-sm">Mint New Credential</h1>
      <p className="mt-stack-sm font-body text-body-md text-on-surface-variant">
        Enter the details of the learner below to begin the cryptographic distillation process.
      </p>
      <div className="mt-stack-lg">
        <MintForm />
      </div>
    </main>
  );
}
