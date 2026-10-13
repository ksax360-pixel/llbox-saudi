"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Shield, Users } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminSummary } from "@/hooks/use-api";
import { formatDateTime } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/rbac";
import type { AuditLog } from "@/types";
import type { UserRole } from "@/types";

const auditColumns: ColumnDef<AuditLog>[] = [
  { accessorKey: "userName", header: "User" },
  { accessorKey: "action", header: "Action" },
  { accessorKey: "resource", header: "Resource" },
  { accessorKey: "timestamp", header: "Timestamp", cell: ({ row }) => formatDateTime(row.original.timestamp) },
  { accessorKey: "ipAddress", header: "IP Address" },
  { accessorKey: "beforeValue", header: "Before", cell: ({ row }) => row.original.beforeValue ?? "—" },
  { accessorKey: "afterValue", header: "After", cell: ({ row }) => row.original.afterValue ?? "—" },
];

const roles: UserRole[] = ["super_admin", "operations_admin", "customer_support", "ai_supervisor", "customer"];

export default function AdminPage() {
  const { data } = useAdminSummary();
  const roleCounts = data?.roleCounts || {};
  const logs = data?.logs || [];
  return (
    <div className="space-y-8">
      <PageHeader
        title="Administration"
        description="User management, roles, and audit logs"
      />

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[#111827]">
            <Users className="h-5 w-5" /> Users & Roles
          </h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/users">Manage Users</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/admin/users"><Plus className="h-4 w-4" /> Add User</Link>
            </Button>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => (
            <Card key={role}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Shield className="h-4 w-4" />
                  {ROLE_LABELS[role]}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold text-[#111827]">
                  {roleCounts[role] ?? 0}
                </p>
                <p className="text-xs text-[#6B7280]">active users</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-[#111827]">Audit Logs</h2>
        <DataTable columns={auditColumns} data={logs} searchPlaceholder="Search audit logs..." exportFilename="audit-logs" />
      </section>
    </div>
  );
}
