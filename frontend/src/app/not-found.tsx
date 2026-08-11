"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white p-6 text-center">
      <p className="text-sm font-medium text-[#9CA3AF]">404</p>
      <h1 className="text-2xl font-semibold text-[#111827]">Page not found</h1>
      <p className="max-w-sm text-sm text-[#6B7280]">
        This page may have been moved or removed. Go back to the dashboard to continue.
      </p>
      <Button asChild>
        <Link href="/dashboard">Go to Dashboard</Link>
      </Button>
    </div>
  );
}
