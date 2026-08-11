import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 text-center", className)}>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#F8F9FA]">
        <Icon className="h-6 w-6 text-[#9CA3AF]" aria-hidden="true" />
      </div>
      <h3 className="text-base font-medium text-[#111827]">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-[#6B7280]">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
