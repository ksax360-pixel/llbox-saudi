"use client";

import { Map } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { lockerColumns } from "@/features/lockers/columns";
import { useLockers } from "@/hooks/use-api";

export default function LockersPage() {
  const { data: lockers = [] } = useLockers();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lockers"
        description="Monitor and manage smart parcel locker infrastructure"
        actions={
          <Button variant="outline" asChild>
            <Link href="/lockers/map"><Map className="h-4 w-4" /> Map View</Link>
          </Button>
        }
      />
      <DataTable
        columns={lockerColumns}
        data={lockers}
        searchPlaceholder="Search lockers..."
        exportFilename="lockers"
      />
    </div>
  );
}
