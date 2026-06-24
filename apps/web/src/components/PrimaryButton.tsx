import type { ButtonHTMLAttributes } from "react";

export function PrimaryButton({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded bg-primary px-stack-md py-3 font-label text-label-md uppercase tracking-[0.05em] text-background transition-colors duration-200 hover:bg-primary-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}
