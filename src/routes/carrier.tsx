import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import {
  fetchLoads,
  fetchRankedLoads,
  takeLoad,
  advanceLoadStatus,
  submitProofOfDelivery,
  type Load,
  type LoadStatus,
} from "~/api";
import { getCurrentUser, logout } from "~/auth";
import { MapView } from "~/components/MapView";
import { StatusBadge } from "~/components/StatusBadge";
import { MatchScoreBadge } from "~/components/MatchScoreBadge";
import { BottomNav } from "~/components/BottomNav";
import { ProofOfDelivery } from "~/components/ProofOfDelivery";

export const Route = createFileRoute("/carrier")({
  component: CarrierPortal,
});

type Tab = "browse" | "trips" | "profile";

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
  const [tab, setTab] = useState<Tab>("browse");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [selectedLoad, setSelectedLoad] = useState<Load | null>(null);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [podSubmitting, setPodSubmitting] = useState(false);
  const [activeTripTab, setActiveTripTab] = useState<"active" | "completed">("active");
  const [showPodForLoad, setShowPodForLoad] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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
      // Use AI-ranked loads for browse — returns loads sorted by match score
      const ranked = await fetchRankedLoads();
      // Also fetch all loads for trips (includes accepted, in-transit, etc.)
      const all = await fetchLoads();
      // Merge: use ranked loads for posted, keep all loads for trip reference
      const postedLoads = ranked.loads || [];
      const nonPostedLoads = all.filter((l) => l.status !== "posted");
      // Combine: ranked posted loads first, then non-posted
      setLoads([...postedLoads, ...nonPostedLoads]);
    } catch (e) {
      console.error("refreshLoads error:", e);
      // Fallback to normal fetch
      try {
        const all = await fetchLoads();
        setLoads(all);
      } catch (e2) {
        console.error("fallback fetch error:", e2);
      }
    }
  }, []);

  useEffect(() => {
    if (user) {
      refreshLoads().finally(() => setLoading(false));
    }
  }, [user, refreshLoads]);

  const availableLoads = loads.filter((l) => l.status === "posted");
  const myTrips = loads.filter((l) => l.carrierId === user?.id);
  const activeTrips = myTrips.filter((l) => l.status !== "delivered");
  const completedTrips = myTrips.filter((l) => l.status === "delivered");

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleAccept = async (load: Load) => {
    if (!user) return;
    setAccepting(load.id);
    try {
      const result = await takeLoad({ loadId: load.id });
      if (result) {
        showToast(`Load accepted! ${load.origin} → ${load.destination}`, "success");
        setSelectedLoad(null);
        await refreshLoads();
        // Auto-redirect to My Trips
        setTimeout(() => setTab("trips"), 600);
      } else {
        showToast("Could not accept this load — it may already be taken.", "error");
      }
    } catch (e) {
      console.error("accept error:", e);
      showToast("Failed to accept load. Please try again.", "error");
    } finally {
      setAccepting(null);
    }
  };

  const handleStatusUpdate = async (load: Load, targetStatus: LoadStatus) => {
    setUpdatingStatus(load.id);
    try {
      const updated = await advanceLoadStatus({ loadId: load.id, status: targetStatus as "departed" | "in-transit" | "border-crossing" | "arrived" | "delivered" });
      if (updated) {
        showToast(`Status updated to "${targetStatus}".`, "success");
        if (targetStatus === "delivered") {
          setShowPodForLoad(load.id);
        }
        await refreshLoads();
      } else {
        showToast("Could not update status.", "error");
      }
    } catch (e) {
      console.error("Status update error:", e);
      showToast("Failed to update status.");
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handlePodSubmit = async (data: {
    recipientName: string;
    signatureBase64: string;
    photoBase64: string | null;
    notes: string;
  }) => {
    if (!showPodForLoad) return;
    setPodSubmitting(true);
    try {
      await submitProofOfDelivery({
        loadId: showPodForLoad,
        ...data,
      });
      showToast("Proof of delivery submitted!", "success");
      setShowPodForLoad(null);
      await refreshLoads();
    } catch (e) {
      console.error("POD submit error:", e);
      showToast("Failed to submit proof of delivery.", "error");
    } finally {
      setPodSubmitting(false);
    }
  };

  const handlePullRefresh = async () => {
    setRefreshing(true);
    await refreshLoads();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    await logout();
    document.cookie = "logistiqs_session=; path=/; max-age=0";
    window.location.href = "/";
  };

  const getNextStatusAction = (load: Load): { label: string; target: LoadStatus } | null => {
    const flow: Record<string, { label: string; target: LoadStatus }> = {
      accepted: { label: "Mark Departed", target: "departed" },
      departed: { label: "Begin Transit", target: "in-transit" },
      "in-transit": { label: "Mark Arrived", target: "arrived" },
      "border-crossing": { label: "Mark Arrived", target: "arrived" },
      arrived: { label: "Deliver", target: "delivered" },
    };
    return flow[load.status] ?? null;
  };

  if (authLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <svg className="h-6 w-6 animate-spin text-orange-500" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-4 pb-24 sm:px-6 lg:px-8 md:py-8">
      {/* Toast notification */}
      {toast && (
        <div className="fixed left-4 right-4 top-4 z-50 mx-auto max-w-sm md:left-auto md:right-4 md:max-w-xs">
          <div
            className={`rounded-xl border px-4 py-3 text-sm font-medium shadow-lg animate-slide-in ${
              toast.type === "success"
                ? "border-emerald-500/50 bg-emerald-900/90 text-emerald-200"
                : "border-red-500/50 bg-red-900/90 text-red-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.type === "success" ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              )}
              {toast.msg}
            </div>
          </div>
        </div>
      )}

      {/* Desktop page header */}
      <div className="mb-6 hidden md:block">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Carrier Portal
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Browse available freight loads and manage your trips —{" "}
          <span className="font-medium text-gray-900 dark:text-white">{user.company_name}</span>.
        </p>
      </div>

      {/* Mobile page header */}
      <div className="mb-4 md:hidden">
        <h1 className="text-xl font-bold tracking-tight text-white">
          {tab === "browse" ? "Available Loads" : tab === "trips" ? "My Trips" : "Profile"}
        </h1>
        <p className="text-sm text-gray-400">
          {user.company_name}
        </p>
      </div>

      {/* Desktop top-level tabs */}
      <div className="mb-6 hidden md:flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
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

      {/* ── BROWSE LOADS TAB ─────────────────────────── */}
      {(tab === "browse" || tab === "browse") && (
        <div className={tab !== "browse" ? "hidden md:block" : ""} style={tab !== "browse" ? { display: "none" } : undefined}>
          {/* Desktop list/map toggle */}
          <div className="mb-4 hidden md:flex items-center justify-between">
            <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800">
              <button
                onClick={() => setViewMode("list")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === "list"
                    ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="mr-1 inline h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
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
                <svg xmlns="http://www.w3.org/2000/svg" className="mr-1 inline h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                Map
              </button>
            </div>
            <span className="text-xs text-gray-400">
              {availableLoads.length} load{availableLoads.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Pull to refresh indicator */}
          {refreshing && (
            <div className="flex items-center justify-center py-3 md:hidden">
              <svg className="h-5 w-5 animate-spin text-orange-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="ml-2 text-sm text-gray-400">Refreshing…</span>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <svg className="h-6 w-6 animate-spin text-orange-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : availableLoads.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 py-16 text-center dark:border-gray-700">
              <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="mt-4 text-gray-500 dark:text-gray-400">No available loads right now.</p>
              <p className="text-sm text-gray-400">Check back soon or pull down to refresh.</p>
            </div>
          ) : (
            /* ── LOAD CARDS ─────────────────── */
            <div className="space-y-3">
              {availableLoads.map((load, idx) => {
                const isAccepting = accepting === load.id;
                const isSelected = selectedLoad?.id === load.id;
                const isTopMatch = idx < 5; // top 5 scored loads
                const isGold = idx < 3; // top 3 get gold highlight
                const hasBackhaul = load.isBackhaul === true;
                const matchScore = load.matchScore ?? 0;
                return (
                  <div
                    key={load.id}
                    className={`rounded-2xl border bg-gray-900 transition-all ${
                      isSelected
                        ? "border-orange-500 ring-2 ring-orange-500/20"
                        : isGold
                          ? "border-amber-500/50 ring-1 ring-amber-400/20"
                          : "border-gray-800 hover:border-gray-700"
                    }`}
                  >
                    {/* Card header — always visible, tappable */}
                    <button
                      onClick={() => setSelectedLoad(isSelected ? null : load)}
                      className="w-full p-4 text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-sm font-semibold uppercase text-orange-400">
                              {load.cargoType}
                            </span>
                            <span className="text-sm text-gray-400">— {load.weight}t</span>
                            <StatusBadge status={load.status} />
                          </div>
                          {/* Match badges row */}
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {matchScore > 0 && (
                              <MatchScoreBadge
                                score={matchScore}
                                size="sm"
                                highlight={isGold}
                              />
                            )}
                            {isTopMatch && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                                ⭐ Best Match
                              </span>
                            )}
                            {hasBackhaul && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                                🔄 Backhaul Opportunity
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium text-white truncate">{load.origin}</span>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
                            </svg>
                            <span className="font-medium text-white truncate">{load.destination}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                            <span>Pickup: {load.pickupDate}</span>
                            <span>Deadline: {load.deliveryDeadline}</span>
                          </div>
                        </div>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className={`h-5 w-5 shrink-0 text-gray-500 transition-transform ${isSelected ? "rotate-180" : ""}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                      </div>
                    </button>

                    {/* Expanded detail + Accept button */}
                    {isSelected && (
                      <div className="border-t border-gray-800 px-4 pb-4 pt-3">
                        <p className="text-xs text-gray-500 mb-1">
                          Shipper: <span className="text-gray-300">{load.shipperName}</span>
                        </p>
                        {load.notes && (
                          <p className="text-sm text-gray-400 mb-3 line-clamp-2">
                            📝 {load.notes}
                          </p>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-600">
                            #{load.id} · Posted {new Date(load.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <button
                          disabled={isAccepting}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAccept(load);
                          }}
                          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-4 text-base font-semibold text-white shadow-lg shadow-orange-500/25 transition-all hover:bg-orange-600 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 min-h-[52px]"
                        >
                          {isAccepting ? (
                            <>
                              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              Accepting…
                            </>
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Accept Load
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── MY TRIPS TAB ──────────────────────────── */}
      {tab === "trips" && (
        <div>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <svg className="h-6 w-6 animate-spin text-orange-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : myTrips.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 rounded-2xl bg-gray-800 p-4 text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
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
            <div>
              {/* Active/Completed sub-tabs */}
              <div className="mb-4 flex gap-1 rounded-lg bg-gray-800 p-1">
                <button
                  onClick={() => setActiveTripTab("active")}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeTripTab === "active"
                      ? "bg-gray-700 text-white"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  Active{activeTrips.length > 0 ? ` (${activeTrips.length})` : ""}
                </button>
                <button
                  onClick={() => setActiveTripTab("completed")}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeTripTab === "completed"
                      ? "bg-gray-700 text-white"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  Completed{completedTrips.length > 0 ? ` (${completedTrips.length})` : ""}
                </button>
              </div>

              {activeTripTab === "active" && (
                <div className="space-y-4">
                  {activeTrips.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-500">No active trips.</p>
                  ) : (
                    activeTrips.map((load) => {
                      const nextAction = getNextStatusAction(load);
                      const isUpdating = updatingStatus === load.id;
                      return (
                        <div key={load.id} className="rounded-2xl border border-gray-800 bg-gray-900 overflow-hidden">
                          {/* Active trip card header */}
                          <div className="p-4">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-white text-sm">
                                  {load.origin} → {load.destination}
                                </h3>
                                <StatusBadge status={load.status} />
                              </div>
                              <span className="text-xs text-gray-600 shrink-0">#{load.id}</span>
                            </div>
                            <p className="text-sm text-gray-400">
                              <span className="capitalize">{load.cargoType}</span> · {load.weight}t
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Pickup: {load.pickupDate} · Deadline: {load.deliveryDeadline}
                            </p>
                            <p className="text-xs text-gray-600 mt-0.5">
                              Shipper: {load.shipperName}
                            </p>

                            {/* Quick actions row */}
                            <div className="mt-3 flex gap-2">
                              <a
                                href={`tel:`}
                                className="flex items-center gap-1 rounded-lg bg-gray-800 px-3 py-2 text-xs font-medium text-gray-300 hover:bg-gray-700 transition-colors"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                                </svg>
                                Call
                              </a>
                              <a
                                href={`https://maps.google.com/?q=${encodeURIComponent(load.origin)}`}
                                target="_blank"
                                rel="noopener"
                                className="flex items-center gap-1 rounded-lg bg-gray-800 px-3 py-2 text-xs font-medium text-gray-300 hover:bg-gray-700 transition-colors"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689A1.125 1.125 0 003 6.695v12.889c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
                                </svg>
                                Navigate
                              </a>
                              <a
                                href={`/tracking/${load.id}`}
                                className="flex items-center gap-1 rounded-lg bg-gray-800 px-3 py-2 text-xs font-medium text-gray-300 hover:bg-gray-700 transition-colors"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                                </svg>
                                Track
                              </a>
                            </div>
                          </div>

                          {/* Status update button */}
                          {nextAction && (
                            <div className="border-t border-gray-800 px-4 py-3">
                              <button
                                disabled={isUpdating}
                                onClick={() => handleStatusUpdate(load, nextAction.target)}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 transition-all hover:bg-orange-600 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 min-h-[48px]"
                              >
                                {isUpdating ? (
                                  <>
                                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Updating…
                                  </>
                                ) : (
                                  nextAction.label
                                )}
                              </button>
                            </div>
                          )}

                          {/* Proof of delivery section */}
                          {showPodForLoad === load.id && (
                            <div className="border-t border-gray-800 px-4 py-4">
                              <ProofOfDelivery
                                loadId={load.id}
                                onSubmit={handlePodSubmit}
                                submitting={podSubmitting}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {activeTripTab === "completed" && (
                <div className="space-y-4">
                  {completedTrips.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-500">No completed trips yet.</p>
                  ) : (
                    completedTrips.map((load) => (
                      <div key={load.id} className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-white text-sm">
                              {load.origin} → {load.destination}
                            </h3>
                            <StatusBadge status={load.status} />
                          </div>
                          <span className="text-xs text-gray-600">#{load.id}</span>
                        </div>
                        <p className="text-sm text-gray-400">
                          <span className="capitalize">{load.cargoType}</span> · {load.weight}t
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Shipper: {load.shipperName}
                        </p>
                        <div className="mt-3 flex items-center gap-2">
                          <a
                            href={`/tracking/${load.id}`}
                            className="flex items-center gap-1 rounded-lg bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-700 transition-colors"
                          >
                            View Details
                          </a>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── PROFILE TAB ───────────────────────────── */}
      {tab === "profile" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-500/20 text-orange-400 text-xl font-bold">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">{user.name}</h3>
                <p className="text-sm text-gray-400">{user.company_name}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
            <h4 className="text-sm font-semibold text-gray-300 mb-3">Account Details</h4>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Email</dt>
                <dd className="text-gray-300">{user.email}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Role</dt>
                <dd className="text-gray-300 capitalize">{user.role}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Company</dt>
                <dd className="text-gray-300">{user.company_name}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
            <h4 className="text-sm font-semibold text-gray-300 mb-3">Stats</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-gray-800 p-3 text-center">
                <p className="text-2xl font-bold text-white">{myTrips.length}</p>
                <p className="text-xs text-gray-400">Total Trips</p>
              </div>
              <div className="rounded-lg bg-gray-800 p-3 text-center">
                <p className="text-2xl font-bold text-emerald-400">{completedTrips.length}</p>
                <p className="text-xs text-gray-400">Completed</p>
              </div>
              <div className="rounded-lg bg-gray-800 p-3 text-center">
                <p className="text-2xl font-bold text-orange-400">{activeTrips.length}</p>
                <p className="text-xs text-gray-400">Active</p>
              </div>
              <div className="rounded-lg bg-gray-800 p-3 text-center">
                <p className="text-2xl font-bold text-amber-400">{availableLoads.length}</p>
                <p className="text-xs text-gray-400">Available</p>
              </div>
            </div>
          </div>

          <a
            href="/carrier-settings"
            className="block w-full rounded-xl border border-gray-700 bg-gray-800 py-3.5 text-center text-sm font-semibold text-gray-300 hover:bg-gray-700 transition-colors min-h-[48px]"
          >
            ⚙️ Matching Preferences
          </a>

          <button
            onClick={handleLogout}
            className="w-full rounded-xl border border-red-800 bg-red-950/30 py-3.5 text-sm font-semibold text-red-400 hover:bg-red-950/50 transition-colors min-h-[48px]"
          >
            Sign Out
          </button>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <BottomNav activeTab={tab} onTabChange={setTab} role="carrier" />
    </div>
  );
}
