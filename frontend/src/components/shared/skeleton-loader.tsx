import { cn } from "@/lib/utils";

export function SkeletonLoader({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-lg bg-[#F3F4F6]", className)}
      role="status"
      aria-label="Loading"
    />
  );
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3">
      <SkeletonLoader className="h-10 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonLoader key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function KpiSkeleton() {
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
      <SkeletonLoader className="mb-3 h-4 w-24" />
      <SkeletonLoader className="mb-2 h-8 w-16" />
      <SkeletonLoader className="h-3 w-20" />
    </div>
  );
}
