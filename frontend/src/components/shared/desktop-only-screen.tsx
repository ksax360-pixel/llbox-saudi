"use client";

import { Laptop } from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { DotPattern } from "@/components/ui/dot-pattern";
import { cn } from "@/lib/utils";

export function DesktopOnlyScreen() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white px-6 py-16">
      <DotPattern
        className={cn(
          "fill-neutral-400/40",
          "[mask-image:radial-gradient(500px_circle_at_center,white,transparent)]"
        )}
      />

      <div className="relative z-10 flex w-full max-w-lg flex-col items-center text-center">
        <div className="mb-10">
          <BrandLogo height={40} priority />
        </div>

        <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-[#F8F9FA]">
          <Laptop className="h-7 w-7 text-[#6B7280]" aria-hidden="true" />
        </div>

        <p className="mb-2 max-w-md text-sm font-normal leading-relaxed text-[#6B7280]">
          Please access the platform from a desktop or laptop device.
        </p>
        <p className="max-w-md text-sm font-normal leading-relaxed text-[#6B7280]" dir="rtl" lang="ar">
          يرجى استخدام جهاز كمبيوتر مكتبي أو محمول للوصول إلى المنصة.
        </p>
      </div>
    </div>
  );
}
