import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/utils";
import type { DeliveryTimelineEvent } from "@/types";
import { Check } from "lucide-react";

const STAGE_LABELS: Record<DeliveryTimelineEvent["stage"], string> = {
  registered: "Registered",
  matched: "Driver Matched",
  otp_generated: "OTP Generated",
  locker_opened: "Locker Opened",
  completed: "Completed",
};

const ALL_STAGES: DeliveryTimelineEvent["stage"][] = [
  "registered",
  "matched",
  "otp_generated",
  "locker_opened",
  "completed",
];

interface DeliveryTimelineProps {
  events: DeliveryTimelineEvent[];
  className?: string;
}

export function DeliveryTimeline({ events, className }: DeliveryTimelineProps) {
  const eventMap = new Map(events.map((e) => [e.stage, e]));

  return (
    <ol className={cn("space-y-0", className)} aria-label="Delivery timeline">
      {ALL_STAGES.map((stage, i) => {
        const event = eventMap.get(stage);
        const done = !!event;
        return (
          <li key={stage} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold",
                  done
                    ? "border-[#10B981] bg-[#10B981] text-white"
                    : "border-[#E5E7EB] bg-white text-[#9CA3AF]"
                )}
              >
                {done ? <Check className="h-4 w-4" aria-hidden="true" /> : i + 1}
              </div>
              {i < ALL_STAGES.length - 1 && (
                <div className={cn("w-0.5 flex-1 min-h-[32px]", done ? "bg-[#10B981]" : "bg-[#E5E7EB]")} />
              )}
            </div>
            <div className="pb-6">
              <p className={cn("text-sm font-medium", done ? "text-[#111827]" : "text-[#9CA3AF]")}>
                {STAGE_LABELS[stage]}
              </p>
              {event && (
                <time className="text-xs text-[#6B7280]">{formatDateTime(event.timestamp)}</time>
              )}
              {event?.note && <p className="mt-0.5 text-xs text-[#6B7280]">{event.note}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
