import type { Load } from "~/api";

// ── Distance calculation (Haversine) ────────────────────────────────────
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinLng * sinLng;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// Average truck speed including stops (km/h)
const AVG_TRUCK_SPEED = 65;

interface ETACardProps {
  load: Load;
}

export function ETACard({ load }: ETACardProps) {
  // Total route distance
  const totalDistance = haversineKm(load.originCoords, load.destCoords);

  // If we have GPS, traveled distance is origin→current; remaining is current→dest
  let traveledDistance = 0;
  let remainingDistance = totalDistance;
  let progress = 0;
  let hasGps = false;

  if (load.currentLocation) {
    hasGps = true;
    traveledDistance = haversineKm(load.originCoords, load.currentLocation);
    remainingDistance = haversineKm(load.currentLocation, load.destCoords);
    progress = Math.min(100, (traveledDistance / totalDistance) * 100);
  } else if (load.status === "accepted" || load.status === "departed") {
    // Assume just started
    progress = 5;
    remainingDistance = totalDistance * 0.95;
  } else if (
    load.status === "in-transit" ||
    load.status === "border-crossing"
  ) {
    // Assume halfway
    progress = 50;
    remainingDistance = totalDistance * 0.5;
  }

  // If delivered, show 100%
  if (load.status === "delivered") {
    progress = 100;
    remainingDistance = 0;
  }

  // ETA computation
  const remainingHours = remainingDistance / AVG_TRUCK_SPEED;
  const etaDate = new Date(Date.now() + remainingHours * 3600 * 1000);

  // Format ETA time as HH:MM
  const etaTime = etaDate.toLocaleTimeString("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const etaDay = etaDate.toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  // Determine state for styling
  let stateLabel: string;
  let stateColor: string;
  if (load.status === "delivered") {
    stateLabel = "Delivered";
    stateColor = "text-emerald-400";
  } else if (!hasGps && load.status !== "in-transit" && load.status !== "border-crossing") {
    stateLabel = "Estimated ETA";
    stateColor = "text-amber-400";
  } else if (progress < 100) {
    stateLabel = "On Track";
    stateColor = "text-emerald-400";
  } else {
    stateLabel = "Arriving";
    stateColor = "text-orange-400";
  }

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
        Estimated ETA
      </p>

      {load.status === "delivered" ? (
        <div className="mt-3 flex items-center gap-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-10 w-10 text-emerald-500"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <p className="text-lg font-bold text-emerald-400">Shipment Complete</p>
            <p className="text-sm text-gray-400">This load has been delivered.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Large ETA display */}
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-4xl font-bold tabular-nums text-white">
              {etaTime}
            </span>
            <span className="text-lg text-gray-400">{etaDay}</span>
          </div>
          <p className={`mt-0.5 text-xs font-medium ${stateColor}`}>
            {stateLabel}
          </p>

          {/* Stats grid */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-gray-800/50 px-3 py-2">
              <p className="text-xs text-gray-500">Remaining</p>
              <p className="text-lg font-semibold tabular-nums text-white">
                {remainingDistance < 10
                  ? `${(remainingDistance * 1000).toFixed(0)} km`
                  : `${remainingDistance.toFixed(0)} km`}
              </p>
            </div>
            <div className="rounded-lg bg-gray-800/50 px-3 py-2">
              <p className="text-xs text-gray-500">Time Left</p>
              <p className="text-lg font-semibold tabular-nums text-white">
                {remainingHours < 1
                  ? `${Math.round(remainingHours * 60)} min`
                  : `${Math.round(remainingHours)}h ${Math.round((remainingHours % 1) * 60)}m`}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Progress</span>
              <span className="font-medium text-gray-300">
                {progress.toFixed(0)}%
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-600 to-orange-400 transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Route info */}
          <div className="mt-4 flex items-center gap-3 text-xs text-gray-500">
            <span>{totalDistance.toFixed(0)} km total</span>
            <span className="text-gray-700">•</span>
            <span>~{AVG_TRUCK_SPEED} km/h avg</span>
          </div>
        </>
      )}
    </div>
  );
}
