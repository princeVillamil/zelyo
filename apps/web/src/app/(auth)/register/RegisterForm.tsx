"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { registerSchema, type RegisterInput } from "@/lib/validation/auth";
import { Input } from "@/components/Input";
import { FoilStampButton } from "@/components/FoilStampButton";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  async function onSubmit(values: RegisterInput) {
    setError(null);
    const res = await fetch("/api/holder/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { message: string } } | null;
      setError(body?.error?.message ?? "Registration failed.");
      return;
    }
    await signIn("credentials", { ...values, redirect: false });
    router.push("/wallet");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-stack-lg flex flex-col gap-stack-md">
      <Input label="Username" {...register("username")} />
      {formState.errors.username && (
        <p className="font-body text-caption text-error">{formState.errors.username.message}</p>
      )}
      <Input label="Password" type="password" {...register("password")} />
      {formState.errors.password && (
        <p className="font-body text-caption text-error">{formState.errors.password.message}</p>
      )}
      {error && <p className="font-body text-body-md text-error">{error}</p>}
      <FoilStampButton type="submit" disabled={formState.isSubmitting}>
        Open Folio
      </FoilStampButton>
    </form>
  );
}
