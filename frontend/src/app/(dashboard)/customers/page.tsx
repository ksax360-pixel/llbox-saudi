"use client";

import { Plus } from "lucide-react";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { customerColumns } from "@/features/customers/columns";
import { mockCustomers } from "@/lib/mock-data";

export default function CustomersPage() {
  const { toast } = useToast();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Manage customer profiles and delivery history"
        actions={
          <Button
            onClick={() =>
              toast("Add customer", {
                description: "Customer creation form opened in demo mode.",
                variant: "info",
              })
            }
          >
            <Plus className="h-4 w-4" /> Add Customer
          </Button>
        }
      />
      <DataTable
        columns={customerColumns}
        data={mockCustomers}
        searchPlaceholder="Search customers..."
        exportFilename="customers"
        pageSize={15}
      />
    </div>
  );
}
