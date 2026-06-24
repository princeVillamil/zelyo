import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-margin-mobile">
      <p className="font-label text-label-md uppercase tracking-[0.05em] text-secondary">
        The Zelyo Registry
      </p>
      <h1 className="mt-stack-sm font-display text-headline-md text-primary">Sign in</h1>
      <p className="mt-stack-sm font-body text-body-md italic text-on-surface-variant">
        Enter your credentials to access the registry.
      </p>
      {/* useSearchParams() in LoginForm needs a Suspense boundary to prerender. */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
