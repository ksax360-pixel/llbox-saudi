"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Locker, LockerStatus } from "@/types";

declare global {
  interface Window {
    google?: typeof google;
  }
}

const statusColors: Record<LockerStatus, string> = {
  available: "#10B981",
  in_use: "#3B82F6",
  maintenance: "#F59E0B",
  deactivated: "#9CA3AF",
};

interface LockerGoogleMapProps {
  apiKey: string;
  lockers: Locker[];
  selected: Locker | null;
  onSelect: (locker: Locker) => void;
}

export function LockerGoogleMap({ apiKey, lockers, selected, onSelect }: LockerGoogleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!apiKey || !mapRef.current) {
      setLoading(false);
      setError("Google Maps API key is not configured.");
      return;
    }

    let cancelled = false;

    const initMap = () => {
      if (cancelled || !mapRef.current || !window.google) return;

      const center = lockers.length
        ? { lat: lockers[0].latitude, lng: lockers[0].longitude }
        : { lat: 24.7136, lng: 46.6753 };

      mapInstance.current = new window.google.maps.Map(mapRef.current, {
        center,
        zoom: 11,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
      });

      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = lockers.map((locker) => {
        const marker = new window.google.maps.Marker({
          position: { lat: locker.latitude, lng: locker.longitude },
          map: mapInstance.current!,
          title: locker.boxCode,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: statusColors[locker.status],
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
        });
        marker.addListener("click", () => onSelect(locker));
        return marker;
      });

      if (lockers.length > 1 && window.google.maps.LatLngBounds) {
        const bounds = new window.google.maps.LatLngBounds();
        lockers.forEach((locker) => bounds.extend({ lat: locker.latitude, lng: locker.longitude }));
        mapInstance.current.fitBounds(bounds, 48);
      }

      setLoading(false);
    };

    if (window.google?.maps) {
      initMap();
      return () => {
        cancelled = true;
      };
    }

    const scriptId = "google-maps-script";
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", initMap);
      return () => {
        cancelled = true;
        existing.removeEventListener("load", initMap);
      };
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = initMap;
    script.onerror = () => {
      if (!cancelled) {
        setError("Could not load Google Maps.");
        setLoading(false);
      }
    };
    document.head.appendChild(script);

    return () => {
      cancelled = true;
    };
  }, [apiKey, lockers, onSelect]);

  useEffect(() => {
    if (!selected || !mapInstance.current) return;
    mapInstance.current.panTo({ lat: selected.latitude, lng: selected.longitude });
    mapInstance.current.setZoom(14);
  }, [selected]);

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-[#E5E7EB] bg-[#F8F9FA]">
      <div ref={mapRef} className="h-full w-full" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm text-[#6B7280]">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading map…
        </div>
      )}
      {!loading && error && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/90 px-6 text-center text-sm text-[#6B7280]">
          {error}
        </div>
      )}
    </div>
  );
}
