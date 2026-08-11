"use client";

import { DesktopOnlyScreen } from "@/components/shared/desktop-only-screen";
import { useIsDesktop } from "@/hooks/use-is-desktop";

export function DesktopOnlyGate({ children }: { children: React.ReactNode }) {
  const { ready, isDesktop } = useIsDesktop(1024);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white" aria-busy="true">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-[#E5E7EB] border-t-[#111827]"
          role="status"
          aria-label="Loading"
        />
      </div>
    );
  }

  if (!isDesktop) {
    return <DesktopOnlyScreen />;
  }

  return <>{children}</>;
}
