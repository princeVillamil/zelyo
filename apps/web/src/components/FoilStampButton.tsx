"use client";
import type { ButtonHTMLAttributes } from "react";

export function FoilStampButton({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`foil-stamp inline-flex items-center justify-center rounded px-stack-md py-3 font-label text-label-md uppercase tracking-[0.05em] text-on-primary transition-transform duration-200 hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-fixed disabled:opacity-60 ${className}`}
    >
      <span className="relative z-10">{children}</span>
    </button>
  );
}
