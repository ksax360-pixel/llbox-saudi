"use client";

import { Map, Plus } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { lockerColumns } from "@/features/lockers/columns";
import { mockLockers } from "@/lib/mock-data";

export default function LockersPage() {
  const { toast } = useToast();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lockers"
        description="Monitor and manage smart parcel locker infrastructure"
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/lockers/map"><Map className="h-4 w-4" /> Map View</Link>
            </Button>
            <Button
              onClick={() =>
                toast("Add locker", {
                  description: "Locker creation form opened in demo mode.",
                  variant: "info",
                })
              }
            >
              <Plus className="h-4 w-4" /> Add Locker
            </Button>
          </>
        }
      />
      <DataTable
        columns={lockerColumns}
        data={mockLockers}
        searchPlaceholder="Search lockers..."
        exportFilename="lockers"
      />
    </div>
  );
}
