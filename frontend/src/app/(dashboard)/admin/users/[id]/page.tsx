"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Shield, Users } from "lucide-react";
import { DetailHeader } from "@/components/shared/detail-header";
import { DetailList, DetailRow } from "@/components/shared/detail-list";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { useAdminUser } from "@/hooks/use-api";
import { ROLE_LABELS, ROLE_PERMISSIONS } from "@/lib/rbac";
import { formatDateTime } from "@/lib/utils";
import type { User } from "@/types";

export default function AdminUserDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { toast } = useToast();
  const { data: found, isLoading } = useAdminUser(id);
  const [user, setUser] = useState<User | undefined>();
  const [confirmSuspend, setConfirmSuspend] = useState(false);

  useEffect(() => {
    if (found) setUser(found);
  }, [found]);

  if (isLoading && !user) {
    return <div className="space-y-6" />;
  }

  if (!user) {
    return (
      <EmptyState
        icon={Users}
        title="User not found"
        action={<Button asChild><Link href="/admin/users">Back to users</Link></Button>}
      />
    );
  }

  const permissions = ROLE_PERMISSIONS[user.role];

  return (
    <div className="space-y-6">
      <DetailHeader
        backHref="/admin/users"
        backLabel="Users"
        title={user.name}
        description={user.email}
        badge={<StatusBadge status={user.status} />}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast("Edit mode", { description: "Profile editing is available in demo mode via toast confirmation.", variant: "info" })}
            >
              Edit
            </Button>
            {user.status !== "suspended" && (
              <Button variant="destructive" size="sm" onClick={() => setConfirmSuspend(true)}>
                Suspend
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>User Details</CardTitle></CardHeader>
          <CardContent>
            <DetailList>
              <DetailRow label="User ID" value={user.id} />
              <DetailRow label="Name" value={user.name} />
              <DetailRow label="Email" value={user.email} />
              <DetailRow label="Role" value={ROLE_LABELS[user.role]} />
              <DetailRow label="Organization" value={user.organizationName} />
              <DetailRow label="2FA" value={user.twoFactorEnabled ? "Enabled" : "Disabled"} />
              <DetailRow label="Last Login" value={user.lastLogin ? formatDateTime(user.lastLogin) : "—"} />
              <DetailRow label="Status" value={<StatusBadge status={user.status} />} />
            </DetailList>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4" /> Permissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {permissions.map((p) => (
                <span
                  key={p}
                  className="rounded-md border border-[#E5E7EB] bg-[#F8F9FA] px-2.5 py-1 text-xs font-medium text-[#111827]"
                >
                  {p}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmSuspend}
        title="Suspend user?"
        description={`${user.name} will lose access until reactivated.`}
        confirmLabel="Suspend"
        destructive
        onClose={() => setConfirmSuspend(false)}
        onConfirm={() => {
          setUser({ ...user, status: "suspended" });
          toast("User suspended", { description: user.name });
        }}
      />
    </div>
  );
}
