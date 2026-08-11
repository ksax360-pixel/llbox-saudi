"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { MessageCircle, MessageSquare, Mail, Phone, Eye } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import type { Conversation, ConversationChannel } from "@/types";
import { formatDateTime } from "@/lib/utils";

const channelIcons: Record<ConversationChannel, React.ElementType> = {
  voice: Phone,
  whatsapp: MessageCircle,
  sms: MessageSquare,
  email: Mail,
};

export const conversationColumns: ColumnDef<Conversation>[] = [
  {
    accessorKey: "channel",
    header: "Channel",
    cell: ({ row }) => {
      const Icon = channelIcons[row.original.channel];
      return (
        <div className="flex items-center gap-2 capitalize">
          <Icon className="h-4 w-4 text-[#6B7280]" aria-hidden="true" />
          {row.original.channel}
        </div>
      );
    },
  },
  { accessorKey: "id", header: "ID", cell: ({ row }) => <span className="font-medium">{row.original.id}</span> },
  { accessorKey: "customerName", header: "Customer" },
  { accessorKey: "subject", header: "Subject" },
  { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  { accessorKey: "assignedAgent", header: "Agent", cell: ({ row }) => row.original.assignedAgent ?? "Unassigned" },
  { accessorKey: "updatedAt", header: "Updated", cell: ({ row }) => formatDateTime(row.original.updatedAt) },
  {
    id: "actions",
    header: "Actions",
    cell: () => (
      <Button variant="ghost" size="sm" aria-label="View conversation">
        <Eye className="h-4 w-4" />
      </Button>
    ),
  },
];
