declare namespace google.maps {
  class Map {
    constructor(el: HTMLElement, opts?: Record<string, unknown>);
    panTo(latLng: { lat: number; lng: number }): void;
    setZoom(zoom: number): void;
    fitBounds(bounds: LatLngBounds, padding?: number): void;
  }

  class Marker {
    constructor(opts?: Record<string, unknown>);
    setMap(map: Map | null): void;
    addListener(event: string, handler: () => void): void;
  }

  class LatLngBounds {
    extend(latLng: { lat: number; lng: number }): void;
  }

  enum SymbolPath {
    CIRCLE,
  }
}

declare const google: { maps: typeof google.maps };
