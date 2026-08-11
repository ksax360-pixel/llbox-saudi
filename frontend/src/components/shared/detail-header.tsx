"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DetailHeaderProps {
  backHref: string;
  backLabel?: string;
  title: string;
  description?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function DetailHeader({
  backHref,
  backLabel = "Back",
  title,
  description,
  badge,
  actions,
  className,
}: DetailHeaderProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <Button variant="ghost" size="sm" asChild className="-ml-2 text-[#6B7280]">
        <Link href={backHref}>
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
      </Button>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-[#111827]">{title}</h1>
            {badge}
          </div>
          {description && <p className="text-sm text-[#6B7280]">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
