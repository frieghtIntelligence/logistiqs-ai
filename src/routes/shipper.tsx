import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { postLoad, fetchLoads, type Load } from "~/api";
import { getCurrentUser } from "~/auth";
import { StatusBadge } from "~/components/StatusBadge";

export const Route = createFileRoute("/shipper")({
  component: ShipperPortal,
});

const CARGO_TYPES = [
  "coal",
  "copper",
  "general freight",
  "fuel",
  "grain",
  "machinery",
  "cement",
  "steel",
  "fertilizer",
  "iron ore",
  "other",
];

function ShipperPortal() {
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
  const [tab, setTab] = useState<"post" | "my">("post");

  // Form state
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [cargoType, setCargoType] = useState("coal");
  const [weight, setWeight] = useState(20);
  const [pickupDate, setPickupDate] = useState("");
  const [deliveryDeadline, setDeliveryDeadline] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // Check auth on mount
  useEffect(() => {
    getCurrentUser()
      .then((u) => {
        if (!u || u.role !== "shipper") {
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
    if (!user) return;
    try {
      const all = await fetchLoads();
      setLoads(all.filter((l) => l.shipperId === user.id));
    } catch (e) {
      console.error("fetchLoads error:", e);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      refreshLoads().finally(() => setLoading(false));
    }
  }, [user, refreshLoads]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    setSuccessMsg("");
    try {
      await postLoad({
        origin: origin.trim(),
        destination: destination.trim(),
        cargoType,
        weight,
        pickupDate,
        deliveryDeadline,
        notes: notes.trim(),
      });
      // Clear form
      setOrigin("");
      setDestination("");
      setCargoType("coal");
      setWeight(20);
      setPickupDate("");
      setDeliveryDeadline("");
      setNotes("");
      setSuccessMsg("Load posted successfully! Carriers can now see it.");
      await refreshLoads();
    } catch (e) {
      console.error("postLoad error:", e);
      setSuccessMsg("Failed to post load. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const myLoads = loads;

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
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Shipper Portal
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Post freight loads and track your shipments —{" "}
          <span className="font-medium text-gray-900 dark:text-white">{user.company_name}</span>.
        </p>
      </div>

      {/* Tab bar */}
      <div className="mb-6 flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
        <button
          onClick={() => setTab("post")}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === "post"
              ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
              : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          + Post a Load
        </button>
        <button
          onClick={() => setTab("my")}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === "my"
              ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
              : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          My Loads{myLoads.length > 0 ? ` (${myLoads.length})` : ""}
        </button>
      </div>

      {successMsg && (
        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300">
          {successMsg}
        </div>
      )}

      {/* Post a Load form */}
      {tab === "post" && (
        <form
          onSubmit={handleSubmit}
          className="mx-auto max-w-2xl rounded-2xl border border-gray-800 bg-gray-900 p-6 sm:p-8"
        >
          <h2 className="mb-6 text-xl font-semibold text-white">
            Load Details
          </h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Shipper
              </label>
              <input
                type="text"
                value={user.company_name}
                disabled
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-gray-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Origin City / Town *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Lusaka"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Destination City / Town *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Johannesburg"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Cargo Type *
              </label>
              <select
                required
                value={cargoType}
                onChange={(e) => setCargoType(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none transition-colors"
              >
                {CARGO_TYPES.map((ct) => (
                  <option key={ct} value={ct}>
                    {ct.charAt(0).toUpperCase() + ct.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Weight (tons) *
              </label>
              <input
                type="number"
                required
                min={1}
                max={80}
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Pickup Date *
              </label>
              <input
                type="date"
                required
                value={pickupDate}
                onChange={(e) => setPickupDate(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Delivery Deadline *
              </label>
              <input
                type="date"
                required
                value={deliveryDeadline}
                onChange={(e) => setDeliveryDeadline(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none transition-colors"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Notes
              </label>
              <textarea
                rows={3}
                placeholder="Special requirements, loading info, contact details..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between border-t border-gray-800 pt-6">
            <p className="text-xs text-gray-500">
              Your load will be visible to all carriers on the platform.
            </p>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600 transition-all disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
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
                  Posting…
                </>
              ) : (
                "Post Load"
              )}
            </button>
          </div>
        </form>
      )}

      {/* My Loads */}
      {tab === "my" && (
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
          ) : myLoads.length === 0 ? (
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
                    d="M3 7.5L12 3l9 4.5M3 7.5v9l9 4.5 9-4.5v-9M3 7.5l9 4.5 9-4.5"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-300">No loads yet</h3>
              <p className="mt-2 max-w-sm text-sm text-gray-500">
                Loads you post will appear here. Ready to move your first shipment?
              </p>
              <button
                onClick={() => setTab("post")}
                className="mt-6 rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600 transition-all"
              >
                Post Your First Load
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {myLoads.map((load) => (
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
                        {load.cargoType} · {load.weight}t · Pickup:{" "}
                        {load.pickupDate} · Deadline:{" "}
                        {load.deliveryDeadline}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400">
                      #{load.id}
                    </span>
                  </div>
                  {load.carrierName && (
                    <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-gray-800">
                      <span className="text-gray-500">Carrier: </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {load.carrierName}
                      </span>
                    </div>
                  )}
                  {load.notes && (
                    <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                      📝 {load.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
