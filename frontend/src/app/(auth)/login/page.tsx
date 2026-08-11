"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { SplashScreen } from "@/components/shared/splash-screen";
import { BrandLogo } from "@/components/shared/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/store/auth-context";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginForm = z.infer<typeof loginSchema>;

const SPLASH_DURATION_MS = 2400;

export default function LoginPage() {
  const { login, session, isLoading } = useAuth();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "admin@llbox.com", password: "admin123" },
  });

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isLoading && session) {
      router.replace("/dashboard");
    }
  }, [session, isLoading, router]);

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    setError("");
    const result = await login(data.email, data.password);
    setLoading(false);
    if (result.requires2FA) {
      router.replace("/verify-2fa");
    } else if (result.success) {
      router.replace("/dashboard");
    } else {
      setError(result.error ?? "Login failed");
    }
  };

  if (isLoading || session) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E5E7EB] border-t-[#111827]" role="status" aria-label="Loading" />
      </div>
    );
  }

  return (
    <>
      <SplashScreen show={showSplash} />

      <div
        className={`rounded-2xl border border-[#E5E7EB] bg-white px-8 py-10 shadow-[var(--shadow-card)] transition-opacity duration-500 ${
          showSplash ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="flex flex-col items-center text-center">
          <div className="mb-8 flex justify-center">
            <BrandLogo height={44} priority />
          </div>
          <h1 className="mb-3 whitespace-nowrap text-xl font-semibold text-[#111827]">
            AI Command Center
          </h1>
          <p className="mb-10 text-sm font-normal text-[#6B7280]">
            Sign in to continue
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="admin@llbox.com" {...register("email")} error={errors.email?.message} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password" className="text-xs font-medium text-[#6B7280] hover:text-[#111827]">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                className="pr-10"
                {...register("password")}
                error={errors.password?.message}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-[#9CA3AF] hover:text-[#6B7280]"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[#EF4444]" role="alert">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </div>
    </>
  );
}
