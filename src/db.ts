// SQLite database layer using Bun's native SQLite driver.
// Uses lazy require() to avoid Vite client-bundle analysis of bun:sqlite.
// Types and lookupCoords are safe for client-side import; getDb() is server-only.

// ── City coordinate lookup (safe for client + server) ────────────────────
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
  for (const [k, v] of Object.entries(CITY_COORDS)) {
    if (k.includes(key) || key.includes(k)) return { ...v };
  }
  return { lat: -26 + Math.random() * 6, lng: 28 + Math.random() * 6 };
}

// ── Types (safe for client import) ──────────────────────────────────────
export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: "shipper" | "carrier";
  company_name: string;
  preferences: string | null;  // JSON blob: { homeCity, preferredCargoTypes, preferredRegions }
  on_time_rate: number;        // 0.85–0.98 simulated on-time performance
  created_at: string;
}

export type LoadStatus = "posted" | "accepted" | "departed" | "in-transit" | "border-crossing" | "arrived" | "delivered";

export interface LoadRow {
  id: string;
  shipper_id: string;
  origin: string;
  destination: string;
  origin_lat: number;
  origin_lng: number;
  dest_lat: number;
  dest_lng: number;
  cargo_type: string;
  weight_tons: number;
  pickup_date: string;
  delivery_deadline: string;
  notes: string;
  status: LoadStatus;
  carrier_id: string | null;
  current_location_lat: number | null;
  current_location_lng: number | null;
  created_at: string;
  updated_at: string;
}

export interface StatusHistoryRow {
  id: string;
  load_id: string;
  status: string;
  timestamp: string;
  location_lat: number | null;
  location_lng: number | null;
  notes: string | null;
}

export interface ProofOfDeliveryRow {
  id: string;
  load_id: string;
  recipient_name: string;
  signature_base64: string;
  photo_base64: string | null;
  notes: string;
  created_at: string;
}

export interface SessionRow {
  id: string;
  user_id: string;
  token: string;
  created_at: string;
  expires_at: string;
}

// ── Database singleton (server-only — uses lazy require) ─────────────────
let _db: any = null;
let _initialized = false;

function loadSqliteModule(): any {
  // Use Function constructor to bypass Vite/Rollup static analysis.
  // This string is only executed at runtime in Bun (server-side).
  const loader = new Function("return require('bun:sqlite')");
  return loader();
}

export function getDb(): any {
  if (!_db) {
    const sqlite = loadSqliteModule();
    const dbPath = import.meta.dirname + "/../data/logistiqs.db";
    _db = new sqlite.Database(dbPath);
    _db.exec("PRAGMA journal_mode = WAL");
    _db.exec("PRAGMA foreign_keys = ON");
  }
  if (!_initialized) {
    initSchema(_db);
    seedIfEmpty(_db);
    _initialized = true;
  }
  return _db;
}

// ── Schema ──────────────────────────────────────────────────────────────
function initSchema(db: any) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('shipper', 'carrier')),
      company_name TEXT NOT NULL,
      preferences TEXT,
      on_time_rate REAL NOT NULL DEFAULT 0.90,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS loads (
      id TEXT PRIMARY KEY,
      shipper_id TEXT NOT NULL REFERENCES users(id),
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      origin_lat REAL NOT NULL,
      origin_lng REAL NOT NULL,
      dest_lat REAL NOT NULL,
      dest_lng REAL NOT NULL,
      cargo_type TEXT NOT NULL,
      weight_tons REAL NOT NULL,
      pickup_date TEXT NOT NULL,
      delivery_deadline TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'posted' CHECK(status IN ('posted', 'accepted', 'departed', 'in-transit', 'border-crossing', 'arrived', 'delivered')),
      carrier_id TEXT REFERENCES users(id),
      current_location_lat REAL,
      current_location_lng REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS status_history (
      id TEXT PRIMARY KEY,
      load_id TEXT NOT NULL REFERENCES loads(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      location_lat REAL,
      location_lng REAL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS proof_of_delivery (
      id TEXT PRIMARY KEY,
      load_id TEXT NOT NULL REFERENCES loads(id) ON DELETE CASCADE,
      recipient_name TEXT NOT NULL,
      signature_base64 TEXT NOT NULL,
      photo_base64 TEXT,
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

// ── Seed data ────────────────────────────────────────────────────────────
function seedIfEmpty(db: any) {
  const userCount = db.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number };
  if (userCount.c > 0) return;

  const now = new Date().toISOString();

  // Bun.password is only available at runtime in Bun
  let hashSync: (pw: string) => string;
  try {
    hashSync = (Bun as any).password.hashSync;
  } catch {
    // Fallback — shouldn't happen
    hashSync = (pw: string) => pw;
  }
  const passwordHash = hashSync("password123");

  const insertUser = db.prepare(
    "INSERT INTO users (id, email, password_hash, name, role, company_name, preferences, on_time_rate, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );

  // 3 shippers (no preferences needed)
  insertUser.run("u-s1", "kansanshi@example.com", passwordHash, "Mining Ops", "shipper", "Kansanshi Mining PLC", null, 0.90, now);
  insertUser.run("u-s2", "sasol@example.com", passwordHash, "Fuel Desk", "shipper", "Sasol", null, 0.90, now);
  insertUser.run("u-s3", "grain@example.com", passwordHash, "Co-op Logistics", "shipper", "GrainSA Co-op", null, 0.90, now);

  // 3 carriers (with preferences and on-time rates)
  insertUser.run("u-c1", "crossborder@example.com", passwordHash, "Cross-Border Fleet", "carrier", "Cross-Border Hauliers Ltd",
    JSON.stringify({ homeCity: "Lusaka", preferredCargoTypes: ["copper", "machinery", "general freight"], preferredRegions: ["SA", "Zim", "Zam"] }),
    0.94, now);
  insertUser.run("u-c2", "transafrica@example.com", passwordHash, "TransAfrica Transport", "carrier", "TransAfrica Transport",
    JSON.stringify({ homeCity: "Johannesburg", preferredCargoTypes: ["fuel", "general freight", "grain"], preferredRegions: ["SA", "Bots", "Nam", "Moz"] }),
    0.97, now);
  insertUser.run("u-c3", "southern@example.com", passwordHash, "Southern Routes", "carrier", "Southern Routes Logistics",
    JSON.stringify({ homeCity: "Durban", preferredCargoTypes: ["grain", "fuel", "cement", "steel"], preferredRegions: ["SA", "Zim", "Moz"] }),
    0.88, now);

  // Seed loads
  const seedLoads = [
    {
      shipper_id: "u-s1",
      origin: "Lusaka",
      destination: "Johannesburg",
      cargo_type: "copper",
      weight_tons: 28,
      pickup_date: "2026-08-01",
      delivery_deadline: "2026-08-05",
      notes: "Copper cathode shipment. 2 x 20ft containers. Customs cleared at Chirundu.",
    },
    {
      shipper_id: "u-s2",
      origin: "Johannesburg",
      destination: "Gaborone",
      cargo_type: "fuel",
      weight_tons: 35,
      pickup_date: "2026-07-28",
      delivery_deadline: "2026-08-01",
      notes: "Diesel tanker. ADR compliant. Flexible on pickup time.",
    },
    {
      shipper_id: "u-s1",
      origin: "Windhoek",
      destination: "Cape Town",
      cargo_type: "machinery",
      weight_tons: 12,
      pickup_date: "2026-08-10",
      delivery_deadline: "2026-08-18",
      notes: "Mining drill components. Oversize — lowbed trailer required.",
    },
    {
      shipper_id: "u-s3",
      origin: "Bloemfontein",
      destination: "Durban",
      cargo_type: "grain",
      weight_tons: 32,
      pickup_date: "2026-07-30",
      delivery_deadline: "2026-08-03",
      notes: "Maize — bulk tipper. Silo 4, gate B.",
    },
    {
      shipper_id: "u-s1",
      origin: "Ndola",
      destination: "Walvis Bay",
      cargo_type: "copper",
      weight_tons: 24,
      pickup_date: "2026-08-05",
      delivery_deadline: "2026-08-12",
      notes: "Copper blister in containers. Export documentation included.",
    },
    {
      shipper_id: "u-s2",
      origin: "Pretoria",
      destination: "Harare",
      cargo_type: "general freight",
      weight_tons: 18,
      pickup_date: "2026-08-02",
      delivery_deadline: "2026-08-06",
      notes: "Mixed industrial goods. 1 x tautliner. Cross-border — Beitbridge.",
    },
    {
      shipper_id: "u-s1",
      origin: "Swakopmund",
      destination: "Windhoek",
      cargo_type: "machinery",
      weight_tons: 15,
      pickup_date: "2026-08-08",
      delivery_deadline: "2026-08-10",
      notes: "Crushing equipment parts. Covered transport.",
    },
    // Backhaul-friendly loads for demo
    {
      shipper_id: "u-s3",
      origin: "Harare",
      destination: "Lusaka",
      cargo_type: "grain",
      weight_tons: 30,
      pickup_date: "2026-07-31",
      delivery_deadline: "2026-08-04",
      notes: "🔄 Backhaul-friendly: destination near carrier home. Maize export to Zambia. Bulk tipper.",
    },
    {
      shipper_id: "u-s2",
      origin: "Polokwane",
      destination: "Durban",
      cargo_type: "fuel",
      weight_tons: 34,
      pickup_date: "2026-08-01",
      delivery_deadline: "2026-08-03",
      notes: "🔄 Backhaul-friendly: Durban-bound tanker. Empty return avoidance opportunity.",
    },
    // Far-future load to demonstrate timeline scoring
    {
      shipper_id: "u-s1",
      origin: "Kitwe",
      destination: "Johannesburg",
      cargo_type: "copper",
      weight_tons: 26,
      pickup_date: "2026-09-15",
      delivery_deadline: "2026-09-22",
      notes: "Future copper shipment. Advance booking — flexible timeline.",
    },
  ];

  const insertLoad = db.prepare(
    `INSERT INTO loads (id, shipper_id, origin, destination, origin_lat, origin_lng, dest_lat, dest_lng,
      cargo_type, weight_tons, pickup_date, delivery_deadline, notes, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'posted', ?, ?)`
  );

  let lid = 0;
  for (const s of seedLoads) {
    lid++;
    const o = lookupCoords(s.origin);
    const d = lookupCoords(s.destination);
    insertLoad.run(
      `load-${String(lid).padStart(4, "0")}`,
      s.shipper_id,
      s.origin,
      s.destination,
      o.lat,
      o.lng,
      d.lat,
      d.lng,
      s.cargo_type,
      s.weight_tons,
      s.pickup_date,
      s.delivery_deadline,
      s.notes,
      now,
      now,
    );
  }
}
