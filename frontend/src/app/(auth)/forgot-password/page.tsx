"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, CheckCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { BrandLogo } from "@/components/shared/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mockForgotPassword } from "@/lib/auth";
import { useAuth } from "@/store/auth-context";

const schema = z.object({ email: z.string().email("Enter a valid email") });

export default function ForgotPasswordPage() {
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<{ email: string }>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (!isLoading && session) {
      router.replace("/dashboard");
    }
  }, [session, isLoading, router]);

  const onSubmit = async (data: { email: string }) => {
    setLoading(true);
    await mockForgotPassword(data.email);
    setLoading(false);
    setSent(true);
  };

  if (isLoading || session) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E5E7EB] border-t-[#111827]" role="status" aria-label="Loading" />
      </div>
    );
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-8 text-center shadow-[var(--shadow-card)]">
        <CheckCircle className="mx-auto mb-4 h-12 w-12 text-[#10B981]" />
        <h1 className="text-xl font-semibold text-[#111827]">Check your email</h1>
        <p className="mt-2 text-sm text-[#6B7280]">We sent a password reset link to your email address.</p>
        <Link href="/login" className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-[#111827] hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to login
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-8 shadow-[var(--shadow-card)]">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex justify-center">
          <BrandLogo height={44} />
        </div>
        <h1 className="text-2xl font-semibold text-[#111827]">Forgot password</h1>
        <p className="mt-1 text-sm text-[#6B7280]">Enter your email to receive a reset link</p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...register("email")} error={errors.email?.message} />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Sending..." : "Send reset link"}
        </Button>
      </form>
      <Link href="/login" className="mt-4 flex items-center justify-center gap-1 text-sm text-[#6B7280] hover:text-[#111827]">
        <ArrowLeft className="h-4 w-4" /> Back to login
      </Link>
    </div>
  );
}
