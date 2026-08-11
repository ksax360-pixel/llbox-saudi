"use client";

import { Plus } from "lucide-react";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { driverColumns } from "@/features/drivers/columns";
import { mockDrivers } from "@/lib/mock-data";

export default function DriversPage() {
  const { toast } = useToast();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Drivers"
        description="Track driver performance and delivery assignments"
        actions={
          <Button
            onClick={() =>
              toast("Add driver", {
                description: "Driver creation form opened in demo mode.",
                variant: "info",
              })
            }
          >
            <Plus className="h-4 w-4" /> Add Driver
          </Button>
        }
      />
      <DataTable
        columns={driverColumns}
        data={mockDrivers}
        searchPlaceholder="Search drivers..."
        exportFilename="drivers"
      />
    </div>
  );
}
