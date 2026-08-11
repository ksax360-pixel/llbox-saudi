"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Ban, MessageSquare, Users } from "lucide-react";
import { DetailHeader } from "@/components/shared/detail-header";
import { DetailList, DetailRow } from "@/components/shared/detail-list";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { deliveryColumns } from "@/features/deliveries/columns";
import { mockConversations, mockCustomers, mockDeliveries } from "@/lib/mock-data";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { Customer } from "@/types";

export default function CustomerDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { toast } = useToast();
  const found = mockCustomers.find((c) => c.id === id);
  const [customer, setCustomer] = useState<Customer | undefined>(found);
  const [confirmSuspend, setConfirmSuspend] = useState(false);

  if (!customer) {
    return (
      <EmptyState
        icon={Users}
        title="Customer not found"
        action={<Button asChild><Link href="/customers">Back to customers</Link></Button>}
      />
    );
  }

  const deliveries = mockDeliveries.filter((d) => d.customerId === customer.id);
  const conversations = mockConversations.filter((c) => c.customerId === customer.id).slice(0, 8);

  return (
    <div className="space-y-6">
      <DetailHeader
        backHref="/customers"
        backLabel="Customers"
        title={customer.name}
        description={customer.email}
        badge={<StatusBadge status={customer.status} />}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/conversations"><MessageSquare className="h-4 w-4" /> Conversations</Link>
            </Button>
            {customer.status !== "suspended" && (
              <Button variant="destructive" size="sm" onClick={() => setConfirmSuspend(true)}>
                <Ban className="h-4 w-4" /> Suspend
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
          <CardContent>
            <DetailList>
              <DetailRow label="Customer ID" value={customer.id} />
              <DetailRow label="Name" value={customer.name} />
              <DetailRow label="Mobile" value={customer.mobile} />
              <DetailRow label="Email" value={customer.email} />
              <DetailRow label="National ID" value={customer.nationalId} />
              <DetailRow
                label="Assigned Locker"
                value={
                  customer.assignedLockerId ? (
                    <Link href={`/lockers/${customer.assignedLockerId}`} className="underline-offset-2 hover:underline">
                      {customer.assignedLockerCode}
                    </Link>
                  ) : "—"
                }
              />
              <DetailRow label="City" value={customer.city} />
              <DetailRow label="Total Deliveries" value={customer.totalDeliveries} />
              <DetailRow label="Last Delivery" value={customer.lastDeliveryDate ? formatDate(customer.lastDeliveryDate) : "—"} />
            </DetailList>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Conversation History</CardTitle></CardHeader>
          <CardContent>
            {conversations.length === 0 ? (
              <p className="text-sm text-[#6B7280]">No conversations yet</p>
            ) : (
              <ul className="space-y-3">
                {conversations.map((c) => (
                  <li key={c.id} className="border-b border-[#E5E7EB] pb-3 last:border-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-[#111827] capitalize">{c.channel}</p>
                      <StatusBadge status={c.status} />
                    </div>
                    <p className="text-xs text-[#6B7280]">{c.subject}</p>
                    <time className="text-[10px] text-[#9CA3AF]">{formatDateTime(c.updatedAt)}</time>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-[#111827]">Delivery History</h2>
        <DataTable
          columns={deliveryColumns}
          data={deliveries}
          searchPlaceholder="Search deliveries..."
          exportFilename={`${customer.id}-deliveries`}
        />
      </div>

      <ConfirmDialog
        open={confirmSuspend}
        title="Suspend customer?"
        description="Suspended customers cannot place or receive new deliveries."
        confirmLabel="Suspend"
        destructive
        onClose={() => setConfirmSuspend(false)}
        onConfirm={() => {
          setCustomer({ ...customer, status: "suspended" });
          toast("Customer suspended", { variant: "info" });
        }}
      />
    </div>
  );
}
