"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { useAuth } from "@/store/auth-context";
import { allNavItems } from "@/lib/navigation";
import { canAccessRoute } from "@/lib/rbac";

function findRoutePermissions(pathname: string) {
  const exact = allNavItems.find((item) => item.href === pathname);
  if (exact) return exact.permissions;
  const nested = allNavItems
    .filter((item) => pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return nested?.permissions;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!isLoading && !session) {
      router.replace("/login");
    }
  }, [session, isLoading, router]);

  useEffect(() => {
    if (!session) return;
    const required = findRoutePermissions(pathname);
    const allowed = canAccessRoute(session.user.permissions, required);
    setDenied(!allowed);
    if (!allowed && pathname !== "/dashboard") {
      router.replace("/dashboard");
    }
  }, [session, pathname, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E5E7EB] border-t-[#111827]" role="status" aria-label="Loading" />
      </div>
    );
  }

  if (!session) return null;

  if (denied && pathname !== "/dashboard") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E5E7EB] border-t-[#111827]" role="status" aria-label="Redirecting" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:pl-[280px]">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="mx-auto max-w-[1600px] p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
