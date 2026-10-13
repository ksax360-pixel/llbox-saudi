"use client";

import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { driverColumns } from "@/features/drivers/columns";
import { useDrivers } from "@/hooks/use-api";

export default function DriversPage() {
  const { data: drivers = [] } = useDrivers();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Drivers"
        description="Track driver performance and delivery assignments"
      />
      <DataTable
        columns={driverColumns}
        data={drivers}
        searchPlaceholder="Search drivers..."
        exportFilename="drivers"
      />
    </div>
  );
}
