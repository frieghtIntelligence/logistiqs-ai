import { useEffect, useRef, useState } from "react";

interface Coords {
  lat: number;
  lng: number;
}

interface TrackingMapProps {
  originCoords: Coords;
  destCoords: Coords;
  currentLocation?: Coords | null;
  className?: string;
}

export function TrackingMap({
  originCoords,
  destCoords,
  currentLocation,
  className = "",
}: TrackingMapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl border border-gray-800 bg-gray-900 ${className}`}
      >
        <span className="text-sm text-gray-500">Loading map…</span>
      </div>
    );
  }

  return (
    <TrackingMapInner
      originCoords={originCoords}
      destCoords={destCoords}
      currentLocation={currentLocation}
      className={className}
    />
  );
}

function TrackingMapInner({
  originCoords,
  destCoords,
  currentLocation,
  className = "",
}: TrackingMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !containerRef.current) return;

      // Fix default icon paths
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      const map = L.map(containerRef.current, {
        zoomControl: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
      }).setView([-22, 27], 5);

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
          maxZoom: 18,
        },
      ).addTo(map);

      mapRef.current = map;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Draw route + markers when ready or coords change
  useEffect(() => {
    if (!ready || !mapRef.current) return;

    const L = (window as any).L as typeof import("leaflet") | undefined;
    if (!L) return;

    const map = mapRef.current;

    // Clear previous layers
    map.eachLayer((layer: L.Layer) => {
      if ((layer as any)._isTrackingLayer) {
        map.removeLayer(layer);
      }
    });

    const origin: L.LatLngTuple = [originCoords.lat, originCoords.lng];
    const dest: L.LatLngTuple = [destCoords.lat, destCoords.lng];

    // ── Glow layer (underneath) ─────────────────────────────
    const glowLine = L.polyline([origin, dest], {
      color: "#f97316",
      weight: 8,
      opacity: 0.12,
    }).addTo(map);
    (glowLine as any)._isTrackingLayer = true;

    // ── Dashed planned route ────────────────────────────────
    const dashedLine = L.polyline([origin, dest], {
      color: "#f97316",
      weight: 3,
      opacity: 0.4,
      dashArray: "10 6",
    }).addTo(map);
    (dashedLine as any)._isTrackingLayer = true;

    // ── Origin marker (gray circle with "O") ────────────────
    const originIcon = L.divIcon({
      className: "",
      html: `<div style="width:28px;height:28px;border-radius:50%;background:#374151;border:2px solid #6b7280;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:13px;font-weight:700;font-family:Inter,system-ui,sans-serif;">O</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    const originMarker = L.marker(origin, { icon: originIcon })
      .addTo(map)
      .bindTooltip("Origin", {
        permanent: true,
        direction: "top",
        offset: [0, -6],
        className: "tracking-tooltip",
      });
    (originMarker as any)._isTrackingLayer = true;

    // ── Destination marker (orange pin) ─────────────────────
    const destIcon = L.divIcon({
      className: "",
      html: `<div style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#f97316" stroke="#ea580c" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/></svg></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });
    const destMarker = L.marker(dest, { icon: destIcon })
      .addTo(map)
      .bindTooltip("Destination", {
        permanent: true,
        direction: "top",
        offset: [0, -6],
        className: "tracking-tooltip",
      });
    (destMarker as any)._isTrackingLayer = true;

    // ── Truck marker (if GPS data exists) ───────────────────
    if (currentLocation) {
      const truckPos: L.LatLngTuple = [currentLocation.lat, currentLocation.lng];
      const truckIcon = L.divIcon({
        className: "",
        html: `<div style="position:relative;width:24px;height:24px;"><div style="position:absolute;inset:-4px;border-radius:50%;background:#f97316;opacity:0.3;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div><div style="width:24px;height:24px;border-radius:50%;background:#f97316;border:3px solid #fdba74;position:relative;z-index:1;"></div></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      const truckMarker = L.marker(truckPos, { icon: truckIcon })
        .addTo(map)
        .bindTooltip("Current location", {
          permanent: true,
          direction: "top",
          offset: [0, -6],
          className: "tracking-tooltip",
        });
      (truckMarker as any)._isTrackingLayer = true;
    }

    // ── Fit bounds to show both origin and dest ─────────────
    map.fitBounds([origin, dest], { padding: [80, 80] });
  }, [ready, originCoords, destCoords, currentLocation]);

  return (
    <div
      ref={containerRef}
      className={`rounded-2xl border border-gray-800 ${className}`}
    />
  );
}
