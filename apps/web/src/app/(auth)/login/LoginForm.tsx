"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { credentialsSchema } from "@/lib/validation/auth";
import { Input } from "@/components/Input";
import { FoilStampButton } from "@/components/FoilStampButton";
import type { z } from "zod";

type Values = z.infer<typeof credentialsSchema>;

export function LoginForm() {
  const router = useRouter();
  const callbackUrl = useSearchParams().get("callbackUrl") ?? "/";
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<Values>({
    resolver: zodResolver(credentialsSchema),
  });

  async function onSubmit(values: Values) {
    setError(null);
    const res = await signIn("credentials", { ...values, redirect: false });
    if (res?.error) setError("Invalid credentials.");
    else router.push(callbackUrl);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-stack-lg flex flex-col gap-stack-md">
      <Input label="Username" {...register("username")} />
      <Input label="Password" type="password" {...register("password")} />
      {error && <p className="font-body text-body-md text-error">{error}</p>}
      <FoilStampButton type="submit" disabled={formState.isSubmitting}>
        Enter the Registry
      </FoilStampButton>
      <a href="/register" className="font-label text-label-md uppercase tracking-[0.05em] text-secondary hover:text-primary">
        Create a holder account
      </a>
    </form>
  );
}
