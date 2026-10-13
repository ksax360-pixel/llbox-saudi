"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Phone, Play } from "lucide-react";
import { DetailHeader } from "@/components/shared/detail-header";
import { DetailList, DetailRow } from "@/components/shared/detail-list";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { useVoiceCall } from "@/hooks/use-api";
import { formatDateTime, formatDuration } from "@/lib/utils";

export default function VoiceCallDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { toast } = useToast();
  const { data: call, isLoading } = useVoiceCall(id);
  const [notes, setNotes] = useState("");

  if (isLoading && !call) {
    return <div className="space-y-6" />;
  }

  if (!call) {
    return (
      <EmptyState
        icon={Phone}
        title="Call not found"
        action={<Button asChild><Link href="/ai-agents">Back to AI Agents</Link></Button>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <DetailHeader
        backHref="/ai-agents"
        backLabel="AI Agents"
        title={call.id}
        description={`Duration ${formatDuration(call.duration)}`}
        badge={<StatusBadge status={call.outcome} />}
        actions={
          <>
            {call.recordingUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  toast("Playing recording", {
                    description: "Audio playback started in demo mode.",
                    variant: "info",
                  })
                }
              >
                <Play className="h-4 w-4" /> Play Recording
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                toast("Escalate", {
                  description: "This option will be available tomorrow.",
                  variant: "info",
                })
              }
            >
              Escalate
            </Button>
            <Button
              size="sm"
              onClick={() => {
                const trimmed = notes.trim();
                if (!trimmed) {
                  toast("Notes required", {
                    description: "Enter notes before saving.",
                    variant: "error",
                  });
                  return;
                }
                toast("Notes saved", { description: trimmed.slice(0, 80) + (trimmed.length > 80 ? "…" : "") });
                setNotes("");
              }}
            >
              Add Notes
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Call Details</CardTitle></CardHeader>
          <CardContent>
            <DetailList>
              <DetailRow label="Call ID" value={call.id} />
              <DetailRow label="Driver Number" value={call.driverNumber} />
              <DetailRow label="Customer Number" value={call.customerNumber} />
              <DetailRow label="Duration" value={formatDuration(call.duration)} />
              <DetailRow label="Outcome" value={<StatusBadge status={call.outcome} />} />
              <DetailRow label="Date" value={formatDateTime(call.createdAt)} />
            </DetailList>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Transcript</CardTitle></CardHeader>
          <CardContent>
            {call.transcript ? (
              <pre className="whitespace-pre-wrap rounded-lg bg-[#F8F9FA] p-4 text-sm text-[#111827] font-sans leading-relaxed">
                {call.transcript}
              </pre>
            ) : (
              <p className="text-sm text-[#6B7280]">No transcript available for this call.</p>
            )}
            <div className="mt-4">
              <label htmlFor="notes" className="mb-2 block text-sm font-medium text-[#111827]">Agent Notes</label>
              <textarea
                id="notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about this call..."
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111827]"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
