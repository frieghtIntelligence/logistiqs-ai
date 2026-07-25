import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { fetchLoads, takeLoad, type Load } from "~/api";
import { getCurrentUser } from "~/auth";
import { MapView } from "~/components/MapView";
import { StatusBadge } from "~/components/StatusBadge";

export const Route = createFileRoute("/carrier")({
  component: CarrierPortal,
});

function CarrierPortal() {
  const [user, setUser] = useState<{
    id: string;
    email: string;
    name: string;
    role: string;
    company_name: string;
  } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loads, setLoads] = useState<Load[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"browse" | "trips">("browse");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [selectedLoad, setSelectedLoad] = useState<Load | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [message, setMessage] = useState("");

  // Check auth on mount
  useEffect(() => {
    getCurrentUser()
      .then((u) => {
        if (!u || u.role !== "carrier") {
          window.location.href = "/login";
          return;
        }
        setUser(u);
        setAuthLoading(false);
      })
      .catch(() => {
        window.location.href = "/login";
      });
  }, []);

  const refreshLoads = useCallback(async () => {
    try {
      const all = await fetchLoads();
      setLoads(all);
    } catch (e) {
      console.error("fetchLoads error:", e);
    }
  }, []);

  useEffect(() => {
    if (user) {
      refreshLoads().finally(() => setLoading(false));
    }
  }, [user, refreshLoads]);

  const availableLoads = loads.filter((l) => l.status === "posted");
  const myTrips = loads.filter((l) => l.carrierId === user?.id);

  const handleAccept = async (load: Load) => {
    if (!user) return;
    setAccepting(true);
    setMessage("");
    try {
      const result = await takeLoad({ loadId: load.id });
      if (result) {
        setMessage(`Accepted load #${load.id}: ${load.origin} → ${load.destination}`);
        setSelectedLoad(null);
        await refreshLoads();
        setTab("trips");
      } else {
        setMessage("Could not accept this load — it may already be taken.");
      }
    } catch (e) {
      console.error("accept error:", e);
      setMessage("Failed to accept load. Please try again.");
    } finally {
      setAccepting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[calc(100dvh-57px)] items-center justify-center">
        <svg className="h-6 w-6 animate-spin text-orange-500" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Carrier Portal
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Browse available freight loads and manage your trips —{" "}
          <span className="font-medium text-gray-900 dark:text-white">{user.company_name}</span>.
        </p>
      </div>

      {/* Top-level tabs: Browse vs My Trips */}
      <div className="mb-6 flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
        <button
          onClick={() => setTab("browse")}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === "browse"
              ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
              : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          Browse Loads{availableLoads.length > 0 ? ` (${availableLoads.length})` : ""}
        </button>
        <button
          onClick={() => setTab("trips")}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === "trips"
              ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
              : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          My Trips{myTrips.length > 0 ? ` (${myTrips.length})` : ""}
        </button>
      </div>

      {message && (
        <div
          className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
            message.startsWith("Accepted")
              ? "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300"
              : message.startsWith("Could") || message.startsWith("Failed")
                ? "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300"
                : "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
          }`}
        >
          {message}
        </div>
      )}

      {/* ── Browse Loads ─────────────────────────── */}
      {tab === "browse" && (
        <>
          {/* List / Map sub-tabs */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800">
              <button
                onClick={() => setViewMode("list")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === "list"
                    ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="mr-1 inline h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 6h16M4 10h16M4 14h16M4 18h16"
                  />
                </svg>
                List
              </button>
              <button
                onClick={() => setViewMode("map")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === "map"
                    ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="mr-1 inline h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                  />
                </svg>
                Map
              </button>
            </div>
            <span className="text-xs text-gray-400">
              {availableLoads.length} load{availableLoads.length !== 1 ? "s" : ""} available
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <svg
                className="h-6 w-6 animate-spin text-orange-500"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            </div>
          ) : availableLoads.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 py-16 text-center dark:border-gray-700">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <p className="mt-4 text-gray-500 dark:text-gray-400">
                No available loads right now. Check back soon.
              </p>
            </div>
          ) : viewMode === "list" ? (
            /* ── List View ─────────────────── */
            <div className="space-y-3">
              {availableLoads.map((load) => (
                <div
                  key={load.id}
                  onClick={() =>
                    setSelectedLoad(
                      selectedLoad?.id === load.id ? null : load,
                    )
                  }
                  className={`cursor-pointer rounded-xl border bg-white p-4 transition-all hover:shadow-md dark:bg-gray-900 ${
                    selectedLoad?.id === load.id
                      ? "border-orange-400 ring-2 ring-orange-500/20 dark:border-orange-500"
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {load.origin} → {load.destination}
                        </h3>
                        <StatusBadge status={load.status} />
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
                        <span className="capitalize">{load.cargoType}</span>
                        <span>{load.weight}t</span>
                        <span>Pickup: {load.pickupDate}</span>
                        <span>Deadline: {load.deliveryDeadline}</span>
                      </div>
                      <p className="mt-1 text-xs text-gray-400">
                        Posted by {load.shipperName}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-gray-400">
                      #{load.id}
                    </span>
                  </div>

                  {/* Expanded detail */}
                  {selectedLoad?.id === load.id && (
                    <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-800">
                      {load.notes && (
                        <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
                          📝 {load.notes}
                        </p>
                      )}
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs text-gray-400">
                          Posted {new Date(load.createdAt).toLocaleDateString()}
                        </div>
                        <button
                          disabled={accepting}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAccept(load);
                          }}
                          className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {accepting ? (
                            <>
                              <svg
                                className="h-4 w-4 animate-spin"
                                viewBox="0 0 24 24"
                                fill="none"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                />
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                />
                              </svg>
                              Accepting…
                            </>
                          ) : (
                            "Accept Load"
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* ── Map View ──────────────────── */
            <div>
              <MapView
                loads={availableLoads}
                onLoadClick={(load) => setSelectedLoad(load)}
              />

              {/* Selected load popup on map view */}
              {selectedLoad && (
                <div className="mt-4 rounded-xl border border-orange-400 bg-white p-5 shadow-md dark:border-orange-500 dark:bg-gray-900">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {selectedLoad.origin} → {selectedLoad.destination}
                      </h3>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        <span className="capitalize">{selectedLoad.cargoType}</span> ·{" "}
                        {selectedLoad.weight}t · {selectedLoad.shipperName}
                      </p>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Pickup: {selectedLoad.pickupDate} · Deadline:{" "}
                        {selectedLoad.deliveryDeadline}
                      </p>
                      {selectedLoad.notes && (
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                          📝 {selectedLoad.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 flex gap-3">
                    <button
                      disabled={accepting}
                      onClick={() => handleAccept(selectedLoad)}
                      className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {accepting ? "Accepting…" : "Accept Load"}
                    </button>
                    <button
                      onClick={() => setSelectedLoad(null)}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── My Trips ──────────────────────────── */}
      {tab === "trips" && (
        <div>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <svg
                className="h-6 w-6 animate-spin text-orange-500"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            </div>
          ) : myTrips.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 rounded-2xl bg-gray-800 p-4 text-gray-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-300">No trips yet</h3>
              <p className="mt-2 max-w-sm text-sm text-gray-500">
                Loads you accept will appear here. Browse available loads to get started.
              </p>
              <button
                onClick={() => setTab("browse")}
                className="mt-6 rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600 transition-all"
              >
                Browse Available Loads
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {myTrips.map((load) => (
                <div
                  key={load.id}
                  className="rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-900"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {load.origin} → {load.destination}
                        </h3>
                        <StatusBadge status={load.status} />
                      </div>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        <span className="capitalize">{load.cargoType}</span> ·{" "}
                        {load.weight}t · Pickup: {load.pickupDate} · Deadline:{" "}
                        {load.deliveryDeadline}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        Shipper: {load.shipperName}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400">#{load.id}</span>
                  </div>
                  {load.notes && (
                    <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                      📝 {load.notes}
                    </p>
                  )}
                  <div className="mt-4 flex items-center gap-3">
                    <a
                      href={`/tracking/${load.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-300 hover:border-gray-600 hover:text-white transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                      </svg>
                      Track
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
