import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { postLoad, fetchLoads, type Load } from "~/api";

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
  const [shipperName, setShipperName] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("shipperName") || "";
    }
    return "";
  });
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

  const refreshLoads = async () => {
    try {
      const all = await fetchLoads();
      setLoads(all.filter((l) => l.shipperName === shipperName));
    } catch (e) {
      console.error("fetchLoads error:", e);
    }
  };

  useEffect(() => {
    if (shipperName) {
      refreshLoads().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [shipperName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shipperName.trim()) return;
    setSubmitting(true);
    setSuccessMsg("");
    try {
      await postLoad({
        shipperName: shipperName.trim(),
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

  const myLoads = loads.filter((l) => l.shipperName === shipperName);

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      posted:
        "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
      accepted:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
      "in-transit":
        "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
      delivered:
        "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    };
    return (
      <span
        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${colors[status] || "bg-gray-100 text-gray-800"}`}
      >
        {status}
      </span>
    );
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Shipper Portal
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Post freight loads and track your shipments.
        </p>
      </div>

      {/* Shipper name entry */}
      {!shipperName.trim() ? (
        <div className="mx-auto max-w-md rounded-2xl border border-gray-200 bg-white p-8 dark:border-gray-700 dark:bg-gray-900">
          <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">
            Your company name
          </label>
          <input
            type="text"
            placeholder="e.g. Kansanshi Mining PLC"
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500"
            value={shipperName}
            onChange={(e) => setShipperName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && shipperName.trim()) {
                localStorage.setItem("shipperName", shipperName.trim());
                setLoading(true);
              }
            }}
          />
          <button
            className="mt-4 w-full rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
            disabled={!shipperName.trim()}
            onClick={() => {
              localStorage.setItem("shipperName", shipperName.trim());
              setLoading(true);
            }}
          >
            Continue
          </button>
        </div>
      ) : (
        <>
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
              className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900 sm:p-8"
            >
              <h2 className="mb-6 text-xl font-semibold text-gray-900 dark:text-white">
                Load Details
              </h2>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Shipper
                  </label>
                  <input
                    type="text"
                    value={shipperName}
                    disabled
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Origin City / Town *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Lusaka"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Destination City / Town *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Johannesburg"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Cargo Type *
                  </label>
                  <select
                    required
                    value={cargoType}
                    onChange={(e) => setCargoType(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  >
                    {CARGO_TYPES.map((ct) => (
                      <option key={ct} value={ct}>
                        {ct.charAt(0).toUpperCase() + ct.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Weight (tons) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={80}
                    value={weight}
                    onChange={(e) => setWeight(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Pickup Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={pickupDate}
                    onChange={(e) => setPickupDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Delivery Deadline *
                  </label>
                  <input
                    type="date"
                    required
                    value={deliveryDeadline}
                    onChange={(e) => setDeliveryDeadline(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Notes
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Special requirements, loading info, contact details..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500"
                  />
                </div>
              </div>

              <div className="mt-8 flex items-center justify-between border-t border-gray-100 pt-6 dark:border-gray-800">
                <p className="text-xs text-gray-500">
                  Your load will be visible to all carriers on the platform.
                </p>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
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
                      d="M3 7.5L12 3l9 4.5M3 7.5v9l9 4.5 9-4.5v-9M3 7.5l9 4.5 9-4.5"
                    />
                  </svg>
                  <p className="mt-4 text-gray-500 dark:text-gray-400">
                    You haven&apos;t posted any loads yet.
                  </p>
                  <button
                    onClick={() => setTab("post")}
                    className="mt-3 text-sm font-medium text-orange-500 hover:text-orange-600"
                  >
                    + Post your first load
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
                            {statusBadge(load.status)}
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
        </>
      )}
    </div>
  );
}
