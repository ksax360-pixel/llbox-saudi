import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => (
    <div className="w-full">
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111827] focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-[#EF4444] focus-visible:ring-[#EF4444]",
          className
        )}
        ref={ref}
        aria-invalid={!!error}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-[#EF4444]" role="alert">{error}</p>}
    </div>
  )
);
Input.displayName = "Input";
