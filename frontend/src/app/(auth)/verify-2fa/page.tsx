"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { BrandLogo } from "@/components/shared/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/store/auth-context";

const schema = z.object({
  code: z.string().length(6, "Enter the 6-digit code"),
});

export default function Verify2FAPage() {
  const { verify2FA, pendingSession, session, isLoading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<{ code: string }>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (isLoading || verifying) return;
    if (session) {
      router.replace("/dashboard");
      return;
    }
    if (!pendingSession) {
      router.replace("/login");
    }
  }, [session, pendingSession, isLoading, verifying, router]);

  const onSubmit = async (data: { code: string }) => {
    setLoading(true);
    setVerifying(true);
    setError("");
    const result = await verify2FA(data.code);
    setLoading(false);
    if (result.success) {
      router.replace("/dashboard");
    } else {
      setVerifying(false);
      setError(result.error ?? "Verification failed");
    }
  };

  if (isLoading || !pendingSession || session) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E5E7EB] border-t-[#111827]" role="status" aria-label="Loading" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-8 shadow-[var(--shadow-card)]">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex justify-center">
          <BrandLogo height={44} />
        </div>
        <p className="text-sm text-[#6B7280]">Enter the 6-digit code from your authenticator app</p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="code">Verification code</Label>
          <Input id="code" placeholder="Enter 6-digit code" maxLength={6} autoComplete="one-time-code" {...register("code")} error={errors.code?.message} />
        </div>
        {error && <p className="text-sm text-[#EF4444]" role="alert">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Verifying..." : "Verify"}
        </Button>
      </form>
      <Link href="/login" className="mt-4 block text-center text-sm text-[#6B7280] hover:text-[#111827]">
        Back to login
      </Link>
    </div>
  );
}
