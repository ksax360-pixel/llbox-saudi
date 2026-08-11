"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { DesktopOnlyGate } from "@/components/shared/desktop-only-gate";
import { ToastProvider } from "@/components/ui/toast";
import { AuthProvider } from "@/store/auth-context";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60 * 1000, refetchOnWindowFocus: false },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <DesktopOnlyGate>{children}</DesktopOnlyGate>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
