import { useEffect, useRef, useState, useCallback } from "react";
import type { Load } from "~/store";

interface MapViewProps {
  loads: Load[];
  onLoadClick?: (load: Load) => void;
}

// Renders nothing during SSR; mounts Leaflet on the client only.
export function MapView({ loads, onLoadClick }: MapViewProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex h-[500px] w-full items-center justify-center rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
        <span className="text-sm text-gray-400">Loading map…</span>
      </div>
    );
  }

  return <MapInner loads={loads} onLoadClick={onLoadClick} />;
}

function MapInner({ loads, onLoadClick }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const [ready, setReady] = useState(false);

  // One-time init: load Leaflet dynamically
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !containerRef.current) return;

      // Fix default marker icon paths (broken by bundlers)
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current).setView([-22, 27], 5);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution:
          '&copy; <a href="https://carto.com/">CARTO</a>',
        maxZoom: 18,
      }).addTo(map);

      mapRef.current = map;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync markers when loads change
  useEffect(() => {
    if (!ready || !mapRef.current) return;

    const L = (window as any).L as typeof import("leaflet") | undefined;
    if (!L) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    loads.forEach((load) => {
      const marker = L.marker([load.originCoords.lat, load.originCoords.lng])
        .addTo(mapRef.current!)
        .bindPopup(`
          <div style="font-family:system-ui,sans-serif;min-width:180px">
            <strong style="font-size:14px">${load.cargoType} — ${load.weight}t</strong><br/>
            <span style="font-size:12px;color:#555">${load.origin} → ${load.destination}</span><br/>
            <span style="font-size:11px;color:#888">${load.shipperName}</span>
          </div>
        `);

      if (onLoadClick) {
        marker.on("click", () => onLoadClick(load));
      }

      markersRef.current.push(marker);
    });
  }, [loads, ready, onLoadClick]);

  return (
    <div
      ref={containerRef}
      className="h-[500px] w-full rounded-xl border border-gray-200 dark:border-gray-700"
    />
  );
}
