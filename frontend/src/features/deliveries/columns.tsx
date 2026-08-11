"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { ViewLink } from "@/components/shared/view-link";
import type { Delivery } from "@/types";
import { formatDateTime } from "@/lib/utils";

export const deliveryColumns: ColumnDef<Delivery>[] = [
  { accessorKey: "id", header: "Delivery ID", cell: ({ row }) => <span className="font-medium">{row.original.id}</span> },
  { accessorKey: "orderReference", header: "Order Ref" },
  { accessorKey: "customerName", header: "Customer" },
  { accessorKey: "driverName", header: "Driver", cell: ({ row }) => row.original.driverName ?? "—" },
  { accessorKey: "vendor", header: "Vendor" },
  { accessorKey: "lockerCode", header: "Locker", cell: ({ row }) => row.original.lockerCode ?? "—" },
  { accessorKey: "sessionId", header: "Session ID", cell: ({ row }) => row.original.sessionId ?? "—" },
  { accessorKey: "otpStatus", header: "OTP", cell: ({ row }) => <StatusBadge status={row.original.otpStatus} /> },
  { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  { accessorKey: "createdAt", header: "Created", cell: ({ row }) => formatDateTime(row.original.createdAt) },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => <ViewLink href={`/deliveries/${row.original.id}`} />,
  },
];
