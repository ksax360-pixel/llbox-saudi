"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface ViewLinkProps {
  href: string;
  label?: string;
  className?: string;
}

export function ViewLink({ href, label = "View", className }: ViewLinkProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#6B7280] transition-colors hover:bg-[#F8F9FA] hover:text-[#111827]",
        className
      )}
    >
      <Eye className="h-4 w-4" />
    </Link>
  );
}
