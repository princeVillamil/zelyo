export default function NotFound() {
  return (
    <main className="mx-auto max-w-[1120px] px-margin-mobile py-stack-lg md:px-margin-page">
      <p className="font-label text-label-md uppercase text-secondary">Verification Record</p>
      <h1 className="font-display text-headline-md text-on-background mt-stack-sm">
        No record for this transaction
      </h1>
      <p className="font-body text-body-md text-on-surface-variant mt-stack-md">
        We have no verification mirrored for that hash. It may not have been submitted, or the
        transaction is still settling.
      </p>
    </main>
  );
}
