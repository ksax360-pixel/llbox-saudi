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
import { mockResetPassword } from "@/lib/auth";
import { useAuth } from "@/store/auth-context";

const schema = z.object({
  password: z.string().min(8, "Minimum 8 characters"),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, { message: "Passwords don't match", path: ["confirmPassword"] });

export default function ResetPasswordPage() {
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<{ password: string; confirmPassword: string }>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (!isLoading && session) {
      router.replace("/dashboard");
    }
  }, [session, isLoading, router]);

  const onSubmit = async (data: { password: string }) => {
    setLoading(true);
    await mockResetPassword("token", data.password);
    setLoading(false);
    router.push("/login");
  };

  if (isLoading || session) {
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
        <h1 className="text-2xl font-semibold text-[#111827]">Reset password</h1>
        <p className="mt-1 text-sm text-[#6B7280]">Create a new password for your account</p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input id="password" type="password" {...register("password")} error={errors.password?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input id="confirmPassword" type="password" {...register("confirmPassword")} error={errors.confirmPassword?.message} />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Resetting..." : "Reset password"}
        </Button>
      </form>
      <Link href="/login" className="mt-4 block text-center text-sm text-[#6B7280] hover:text-[#111827]">
        Back to login
      </Link>
    </div>
  );
}
