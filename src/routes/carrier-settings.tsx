import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { getCurrentUser } from "~/auth";
import { updateCarrierPreferences, fetchCarrierPreferences } from "~/api";

export const Route = createFileRoute("/carrier-settings")({
  component: CarrierSettings,
});

const ALL_CARGO_TYPES = [
  "copper",
  "coal",
  "fuel",
  "grain",
  "machinery",
  "cement",
  "steel",
  "fertilizer",
  "iron ore",
  "general freight",
  "other",
];

const ALL_REGIONS = [
  { code: "SA", label: "South Africa 🇿🇦" },
  { code: "Zim", label: "Zimbabwe 🇿🇼" },
  { code: "Zam", label: "Zambia 🇿🇲" },
  { code: "Bots", label: "Botswana 🇧🇼" },
  { code: "Moz", label: "Mozambique 🇲🇿" },
  { code: "Nam", label: "Namibia 🇳🇦" },
];

function CarrierSettings() {
  const [user, setUser] = useState<{
    id: string;
    email: string;
    name: string;
    role: string;
    company_name: string;
  } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Preferences form state
  const [homeCity, setHomeCity] = useState("");
  const [preferredCargoTypes, setPreferredCargoTypes] = useState<string[]>([]);
  const [preferredRegions, setPreferredRegions] = useState<string[]>([]);
  const [onTimeRate, setOnTimeRate] = useState(0.9);

  // Check auth + load preferences
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

  useEffect(() => {
    if (!user) return;
    fetchCarrierPreferences()
      .then((data) => {
        setHomeCity(data.preferences.homeCity || "");
        setPreferredCargoTypes(data.preferences.preferredCargoTypes || []);
        setPreferredRegions(data.preferences.preferredRegions || []);
        setOnTimeRate(data.onTimeRate);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user]);

  const toggleCargoType = (ct: string) => {
    setPreferredCargoTypes((prev) =>
      prev.includes(ct) ? prev.filter((c) => c !== ct) : [...prev, ct],
    );
  };

  const toggleRegion = (region: string) => {
    setPreferredRegions((prev) =>
      prev.includes(region) ? prev.filter((r) => r !== region) : [...prev, region],
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      await updateCarrierPreferences({
        homeCity: homeCity.trim(),
        preferredCargoTypes,
        preferredRegions,
      });
      setMessage("Preferences saved successfully!");
    } catch (e) {
      setMessage("Failed to save preferences. Please try again.");
    } finally {
      setSaving(false);
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
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Carrier Preferences
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Customize your matching profile —{" "}
          <span className="font-medium text-gray-900 dark:text-white">{user.company_name}</span>.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <svg className="h-6 w-6 animate-spin text-orange-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6 sm:p-8">
          {message && (
            <div
              className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
                message.startsWith("Preferences saved")
                  ? "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300"
                  : "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300"
              }`}
            >
              {message}
            </div>
          )}

          {/* On-time rate display (read-only) */}
          <div className="mb-8 rounded-xl border border-gray-700 bg-gray-800/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-300">On-Time Delivery Rate</p>
                <p className="mt-1 text-xs text-gray-500">Simulated performance metric — used in shipper matching</p>
              </div>
              <span className="text-2xl font-bold text-emerald-400">
                {(onTimeRate * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          {/* Home City */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Home City / Base Location
            </label>
            <input
              type="text"
              placeholder="e.g. Johannesburg"
              value={homeCity}
              onChange={(e) => setHomeCity(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none transition-colors"
            />
            <p className="mt-1.5 text-xs text-gray-500">
              Used for backhaul detection and route proximity scoring.
            </p>
          </div>

          {/* Preferred Cargo Types */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Preferred Cargo Types
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_CARGO_TYPES.map((ct) => (
                <button
                  key={ct}
                  type="button"
                  onClick={() => toggleCargoType(ct)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                    preferredCargoTypes.includes(ct)
                      ? "bg-orange-500/20 text-orange-400 border border-orange-500/40"
                      : "bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600"
                  }`}
                >
                  {ct.charAt(0).toUpperCase() + ct.slice(1)}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Select cargo types you specialize in. Exact matches score highest; related types get partial credit.
            </p>
          </div>

          {/* Preferred Regions */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Preferred Operating Regions
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_REGIONS.map((r) => (
                <button
                  key={r.code}
                  type="button"
                  onClick={() => toggleRegion(r.code)}
                  className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                    preferredRegions.includes(r.code)
                      ? "bg-orange-500/20 text-orange-400 border border-orange-500/40"
                      : "bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Select regions where you operate. Improves route familiarity matching.
            </p>
          </div>

          {/* Save button */}
          <div className="flex items-center justify-between border-t border-gray-800 pt-6">
            <a
              href="/carrier"
              className="text-sm text-gray-400 hover:text-gray-300 transition-colors"
            >
              ← Back to Portal
            </a>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600 transition-all disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving…
                </>
              ) : (
                "Save Preferences"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
