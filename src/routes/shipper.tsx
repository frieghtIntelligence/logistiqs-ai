import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { postLoad, fetchLoads, fetchAllLoadSuggestions, type Load, type CarrierSuggestion } from "~/api";
import { getCurrentUser, logout } from "~/auth";
import { StatusBadge } from "~/components/StatusBadge";
import { BottomNav } from "~/components/BottomNav";

export const Route = createFileRoute("/shipper")({
  component: ShipperPortal,
});

type Tab = "post" | "my" | "profile";

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
  const [tab, setTab] = useState<Tab>("post");

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
  const [suggestions, setSuggestions] = useState<Record<string, CarrierSuggestion[]>>({});

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
      // Also fetch AI carrier suggestions for unaccepted loads
      try {
        const suggs = await fetchAllLoadSuggestions();
        setSuggestions(suggs);
      } catch {
        // Suggestions are non-critical
      }
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

  const handleLogout = async () => {
    await logout();
    document.cookie = "logistiqs_session=; path=/; max-age=0";
    window.location.href = "/";
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
    <div className="mx-auto max-w-5xl px-4 py-4 pb-24 sm:px-6 lg:px-8 md:py-8">
      <div className="mb-6 hidden md:block">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Shipper Portal</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Post freight loads and track your shipments — <span className="font-medium text-gray-900 dark:text-white">{user.company_name}</span>.
        </p>
      </div>
      <div className="mb-4 md:hidden">
        <h1 className="text-xl font-bold tracking-tight text-white">{tab === "post" ? "Post a Load" : tab === "my" ? "My Loads" : "Profile"}</h1>
        <p className="text-sm text-gray-400">{user.company_name}</p>
      </div>
      <div className="mb-6 hidden md:flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
        <button onClick={() => setTab("post")} className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === "post" ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white" : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"}`}>
          + Post a Load
        </button>
        <button onClick={() => setTab("my")} className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === "my" ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white" : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"}`}>
          My Loads{myLoads.length > 0 ? ` (${myLoads.length})` : ""}
        </button>
      </div>

      {successMsg && (
        <div className="mb-4 rounded-xl border border-emerald-800 bg-emerald-900/30 px-4 py-3 text-sm text-emerald-300">{successMsg}</div>
      )}

      {tab === "post" && (
        <form onSubmit={handleSubmit} className="mx-auto max-w-2xl rounded-2xl border border-gray-800 bg-gray-900 p-5 sm:p-8">
          <h2 className="mb-5 text-xl font-semibold text-white">Load Details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Shipper</label>
              <input type="text" value={user.company_name} disabled className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-base text-gray-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Origin City / Town *</label>
              <input type="text" required placeholder="e.g. Lusaka" value={origin} onChange={(e) => setOrigin(e.target.value)} className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-base text-white placeholder:text-gray-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Destination City / Town *</label>
              <input type="text" required placeholder="e.g. Johannesburg" value={destination} onChange={(e) => setDestination(e.target.value)} className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-base text-white placeholder:text-gray-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Cargo Type *</label>
              <select required value={cargoType} onChange={(e) => setCargoType(e.target.value)} className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-base text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none transition-colors">
                {CARGO_TYPES.map((ct) => (<option key={ct} value={ct}>{ct.charAt(0).toUpperCase() + ct.slice(1)}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Weight (tons) *</label>
              <input type="number" required min={1} max={80} value={weight} onChange={(e) => setWeight(Number(e.target.value))} className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-base text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Pickup Date *</label>
              <input type="date" required value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-base text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Delivery Deadline *</label>
              <input type="date" required value={deliveryDeadline} onChange={(e) => setDeliveryDeadline(e.target.value)} className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-base text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none transition-colors" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Notes</label>
              <textarea rows={3} placeholder="Special requirements, loading info, contact details..." value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-base text-white placeholder:text-gray-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none transition-colors" />
            </div>
          </div>
          <div className="mt-6 flex flex-col-reverse sm:flex-row items-center justify-between gap-3 border-t border-gray-800 pt-5">
            <p className="text-xs text-gray-500">Your load will be visible to all carriers on the platform.</p>
            <button type="submit" disabled={submitting} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600 active:scale-[0.98] transition-all disabled:cursor-not-allowed disabled:opacity-50 min-h-[52px]">
              {submitting ? (<><svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Posting…</>) : "Post Load"}
            </button>
          </div>
        </form>
      )}

      {tab === "my" && (
        <div>
          {loading ? (
            <div className="flex items-center justify-center py-20"><svg className="h-6 w-6 animate-spin text-orange-500" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
          ) : myLoads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 rounded-2xl bg-gray-800 p-4 text-gray-500"><svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5L12 3l9 4.5M3 7.5v9l9 4.5 9-4.5v-9M3 7.5l9 4.5 9-4.5" /></svg></div>
              <h3 className="text-lg font-semibold text-gray-300">No loads yet</h3>
              <p className="mt-2 max-w-sm text-sm text-gray-500">Loads you post will appear here. Ready to move your first shipment?</p>
              <button onClick={() => setTab("post")} className="mt-6 rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600 transition-all">Post Your First Load</button>
            </div>
          ) : (
            <div className="space-y-3">
              {myLoads.map((load) => (
                <div key={load.id} className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2"><h3 className="font-semibold text-white text-sm truncate">{load.origin} → {load.destination}</h3><StatusBadge status={load.status} /></div>
                      <p className="mt-1 text-sm text-gray-400"><span className="capitalize">{load.cargoType}</span> · {load.weight}t</p>
                      <p className="text-xs text-gray-500">Pickup: {load.pickupDate} · Deadline: {load.deliveryDeadline}</p>
                    </div>
                    <span className="text-xs text-gray-600 shrink-0">#{load.id}</span>
                  </div>
                  {/* AI Carrier suggestions for posted loads */}
                  {load.status === "posted" && suggestions[load.id] && suggestions[load.id].length > 0 && (
                    <div className="mt-3 rounded-xl border border-gray-700 bg-gray-800/50 p-3">
                      <p className="mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                        🤖 AI-Suggested Carriers
                      </p>
                      <div className="space-y-2">
                        {suggestions[load.id].map((c) => (
                          <div key={c.carrierId} className="flex items-center justify-between rounded-lg bg-gray-800 px-3 py-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-white truncate">{c.companyName}</p>
                              <div className="flex items-center gap-3 text-xs text-gray-400">
                                <span>On-time: <span className="text-emerald-400 font-medium">{(c.onTimeRate * 100).toFixed(0)}%</span></span>
                                <span>Match: <span className="text-orange-400 font-medium">{c.score}%</span></span>
                              </div>
                            </div>
                            <span className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              c.score >= 80 ? "bg-emerald-500/20 text-emerald-400" :
                              c.score >= 60 ? "bg-amber-500/20 text-amber-400" :
                              "bg-gray-700 text-gray-400"
                            }`}>
                              {c.score}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {load.carrierName && (<div className="mt-3 rounded-lg bg-gray-800 px-3 py-2 text-sm"><span className="text-gray-400">Carrier: </span><span className="font-medium text-white">{load.carrierName}</span></div>)}
                  {load.notes && (<p className="mt-2 text-sm text-gray-400 line-clamp-2">📝 {load.notes}</p>)}
                  <div className="mt-3"><a href={`/tracking/${load.id}`} className="inline-flex items-center gap-1.5 rounded-lg bg-gray-800 px-3 py-2 text-xs font-medium text-gray-300 hover:bg-gray-700 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>Track</a></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "profile" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-500/20 text-orange-400 text-xl font-bold">{user.name.charAt(0).toUpperCase()}</div>
              <div><h3 className="text-lg font-semibold text-white">{user.name}</h3><p className="text-sm text-gray-400">{user.company_name}</p></div>
            </div>
          </div>
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
            <h4 className="text-sm font-semibold text-gray-300 mb-3">Account Details</h4>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">Email</dt><dd className="text-gray-300">{user.email}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Role</dt><dd className="text-gray-300 capitalize">{user.role}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Company</dt><dd className="text-gray-300">{user.company_name}</dd></div>
            </dl>
          </div>
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
            <h4 className="text-sm font-semibold text-gray-300 mb-3">Stats</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-gray-800 p-3 text-center"><p className="text-2xl font-bold text-white">{myLoads.length}</p><p className="text-xs text-gray-400">Total Loads</p></div>
              <div className="rounded-lg bg-gray-800 p-3 text-center"><p className="text-2xl font-bold text-emerald-400">{myLoads.filter(l => l.status === "delivered").length}</p><p className="text-xs text-gray-400">Delivered</p></div>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full rounded-xl border border-red-800 bg-red-950/30 py-3.5 text-sm font-semibold text-red-400 hover:bg-red-950/50 transition-colors min-h-[48px]">Sign Out</button>
        </div>
      )}

      <BottomNav activeTab={tab} onTabChange={setTab} role="shipper" />
    </div>
  );
}
