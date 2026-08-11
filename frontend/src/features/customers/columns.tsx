"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { ViewLink } from "@/components/shared/view-link";
import type { Customer } from "@/types";
import { formatDate } from "@/lib/utils";

export const customerColumns: ColumnDef<Customer>[] = [
  { accessorKey: "id", header: "Customer ID", cell: ({ row }) => <span className="font-medium">{row.original.id}</span> },
  { accessorKey: "name", header: "Name" },
  { accessorKey: "mobile", header: "Mobile" },
  { accessorKey: "email", header: "Email" },
  { accessorKey: "nationalId", header: "National ID" },
  { accessorKey: "assignedLockerCode", header: "Locker", cell: ({ row }) => row.original.assignedLockerCode ?? "—" },
  { accessorKey: "totalDeliveries", header: "Deliveries" },
  { accessorKey: "lastDeliveryDate", header: "Last Delivery", cell: ({ row }) => row.original.lastDeliveryDate ? formatDate(row.original.lastDeliveryDate) : "—" },
  { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => <ViewLink href={`/customers/${row.original.id}`} />,
  },
];
