import { MintForm } from "./MintForm";

export const metadata = { title: "Mint New Credential — Zelyo" };

export default function MintPage() {
  return (
    <main className="py-stack-lg">
      <header className="mb-stack-md">
        <p className="font-label text-label-md uppercase text-secondary">Issuer Portal</p>
        <h1 className="font-display text-display-lg text-on-background">Mint New Credential</h1>
      </header>
      <div className="surface-container-lowest border border-outline-variant rounded-lg p-stack-lg manuscript-glow">
        <MintForm />
      </div>
    </main>
  );
}
