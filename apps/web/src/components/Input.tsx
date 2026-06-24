"use client";
import { useId, type InputHTMLAttributes } from "react";

type InputProps = { label: string; name: string } & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "name"
>;

export function Input({ label, name, className = "", ...props }: InputProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-stack-sm">
      <label
        htmlFor={id}
        className="font-label text-label-md uppercase tracking-[0.05em] text-secondary peer-focus:text-primary"
      >
        {label}
      </label>
      <input
        id={id}
        name={name}
        className={`peer w-full border-0 border-b border-outline bg-transparent px-0 py-2 font-body text-body-lg text-on-surface focus:border-primary focus:outline-none focus:ring-0 ${className}`}
        {...props}
      />
    </div>
  );
}
