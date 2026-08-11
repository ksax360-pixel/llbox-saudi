"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { ViewLink } from "@/components/shared/view-link";
import type { Driver } from "@/types";
import { formatPercent } from "@/lib/utils";

export const driverColumns: ColumnDef<Driver>[] = [
  { accessorKey: "id", header: "Driver ID", cell: ({ row }) => <span className="font-medium">{row.original.id}</span> },
  { accessorKey: "name", header: "Name" },
  { accessorKey: "mobile", header: "Mobile" },
  { accessorKey: "company", header: "Company" },
  { accessorKey: "completedDeliveries", header: "Completed" },
  { accessorKey: "failedDeliveries", header: "Failed" },
  { accessorKey: "successRate", header: "Success Rate", cell: ({ row }) => formatPercent(row.original.successRate) },
  { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => <ViewLink href={`/drivers/${row.original.id}`} />,
  },
];
