"use client";

import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { deliveryColumns } from "@/features/deliveries/columns";
import { useDeliveries } from "@/hooks/use-api";

export default function DeliveriesPage() {
  const { data: deliveries = [] } = useDeliveries();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Deliveries"
        description="Manage and track all parcel delivery operations"
      />
      <DataTable
        columns={deliveryColumns}
        data={deliveries}
        searchPlaceholder="Search deliveries..."
        exportFilename="deliveries"
      />
    </div>
  );
}
