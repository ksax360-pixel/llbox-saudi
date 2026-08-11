"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { ViewLink } from "@/components/shared/view-link";
import type { Locker } from "@/types";

export const lockerColumns: ColumnDef<Locker>[] = [
  { accessorKey: "id", header: "Locker ID", cell: ({ row }) => <span className="font-medium">{row.original.id}</span> },
  { accessorKey: "boxCode", header: "Box Code" },
  { accessorKey: "location", header: "Location" },
  { accessorKey: "city", header: "City" },
  {
    id: "gps",
    header: "GPS",
    cell: ({ row }) => `${row.original.latitude.toFixed(4)}, ${row.original.longitude.toFixed(4)}`,
  },
  { accessorKey: "capacity", header: "Capacity" },
  {
    id: "occupancy",
    header: "Occupancy",
    cell: ({ row }) => {
      const pct = Math.round((row.original.occupancy / row.original.capacity) * 100);
      return (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#F3F4F6]">
            <div className="h-full rounded-full bg-[#111827]" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs text-[#6B7280]">{pct}%</span>
        </div>
      );
    },
  },
  { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => <ViewLink href={`/lockers/${row.original.id}`} />,
  },
];
