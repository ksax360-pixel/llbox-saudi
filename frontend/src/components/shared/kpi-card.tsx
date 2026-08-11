import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: LucideIcon;
  className?: string;
}

export function KpiCard({ title, value, change, changeLabel, icon: Icon, className }: KpiCardProps) {
  const isPositive = change !== undefined && change >= 0;

  return (
    <div
      className={cn(
        "rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-[var(--shadow-card)]",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-sm font-medium text-[#6B7280]">{title}</p>
          <p className="text-2xl font-semibold tracking-tight text-[#111827]">{value}</p>
          {change !== undefined && (
            <div className="flex items-center gap-1.5">
              {isPositive ? (
                <TrendingUp className="h-3.5 w-3.5 text-[#10B981]" aria-hidden="true" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-[#EF4444]" aria-hidden="true" />
              )}
              <span className={cn("text-xs font-medium", isPositive ? "text-[#10B981]" : "text-[#EF4444]")}>
                {isPositive ? "+" : ""}{change}%
              </span>
              {changeLabel && <span className="text-xs text-[#9CA3AF]">{changeLabel}</span>}
            </div>
          )}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F8F9FA]">
          <Icon className="h-5 w-5 text-[#6B7280]" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
