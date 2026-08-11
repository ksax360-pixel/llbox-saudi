"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Truck } from "lucide-react";
import { AnalyticsCard } from "@/components/shared/analytics-card";
import { DetailHeader } from "@/components/shared/detail-header";
import { DetailList, DetailRow } from "@/components/shared/detail-list";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { DataTable } from "@/components/shared/data-table";
import { KpiCard } from "@/components/shared/kpi-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { deliveryColumns } from "@/features/deliveries/columns";
import { getChartData, mockDeliveries, mockDrivers } from "@/lib/mock-data";
import { formatNumber, formatPercent } from "@/lib/utils";

export default function DriverDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const driver = mockDrivers.find((d) => d.id === id);

  if (!driver) {
    return (
      <EmptyState
        icon={Truck}
        title="Driver not found"
        action={<Button asChild><Link href="/drivers">Back to drivers</Link></Button>}
      />
    );
  }

  const history = mockDeliveries.filter((d) => d.driverId === driver.id);

  return (
    <div className="space-y-6">
      <DetailHeader
        backHref="/drivers"
        backLabel="Drivers"
        title={driver.name}
        description={`${driver.company} · ${driver.city}`}
        badge={<StatusBadge status={driver.status} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Completed" value={formatNumber(driver.completedDeliveries)} icon={Truck} />
        <KpiCard title="Failed" value={formatNumber(driver.failedDeliveries)} icon={Truck} />
        <KpiCard title="Success Rate" value={formatPercent(driver.successRate)} icon={Truck} />
        <KpiCard title="Recent Assignments" value={formatNumber(history.length)} icon={Truck} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Driver Profile</CardTitle></CardHeader>
          <CardContent>
            <DetailList>
              <DetailRow label="Driver ID" value={driver.id} />
              <DetailRow label="Name" value={driver.name} />
              <DetailRow label="Mobile" value={driver.mobile} />
              <DetailRow label="Company" value={driver.company} />
              <DetailRow label="City" value={driver.city} />
              <DetailRow label="Status" value={<StatusBadge status={driver.status} />} />
            </DetailList>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <AnalyticsCard
            title="Performance (Last 14 Days)"
            data={getChartData(14)}
            type="area"
            color="#10B981"
          />
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-[#111827]">Delivery History</h2>
        <DataTable
          columns={deliveryColumns}
          data={history}
          searchPlaceholder="Search deliveries..."
          exportFilename={`${driver.id}-deliveries`}
        />
      </div>
    </div>
  );
}
