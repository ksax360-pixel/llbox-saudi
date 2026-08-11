"use client";

import { Plus } from "lucide-react";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { deliveryColumns } from "@/features/deliveries/columns";
import { mockDeliveries } from "@/lib/mock-data";

export default function DeliveriesPage() {
  const { toast } = useToast();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Deliveries"
        description="Manage and track all parcel delivery operations"
        actions={
          <Button
            onClick={() =>
              toast("New delivery", {
                description: "Delivery creation form opened in demo mode.",
                variant: "info",
              })
            }
          >
            <Plus className="h-4 w-4" /> New Delivery
          </Button>
        }
      />
      <DataTable
        columns={deliveryColumns}
        data={mockDeliveries}
        searchPlaceholder="Search deliveries..."
        exportFilename="deliveries"
      />
    </div>
  );
}
