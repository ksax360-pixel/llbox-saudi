"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Power, RotateCcw, Warehouse, Wrench } from "lucide-react";
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
import { mockDeliveries, mockLockers } from "@/lib/mock-data";
import { formatDate, formatPercent } from "@/lib/utils";
import type { Locker } from "@/types";

export default function LockerDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { toast } = useToast();
  const found = mockLockers.find((l) => l.id === id);
  const [locker, setLocker] = useState<Locker | undefined>(found);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  if (!locker) {
    return (
      <EmptyState
        icon={Warehouse}
        title="Locker not found"
        action={<Button asChild><Link href="/lockers">Back to lockers</Link></Button>}
      />
    );
  }

  const occupancyPct = Math.round((locker.occupancy / locker.capacity) * 100);
  const history = mockDeliveries.filter((d) => d.lockerId === locker.id).slice(0, 20);

  return (
    <div className="space-y-6">
      <DetailHeader
        backHref="/lockers"
        backLabel="Lockers"
        title={locker.boxCode}
        description={`${locker.location} · ${locker.city}`}
        badge={<StatusBadge status={locker.status} />}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLocker({ ...locker, status: "available" });
                toast("Locker reset", { description: "Compartments reset and ready for use." });
              }}
            >
              <RotateCcw className="h-4 w-4" /> Reset
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLocker({
                  ...locker,
                  status: "maintenance",
                  lastMaintenance: new Date().toISOString(),
                });
                toast("Maintenance mode", {
                  description: "Locker marked for maintenance.",
                  variant: "info",
                });
              }}
            >
              <Wrench className="h-4 w-4" /> Maintenance
            </Button>
            {locker.status === "deactivated" ? (
              <Button
                size="sm"
                onClick={() => {
                  setLocker({ ...locker, status: "available" });
                  toast("Locker activated", { description: "Locker is available for deliveries." });
                }}
              >
                <Power className="h-4 w-4" /> Activate
              </Button>
            ) : (
              <Button variant="destructive" size="sm" onClick={() => setConfirmDeactivate(true)}>
                <Power className="h-4 w-4" /> Deactivate
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Locker Details</CardTitle></CardHeader>
          <CardContent>
            <DetailList>
              <DetailRow label="Locker ID" value={locker.id} />
              <DetailRow label="Box Code" value={locker.boxCode} />
              <DetailRow label="Location" value={locker.location} />
              <DetailRow label="City" value={locker.city} />
              <DetailRow label="GPS" value={`${locker.latitude.toFixed(5)}, ${locker.longitude.toFixed(5)}`} />
              <DetailRow label="Capacity" value={`${locker.capacity} compartments`} />
              <DetailRow label="Occupancy" value={`${locker.occupancy} / ${locker.capacity} (${occupancyPct}%)`} />
              <DetailRow label="Last Maintenance" value={locker.lastMaintenance ? formatDate(locker.lastMaintenance) : "—"} />
            </DetailList>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Health & Utilization</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-[#6B7280]">Utilization</span>
                <span className="font-medium">{formatPercent(occupancyPct)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#F3F4F6]">
                <div className="h-full rounded-full bg-[#111827]" style={{ width: `${occupancyPct}%` }} />
              </div>
            </div>
            <div className="rounded-lg bg-[#F8F9FA] p-4 space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-[#9CA3AF]">Status</p>
              <StatusBadge status={locker.status} />
              <p className="pt-2 text-xs text-[#6B7280]">
                {locker.status === "available" && "All systems normal. Ready for deliveries."}
                {locker.status === "in_use" && "Currently holding parcels."}
                {locker.status === "maintenance" && "Under maintenance. Not accepting deliveries."}
                {locker.status === "deactivated" && "Deactivated. Contact operations to reactivate."}
              </p>
            </div>
            <div className="aspect-video overflow-hidden rounded-lg border border-[#E5E7EB] bg-[#F8F9FA] flex items-center justify-center">
              <div className="text-center p-4">
                <p className="text-xs text-[#9CA3AF]">Map preview</p>
                <p className="font-mono text-sm text-[#6B7280] mt-1">
                  {locker.latitude.toFixed(4)}, {locker.longitude.toFixed(4)}
                </p>
                <Button variant="outline" size="sm" className="mt-3" asChild>
                  <Link href="/lockers/map">Open Map View</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-[#111827]">Delivery History</h2>
        <DataTable
          columns={deliveryColumns}
          data={history}
          searchPlaceholder="Search history..."
          exportFilename={`${locker.boxCode}-history`}
        />
      </div>

      <ConfirmDialog
        open={confirmDeactivate}
        title="Deactivate locker?"
        description="This locker will stop accepting new deliveries until reactivated."
        confirmLabel="Deactivate"
        destructive
        onClose={() => setConfirmDeactivate(false)}
        onConfirm={() => {
          setLocker({ ...locker, status: "deactivated" });
          toast("Locker deactivated", { variant: "info" });
        }}
      />
    </div>
  );
}
