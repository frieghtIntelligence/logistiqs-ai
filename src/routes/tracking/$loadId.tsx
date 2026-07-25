import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { fetchLoad, fetchStatusHistory, type Load, type StatusHistoryEntry } from "~/api";
import { getCurrentUser } from "~/auth";
import { TrackingMap } from "~/components/TrackingMap";
import { ShipmentTimeline } from "~/components/ShipmentTimeline";
import { ETACard } from "~/components/ETACard";
import { StatusUpdateButton } from "~/components/StatusUpdateButton";
import { StatusBadge } from "~/components/StatusBadge";

export const Route = createFileRoute("/tracking/$loadId")({
  component: TrackingPage,
});

function TrackingPage() {
  const { loadId } = Route.useParams();
  const [load, setLoad] = useState<Load | null>(null);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{
    id: string;
    email: string;
    name: string;
    role: "shipper" | "carrier";
    company_name: string;
  } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [fetchedLoad, history] = await Promise.all([
        fetchLoad(loadId),
        fetchStatusHistory(loadId),
      ]);
      setLoad(fetchedLoad);
      setStatusHistory(history);
    } catch (e) {
      console.error("Failed to load tracking data:", e);
    } finally {
      setLoading(false);
    }
  }, [loadId]);

  useEffect(() => {
    getCurrentUser()
      .then((u) => {
        setUser(u as any);
        loadData();
      })
      .catch(() => {
        window.location.href = "/login";
      });
  }, [loadData]);

  const handleStatusUpdated = useCallback(
    (updatedLoad: Load) => {
      setLoad(updatedLoad);
      fetchStatusHistory(loadId).then(setStatusHistory).catch(console.error);
    },
    [loadId],
  );

  if (loading) {
    return (
      <div className="flex min-h-[calc(100dvh-57px)] items-center justify-center">
        <svg className="h-6 w-6 animate-spin text-orange-500" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!load) {
    return (
      <div className="flex min-h-[calc(100dvh-57px)] flex-col items-center justify-center">
        <div className="mb-4 rounded-2xl bg-gray-800 p-4 text-gray-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-white">Load Not Found</h2>
        <p className="mt-2 text-sm text-gray-400">
          The shipment <span className="font-mono text-gray-300">{loadId}</span> could not be found.
        </p>
        <a
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600 transition-all"
        >
          Go Home
        </a>
      </div>
    );
  }

  const userRole: "shipper" | "carrier" = user?.role ?? "shipper";

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <a
        href={userRole === "carrier" ? "/carrier" : "/shipper"}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back to {userRole === "carrier" ? "My Trips" : "My Loads"}
      </a>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Shipment Tracking
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            <span className="capitalize">{load.cargoType}</span> · {load.weight}t ·{" "}
            {load.origin} → {load.destination}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">#{load.id}</span>
          <StatusBadge status={load.status} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <TrackingMap
            originCoords={load.originCoords}
            destCoords={load.destCoords}
            currentLocation={load.currentLocation}
            className="h-[400px] sm:h-[500px]"
          />
        </div>

        <div className="lg:col-span-2 space-y-6">
          <ETACard load={load} />

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
            <h3 className="text-sm font-semibold text-gray-300">Shipment Details</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Shipper</dt>
                <dd className="text-gray-300">{load.shipperName}</dd>
              </div>
              {load.carrierName && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Carrier</dt>
                  <dd className="text-gray-300">{load.carrierName}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-gray-500">Pickup Date</dt>
                <dd className="text-gray-300">{load.pickupDate}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Deadline</dt>
                <dd className="text-gray-300">{load.deliveryDeadline}</dd>
              </div>
              {load.notes && (
                <div className="pt-2 border-t border-gray-800">
                  <dt className="text-gray-500 mb-1">Notes</dt>
                  <dd className="text-gray-400">{load.notes}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
            <h3 className="mb-4 text-sm font-semibold text-gray-300">Status Timeline</h3>
            <ShipmentTimeline
              currentStatus={load.status}
              statusHistory={statusHistory}
            />
          </div>

          {user && (
            <StatusUpdateButton
              load={load}
              userRole={userRole}
              userId={user.id}
              onStatusUpdated={handleStatusUpdated}
            />
          )}
        </div>
      </div>
    </div>
  );
}
