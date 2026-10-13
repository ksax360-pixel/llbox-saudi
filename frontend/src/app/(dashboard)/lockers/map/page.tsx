"use client";

import Link from "next/link";
import { MapPin, Warehouse } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LockerGoogleMap } from "@/components/maps/locker-google-map";
import { DetailHeader } from "@/components/shared/detail-header";
import { SearchBar } from "@/components/shared/search-bar";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLockers } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/api-client";
import type { Locker, LockerStatus } from "@/types";

const statusColors: Record<LockerStatus, string> = {
  available: "bg-[#10B981]",
  in_use: "bg-blue-500",
  maintenance: "bg-[#F59E0B]",
  deactivated: "bg-[#9CA3AF]",
};

export default function LockerMapPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Locker | null>(null);
  const [mapsApiKey, setMapsApiKey] = useState(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "");
  const { data: allLockers = [] } = useLockers();

  useEffect(() => {
    if (mapsApiKey) return;
    apiRequest<{ googleMapsApiKey?: string }>("/api/auth/public-config")
      .then((data) => {
        if (data.googleMapsApiKey) setMapsApiKey(data.googleMapsApiKey);
      })
      .catch(() => {});
  }, [mapsApiKey]);

  const lockers = useMemo(() => {
    return allLockers.filter((l) => {
      const matchSearch =
        l.boxCode.toLowerCase().includes(search.toLowerCase()) ||
        l.location.toLowerCase().includes(search.toLowerCase()) ||
        l.city.toLowerCase().includes(search.toLowerCase());
      const matchFilter = filter === "all" || l.status === filter;
      return matchSearch && matchFilter;
    });
  }, [search, filter, allLockers]);

  return (
    <div className="space-y-6">
      <DetailHeader
        backHref="/lockers"
        backLabel="Lockers"
        title="Locker Map"
        description="Geographic overview of all smart parcel lockers"
        actions={<Button variant="outline" asChild><Link href="/lockers">List View</Link></Button>}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBar value={search} onChange={setSearch} placeholder="Search lockers..." className="sm:max-w-xs" />
        <div className="flex flex-wrap gap-1.5">
          {["all", "available", "in_use", "maintenance", "deactivated"].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium capitalize",
                filter === f ? "bg-[#111827] text-white" : "bg-white border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F8F9FA]"
              )}
            >
              {f.replace("_", " ")}
            </button>
          ))}
        </div>
        <p className="text-sm text-[#6B7280] sm:ml-auto">{lockers.length} lockers</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 overflow-hidden">
          <CardContent className="p-0">
            <LockerGoogleMap
              apiKey={mapsApiKey}
              lockers={lockers}
              selected={selected}
              onSelect={setSelected}
            />
            <div className="flex flex-wrap gap-3 border-t border-[#E5E7EB] px-4 py-3 text-xs">
              {(Object.keys(statusColors) as LockerStatus[]).map((s) => (
                <span key={s} className="flex items-center gap-1.5 capitalize text-[#6B7280]">
                  <span className={cn("h-2 w-2 rounded-full", statusColors[s])} />
                  {s.replace("_", " ")}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            {selected ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-[#111827]">{selected.boxCode}</p>
                    <p className="text-sm text-[#6B7280]">{selected.id}</p>
                  </div>
                  <StatusBadge status={selected.status} />
                </div>
                <div className="space-y-2 text-sm">
                  <p className="flex items-start gap-2 text-[#6B7280]">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                    {selected.location}, {selected.city}
                  </p>
                  <p className="text-[#6B7280]">
                    Occupancy: {selected.occupancy}/{selected.capacity}
                  </p>
                  <p className="font-mono text-xs text-[#9CA3AF]">
                    {selected.latitude.toFixed(5)}, {selected.longitude.toFixed(5)}
                  </p>
                </div>
                <Button className="w-full" asChild>
                  <Link href={`/lockers/${selected.id}`}>View Locker</Link>
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Warehouse className="mb-3 h-8 w-8 text-[#D1D5DB]" />
                <p className="text-sm text-[#6B7280]">Select a locker on the map</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
