"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { CheckCircle, Lock, RefreshCw, XCircle } from "lucide-react";
import { DetailHeader } from "@/components/shared/detail-header";
import { DetailList, DetailRow } from "@/components/shared/detail-list";
import { DeliveryTimeline } from "@/components/shared/delivery-timeline";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { mockDeliveries } from "@/lib/mock-data";
import { formatDateTime } from "@/lib/utils";
import Link from "next/link";
import type { Delivery } from "@/types";

export default function DeliveryDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { toast } = useToast();
  const found = mockDeliveries.find((d) => d.id === id);
  const [delivery, setDelivery] = useState<Delivery | undefined>(found);
  const [confirmCancel, setConfirmCancel] = useState(false);

  if (!delivery) {
    return (
      <EmptyState
        icon={Lock}
        title="Delivery not found"
        description={`No delivery with ID ${id}`}
        action={<Button asChild><Link href="/deliveries">Back to deliveries</Link></Button>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <DetailHeader
        backHref="/deliveries"
        backLabel="Deliveries"
        title={delivery.id}
        description={`Order ${delivery.orderReference} · ${delivery.city}`}
        badge={<StatusBadge status={delivery.status} />}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast("Locker reassigned", { description: "Nearest available locker selected." })}
            >
              <RefreshCw className="h-4 w-4" /> Reassign Locker
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDelivery({ ...delivery, status: "completed", otpStatus: "verified" });
                toast("Delivery confirmed", { description: "Marked as completed manually." });
              }}
            >
              <CheckCircle className="h-4 w-4" /> Manual Confirm
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setConfirmCancel(true)}>
              <XCircle className="h-4 w-4" /> Cancel
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Delivery Details</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailList>
              <DetailRow label="Order Reference" value={delivery.orderReference} />
              <DetailRow
                label="Customer"
                value={
                  <Link href={`/customers/${delivery.customerId}`} className="underline-offset-2 hover:underline">
                    {delivery.customerName}
                  </Link>
                }
              />
              <DetailRow
                label="Driver"
                value={
                  delivery.driverId ? (
                    <Link href={`/drivers/${delivery.driverId}`} className="underline-offset-2 hover:underline">
                      {delivery.driverName}
                    </Link>
                  ) : "Unassigned"
                }
              />
              <DetailRow label="Vendor" value={delivery.vendor} />
              <DetailRow
                label="Assigned Locker"
                value={
                  delivery.lockerId ? (
                    <Link href={`/lockers/${delivery.lockerId}`} className="underline-offset-2 hover:underline">
                      {delivery.lockerCode}
                    </Link>
                  ) : "—"
                }
              />
              <DetailRow label="Session ID" value={delivery.sessionId} />
              <DetailRow label="OTP Status" value={<StatusBadge status={delivery.otpStatus} />} />
              <DetailRow label="City" value={delivery.city} />
              <DetailRow label="Created" value={formatDateTime(delivery.createdAt)} />
              <DetailRow label="Updated" value={formatDateTime(delivery.updatedAt)} />
            </DetailList>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <DeliveryTimeline events={delivery.timeline} />
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel delivery?"
        description="This cannot be undone in the operations console."
        confirmLabel="Cancel Delivery"
        destructive
        onClose={() => setConfirmCancel(false)}
        onConfirm={() => {
          setDelivery({ ...delivery, status: "cancelled" });
          toast("Delivery cancelled", { variant: "info" });
        }}
      />
    </div>
  );
}
