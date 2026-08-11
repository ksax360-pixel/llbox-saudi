import { cn } from "@/lib/utils";

interface DetailRowProps {
  label: string;
  value: React.ReactNode;
  className?: string;
}

export function DetailRow({ label, value, className }: DetailRowProps) {
  return (
    <div className={cn("flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4 py-3 border-b border-[#E5E7EB] last:border-0", className)}>
      <dt className="text-sm text-[#6B7280] shrink-0">{label}</dt>
      <dd className="text-sm font-medium text-[#111827] sm:text-right">{value ?? "—"}</dd>
    </div>
  );
}

export function DetailList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <dl className={cn("", className)}>{children}</dl>;
}
