"use client";

import Link from "next/link";
import { MapPin, Warehouse } from "lucide-react";
import { useMemo, useState } from "react";
import { DetailHeader } from "@/components/shared/detail-header";
import { SearchBar } from "@/components/shared/search-bar";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { mockLockers } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
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

  const lockers = useMemo(() => {
    return mockLockers.filter((l) => {
      const matchSearch =
        l.boxCode.toLowerCase().includes(search.toLowerCase()) ||
        l.location.toLowerCase().includes(search.toLowerCase()) ||
        l.city.toLowerCase().includes(search.toLowerCase());
      const matchFilter = filter === "all" || l.status === filter;
      return matchSearch && matchFilter;
    });
  }, [search, filter]);

  // Normalize lat/lng to % positions for a simple grid map
  const lats = lockers.map((l) => l.latitude);
  const lngs = lockers.map((l) => l.longitude);
  const minLat = Math.min(...lats, 24.6);
  const maxLat = Math.max(...lats, 25.1);
  const minLng = Math.min(...lngs, 46.5);
  const maxLng = Math.max(...lngs, 47.0);

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
          <CardContent className="relative p-0">
            <div
              className="relative aspect-[4/3] w-full bg-[linear-gradient(135deg,#F8F9FA_25%,#EEF0F2_25%,#EEF0F2_50%,#F8F9FA_50%,#F8F9FA_75%,#EEF0F2_75%)] bg-[length:24px_24px]"
              role="img"
              aria-label="Locker map"
            >
              <div className="absolute inset-4 rounded-xl border border-[#E5E7EB] bg-white/60 backdrop-blur-[1px]">
                {lockers.map((locker) => {
                  const top = 100 - ((locker.latitude - minLat) / (maxLat - minLat || 1)) * 100;
                  const left = ((locker.longitude - minLng) / (maxLng - minLng || 1)) * 100;
                  return (
                    <button
                      key={locker.id}
                      type="button"
                      onClick={() => setSelected(locker)}
                      className={cn(
                        "absolute -translate-x-1/2 -translate-y-1/2 rounded-full p-1.5 transition-transform hover:scale-125 focus-visible:scale-125",
                        selected?.id === locker.id && "ring-2 ring-[#111827] ring-offset-2"
                      )}
                      style={{ top: `${Math.min(Math.max(top, 5), 95)}%`, left: `${Math.min(Math.max(left, 5), 95)}%` }}
                      aria-label={`${locker.boxCode} — ${locker.status}`}
                      title={locker.boxCode}
                    >
                      <span className={cn("block h-3 w-3 rounded-full", statusColors[locker.status])} />
                    </button>
                  );
                })}
              </div>
              <div className="absolute bottom-3 left-3 flex flex-wrap gap-3 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs">
                {(Object.keys(statusColors) as LockerStatus[]).map((s) => (
                  <span key={s} className="flex items-center gap-1.5 capitalize text-[#6B7280]">
                    <span className={cn("h-2 w-2 rounded-full", statusColors[s])} />
                    {s.replace("_", " ")}
                  </span>
                ))}
              </div>
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
