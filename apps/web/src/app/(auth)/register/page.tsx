import { RegisterForm } from "./RegisterForm";

export default function RegisterPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-margin-mobile">
      <p className="font-label text-label-md uppercase tracking-[0.05em] text-secondary">
        Identity Folio
      </p>
      <h1 className="mt-stack-sm font-display text-headline-md text-primary">Open a folio</h1>
      <RegisterForm />
    </main>
  );
}
