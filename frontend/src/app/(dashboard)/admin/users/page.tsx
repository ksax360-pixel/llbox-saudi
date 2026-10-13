"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Shield } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ViewLink } from "@/components/shared/view-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { apiRequest } from "@/lib/api-client";
import { createMockUser } from "@/lib/auth";
import { buildMockUsers } from "@/lib/mock-users";
import { ROLE_LABELS } from "@/lib/rbac";
import { formatDateTime } from "@/lib/utils";
import { api } from "@/services/api";
import type { User } from "@/types";

export default function AdminUsersPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>(() => buildMockUsers());
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mobile, setMobile] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.admin.users().then((items) => {
      if (items.length) setUsers(items);
    });
  }, []);

  const userColumns: ColumnDef<User>[] = useMemo(
    () => [
      { accessorKey: "name", header: "Name", cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
      { accessorKey: "email", header: "Email" },
      { accessorKey: "role", header: "Role", cell: ({ row }) => ROLE_LABELS[row.original.role] },
      { accessorKey: "organizationName", header: "Organization" },
      {
        accessorKey: "twoFactorEnabled",
        header: "2FA",
        cell: ({ row }) => (row.original.twoFactorEnabled ? "Enabled" : "Off"),
      },
      { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      {
        accessorKey: "lastLogin",
        header: "Last Login",
        cell: ({ row }) => (row.original.lastLogin ? formatDateTime(row.original.lastLogin) : "—"),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => <ViewLink href={`/admin/users/${row.original.id}`} />,
      },
    ],
    []
  );

  const handleAdd = async () => {
    if (!name.trim() || !email.trim() || !password.trim() || !mobile.trim()) {
      toast("Missing fields", { description: "Name, email, password, and mobile are required.", variant: "error" });
      return;
    }
    if (password.trim().length < 6) {
      toast("Weak password", { description: "Password must be at least 6 characters.", variant: "error" });
      return;
    }

    setCreating(true);
    try {
      const data = await apiRequest<{
        user: Record<string, unknown>;
        otpSent?: boolean;
        maskedPhone?: string | null;
      }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password: password.trim(),
          mobile: mobile.trim(),
        }),
      });

      const created = data.user
        ? {
            ...createMockUser("customer_support"),
            id: String(data.user.id || data.user._id),
            name: String(data.user.name || name.trim()),
            email: String(data.user.email || email.trim()),
            twoFactorEnabled: false,
          }
        : null;

      if (created) {
        setUsers((prev) => [created, ...prev]);
      } else {
        const refreshed = await api.admin.users();
        if (refreshed.length) setUsers(refreshed);
      }

      setName("");
      setEmail("");
      setPassword("");
      setMobile("");
      setShowAdd(false);

      toast(
        data.otpSent ? "User created" : "User created (OTP not sent)",
        {
          description: data.otpSent
            ? `Verification OTP sent on WhatsApp${data.maskedPhone ? ` to ${data.maskedPhone}` : ""}.`
            : `${name.trim()} was added.`,
          variant: data.otpSent ? "success" : "info",
        }
      );
    } catch (err) {
      toast("Could not create user", {
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "error",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        description="Manage users, roles, and access permissions"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                toast("Roles overview", {
                  description: "Open Administration to review role cards and permissions.",
                  variant: "info",
                })
              }
            >
              <Shield className="h-4 w-4" /> Roles
            </Button>
            <Button size="sm" onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4" /> Add User
            </Button>
          </>
        }
      />
      <DataTable
        columns={userColumns}
        data={users}
        searchPlaceholder="Search users..."
        exportFilename="users"
      />

      {showAdd && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-black/30" aria-label="Close" onClick={() => setShowAdd(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-user-title"
            className="relative z-10 w-full max-w-md space-y-4 rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-[var(--shadow-elevated)]"
          >
            <h2 id="add-user-title" className="text-lg font-semibold text-[#111827]">Add user</h2>
            <div className="space-y-2">
              <Label htmlFor="new-name">Name</Label>
              <Input id="new-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-email">Email</Label>
              <Input id="new-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@llbox.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Password</Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-mobile">Mobile (WhatsApp)</Label>
              <Input
                id="new-mobile"
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="+966501234567"
                autoComplete="tel"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAdd(false)} disabled={creating}>Cancel</Button>
              <Button onClick={handleAdd} disabled={creating}>{creating ? "Creating..." : "Create"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
