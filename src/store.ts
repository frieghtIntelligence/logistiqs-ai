// In-memory freight load store — shared across all requests within the server process.
// MVP: no database, no persistence. Restarting the server clears all data.

export interface Load {
  id: string;
  shipperName: string;
  origin: string;
  destination: string;
  cargoType: string;
  weight: number;
  pickupDate: string;
  deliveryDeadline: string;
  notes: string;
  status: "posted" | "accepted" | "in-transit" | "delivered";
  carrierName: string | null;
  createdAt: string;
  originCoords: { lat: number; lng: number };
  destCoords: { lat: number; lng: number };
}

const loads = new Map<string, Load>();

let nextId = 1;
function genId(): string {
  return `load-${String(nextId++).padStart(4, "0")}`;
}

// ── City coordinate lookup ──────────────────────────────────────────
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  johannesburg: { lat: -26.2041, lng: 28.0473 },
  pretoria: { lat: -25.7479, lng: 28.2293 },
  durban: { lat: -29.8587, lng: 31.0218 },
  "cape town": { lat: -33.9249, lng: 18.4241 },
  lusaka: { lat: -15.3875, lng: 28.3228 },
  harare: { lat: -17.8252, lng: 31.0335 },
  gaborone: { lat: -24.6282, lng: 25.9231 },
  windhoek: { lat: -22.5609, lng: 17.0658 },
  maputo: { lat: -25.9692, lng: 32.5732 },
  bulawayo: { lat: -20.1457, lng: 28.5873 },
  kitwe: { lat: -12.8024, lng: 28.2132 },
  ndola: { lat: -12.9587, lng: 28.6366 },
  mbombela: { lat: -25.4753, lng: 30.9694 },
  nelspruit: { lat: -25.4753, lng: 30.9694 },
  polokwane: { lat: -23.9084, lng: 29.4686 },
  bloemfontein: { lat: -29.0852, lng: 26.1596 },
  "port elizabeth": { lat: -33.9608, lng: 25.6022 },
  gqeberha: { lat: -33.9608, lng: 25.6022 },
  "east london": { lat: -33.0292, lng: 27.8546 },
  lubumbashi: { lat: -11.6647, lng: 27.4794 },
  lilongwe: { lat: -13.9833, lng: 33.7833 },
  blantyre: { lat: -15.7861, lng: 35.0058 },
  walvisbay: { lat: -22.9575, lng: 14.5053 },
  swakopmund: { lat: -22.6783, lng: 14.5272 },
  francistown: { lat: -21.1711, lng: 27.5069 },
  manzini: { lat: -26.4833, lng: 31.3667 },
  maseru: { lat: -29.3167, lng: 27.4833 },
  kimberley: { lat: -28.7282, lng: 24.7499 },
  richardsbay: { lat: -28.7833, lng: 32.0667 },
  rustenburg: { lat: -25.6667, lng: 27.25 },
};

export function lookupCoords(city: string): { lat: number; lng: number } {
  const key = city.toLowerCase().trim();
  const exact = CITY_COORDS[key];
  if (exact) return { ...exact };
  // Fuzzy match: check if any key contains the input
  for (const [k, v] of Object.entries(CITY_COORDS)) {
    if (k.includes(key) || key.includes(k)) return { ...v };
  }
  // Fallback: jittered Southern Africa center
  return { lat: -26 + Math.random() * 6, lng: 28 + Math.random() * 6 };
}

// ── CRUD ─────────────────────────────────────────────────────────────
export function createLoad(data: {
  shipperName: string;
  origin: string;
  destination: string;
  cargoType: string;
  weight: number;
  pickupDate: string;
  deliveryDeadline: string;
  notes: string;
}): Load {
  const load: Load = {
    id: genId(),
    ...data,
    status: "posted",
    carrierName: null,
    createdAt: new Date().toISOString(),
    originCoords: lookupCoords(data.origin),
    destCoords: lookupCoords(data.destination),
  };
  loads.set(load.id, load);
  return load;
}

export function getLoads(): Load[] {
  return Array.from(loads.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function getLoad(id: string): Load | undefined {
  return loads.get(id);
}

export function acceptLoad(id: string, carrierName: string): Load | null {
  const load = loads.get(id);
  if (!load || load.status !== "posted") return null;
  load.status = "accepted";
  load.carrierName = carrierName;
  return load;
}

export function updateLoadStatus(
  id: string,
  status: "in-transit" | "delivered",
): Load | null {
  const load = loads.get(id);
  if (!load) return null;
  load.status = status;
  return load;
}

// ── Seed data ────────────────────────────────────────────────────────
export function seedIfEmpty(): void {
  if (loads.size > 0) return;

  const seedLoads = [
    {
      shipperName: "Kansanshi Mining PLC",
      origin: "Lusaka",
      destination: "Johannesburg",
      cargoType: "copper",
      weight: 28,
      pickupDate: "2026-08-01",
      deliveryDeadline: "2026-08-05",
      notes: "Copper cathode shipment. 2 x 20ft containers. Customs cleared at Chirundu.",
    },
    {
      shipperName: "Sasol",
      origin: "Johannesburg",
      destination: "Gaborone",
      cargoType: "fuel",
      weight: 35,
      pickupDate: "2026-07-28",
      deliveryDeadline: "2026-08-01",
      notes: "Diesel tanker. ADR compliant. Flexible on pickup time.",
    },
    {
      shipperName: "Debmarine Namibia",
      origin: "Windhoek",
      destination: "Cape Town",
      cargoType: "machinery",
      weight: 12,
      pickupDate: "2026-08-10",
      deliveryDeadline: "2026-08-18",
      notes: "Mining drill components. Oversize — lowbed trailer required.",
    },
    {
      shipperName: "GrainSA Co-op",
      origin: "Bloemfontein",
      destination: "Durban",
      cargoType: "grain",
      weight: 32,
      pickupDate: "2026-07-30",
      deliveryDeadline: "2026-08-03",
      notes: "Maize — bulk tipper. Silo 4, gate B.",
    },
    {
      shipperName: "First Quantum Minerals",
      origin: "Ndola",
      destination: "Walvis Bay",
      cargoType: "copper",
      weight: 24,
      pickupDate: "2026-08-05",
      deliveryDeadline: "2026-08-12",
      notes: "Copper blister in containers. Export documentation included.",
    },
    {
      shipperName: "Barloworld Logistics",
      origin: "Pretoria",
      destination: "Harare",
      cargoType: "general freight",
      weight: 18,
      pickupDate: "2026-08-02",
      deliveryDeadline: "2026-08-06",
      notes: "Mixed industrial goods. 1 x tautliner. Cross-border — Beitbridge.",
    },
    {
      shipperName: "Rössing Uranium",
      origin: "Swakopmund",
      destination: "Windhoek",
      cargoType: "machinery",
      weight: 15,
      pickupDate: "2026-08-08",
      deliveryDeadline: "2026-08-10",
      notes: "Crushing equipment parts. Covered transport.",
    },
  ];

  for (const s of seedLoads) {
    createLoad(s);
  }
}
