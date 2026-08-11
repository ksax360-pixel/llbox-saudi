"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Play } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { ViewLink } from "@/components/shared/view-link";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { VoiceCall } from "@/types";
import { formatDateTime, formatDuration } from "@/lib/utils";

function PlayRecordingButton() {
  const { toast } = useToast();
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label="Play recording"
      onClick={() =>
        toast("Playing recording", {
          description: "Audio playback started in demo mode.",
          variant: "info",
        })
      }
    >
      <Play className="h-4 w-4" />
    </Button>
  );
}

export const voiceCallColumns: ColumnDef<VoiceCall>[] = [
  { accessorKey: "id", header: "Call ID", cell: ({ row }) => <span className="font-medium">{row.original.id}</span> },
  { accessorKey: "driverNumber", header: "Driver Number" },
  { accessorKey: "customerNumber", header: "Customer Number" },
  { accessorKey: "duration", header: "Duration", cell: ({ row }) => formatDuration(row.original.duration) },
  { accessorKey: "outcome", header: "Outcome", cell: ({ row }) => <StatusBadge status={row.original.outcome} /> },
  {
    id: "recording",
    header: "Recording",
    cell: ({ row }) => (row.original.recordingUrl ? <PlayRecordingButton /> : "—"),
  },
  { accessorKey: "createdAt", header: "Date", cell: ({ row }) => formatDateTime(row.original.createdAt) },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => <ViewLink href={`/ai-agents/${row.original.id}`} />,
  },
];
