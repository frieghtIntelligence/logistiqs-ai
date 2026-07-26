// Server functions — callable from client components via RPC.
// All server-only imports are dynamic inside .handler() closures.
import { createServerFn } from "@tanstack/react-start";
import { lookupCoords } from "~/db";

// ── Types exposed to the client ─────────────────────────────────────────
export type LoadStatus = "posted" | "accepted" | "departed" | "in-transit" | "border-crossing" | "arrived" | "delivered";

export interface Load {
  id: string;
  shipperName: string;
  shipperId: string;
  origin: string;
  destination: string;
  cargoType: string;
  weight: number;
  pickupDate: string;
  deliveryDeadline: string;
  notes: string;
  status: LoadStatus;
  carrierName: string | null;
  carrierId: string | null;
  createdAt: string;
  originCoords: { lat: number; lng: number };
  destCoords: { lat: number; lng: number };
  currentLocation: { lat: number; lng: number } | null;
  // Matching metadata (set by fetchRankedLoads)
  matchScore?: number;
  matchBreakdown?: { routeProximity: number; cargoMatch: number; backhaulPotential: number; timelineFit: number };
  isBackhaul?: boolean;
}

export interface ScoredLoad {
  loadId: string;
  score: number;
  isBackhaul: boolean;
  breakdown: {
    routeProximity: number;
    cargoMatch: number;
    backhaulPotential: number;
    timelineFit: number;
  };
}

export interface CarrierSuggestion {
  carrierId: string;
  carrierName: string;
  companyName: string;
  onTimeRate: number;
  score: number;
  breakdown: {
    routeFamiliarity: number;
    onTimeScore: number;
    cargoExperience: number;
    proximityToOrigin: number;
  };
}

export interface StatusHistoryEntry {
  id: string;
  loadId: string;
  status: string;
  timestamp: string;
  locationLat: number | null;
  locationLng: number | null;
  notes: string | null;
}

export interface ProofOfDelivery {
  id: string;
  loadId: string;
  recipientName: string;
  signatureBase64: string;
  photoBase64: string | null;
  notes: string;
  createdAt: string;
}

// ── Post a new load (authenticated shipper) ────────────────────────────
export const postLoad = createServerFn({ method: "POST" })
  .validator(
    (data: {
      origin: string;
      destination: string;
      cargoType: string;
      weight: number;
      pickupDate: string;
      deliveryDeadline: string;
      notes: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { getSessionUser } = await import("~/auth.server");
    const { getDb } = await import("~/db");
    const user = getSessionUser();
    if (!user || user.role !== "shipper") {
      throw new Error("You must be logged in as a shipper to post loads.");
    }

    const db = getDb();
    const now = new Date().toISOString();
    const originCoords = lookupCoords(data.origin);
    const destCoords = lookupCoords(data.destination);

    const count = (db.prepare("SELECT COUNT(*) as c FROM loads").get() as { c: number }).c;
    const loadId = `load-${String(count + 1).padStart(4, "0")}`;

    db.prepare(`
      INSERT INTO loads (id, shipper_id, origin, destination, origin_lat, origin_lng, dest_lat, dest_lng,
        cargo_type, weight_tons, pickup_date, delivery_deadline, notes, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'posted', ?, ?)
    `).run(
      loadId, user.id, data.origin.trim(), data.destination.trim(),
      originCoords.lat, originCoords.lng, destCoords.lat, destCoords.lng,
      data.cargoType, data.weight, data.pickupDate, data.deliveryDeadline, data.notes.trim(),
      now, now,
    );

    // Record initial status in history
    const shId = `sh-${crypto.randomUUID().slice(0, 8)}`;
    db.prepare(`
      INSERT INTO status_history (id, load_id, status, timestamp, location_lat, location_lng, notes)
      VALUES (?, ?, 'posted', ?, ?, ?, ?)
    `).run(shId, loadId, now, originCoords.lat, originCoords.lng, null);

    const row = db.prepare(`
      SELECT l.*, s.name as shipper_name, c.name as carrier_name
      FROM loads l JOIN users s ON s.id = l.shipper_id LEFT JOIN users c ON c.id = l.carrier_id
      WHERE l.id = ?
    `).get(loadId) as any;

    return row ? rowToLoad(row) : null;
  });

// ── Fetch all loads ─────────────────────────────────────────────────────
export const fetchLoads = createServerFn({ method: "GET" }).handler(async () => {
  const { getDb } = await import("~/db");
  const db = getDb();
  const rows = db.prepare(`
    SELECT l.*, s.name as shipper_name, c.name as carrier_name
    FROM loads l JOIN users s ON s.id = l.shipper_id LEFT JOIN users c ON c.id = l.carrier_id
    ORDER BY l.created_at DESC
  `).all() as any[];
  return rows.map(rowToLoad);
});

// ── Fetch a single load ─────────────────────────────────────────────────
export const fetchLoad = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const { getDb } = await import("~/db");
    const db = getDb();
    const row = db.prepare(`
      SELECT l.*, s.name as shipper_name, c.name as carrier_name
      FROM loads l JOIN users s ON s.id = l.shipper_id LEFT JOIN users c ON c.id = l.carrier_id
      WHERE l.id = ?
    `).get(id) as any;
    return row ? rowToLoad(row) : null;
  });

// ── Accept a load (authenticated carrier) ───────────────────────────────
export const takeLoad = createServerFn({ method: "POST" })
  .validator((data: { loadId: string }) => data)
  .handler(async ({ data }) => {
    const { getSessionUser } = await import("~/auth.server");
    const { getDb } = await import("~/db");
    const user = getSessionUser();
    if (!user || user.role !== "carrier") {
      throw new Error("You must be logged in as a carrier to accept loads.");
    }

    const db = getDb();
    const now = new Date().toISOString();
    const result = db.prepare(`
      UPDATE loads SET status = 'accepted', carrier_id = ?, updated_at = ?
      WHERE id = ? AND status = 'posted'
    `).run(user.id, now, data.loadId);

    if (result.changes === 0) return null;

    // Record acceptance in status history
    const shId = `sh-${crypto.randomUUID().slice(0, 8)}`;
    db.prepare(`
      INSERT INTO status_history (id, load_id, status, timestamp, location_lat, location_lng, notes)
      VALUES (?, ?, 'accepted', ?, NULL, NULL, ?)
    `).run(shId, data.loadId, now, `${user.company_name} accepted this load`);

    const row = db.prepare(`
      SELECT l.*, s.name as shipper_name, c.name as carrier_name
      FROM loads l JOIN users s ON s.id = l.shipper_id LEFT JOIN users c ON c.id = l.carrier_id
      WHERE l.id = ?
    `).get(data.loadId) as any;
    return row ? rowToLoad(row) : null;
  });

// ── Advance load status ─────────────────────────────────────────────────
export const advanceLoadStatus = createServerFn({ method: "POST" })
  .validator(
    (data: {
      loadId: string;
      status: "departed" | "in-transit" | "border-crossing" | "arrived" | "delivered";
      locationLat?: number;
      locationLng?: number;
      notes?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { getSessionUser } = await import("~/auth.server");
    const { getDb } = await import("~/db");
    const user = getSessionUser();
    if (!user) throw new Error("You must be logged in.");

    // Only the assigned carrier can advance status
    const db = getDb();
    const now = new Date().toISOString();
    const result = db.prepare(`
      UPDATE loads SET status = ?, updated_at = ? WHERE id = ? AND carrier_id = ?
    `).run(data.status, now, data.loadId, user.id);

    if (result.changes === 0) return null;

    // Also update location if provided
    if (data.locationLat != null && data.locationLng != null) {
      db.prepare(`
        UPDATE loads SET current_location_lat = ?, current_location_lng = ? WHERE id = ?
      `).run(data.locationLat, data.locationLng, data.loadId);
    }

    // Record in status history
    const historyId = `sh-${crypto.randomUUID().slice(0, 8)}`;
    db.prepare(`
      INSERT INTO status_history (id, load_id, status, timestamp, location_lat, location_lng, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      historyId,
      data.loadId,
      data.status,
      now,
      data.locationLat ?? null,
      data.locationLng ?? null,
      data.notes ?? null,
    );

    const row = db.prepare(`
      SELECT l.*, s.name as shipper_name, c.name as carrier_name
      FROM loads l JOIN users s ON s.id = l.shipper_id LEFT JOIN users c ON c.id = l.carrier_id
      WHERE l.id = ?
    `).get(data.loadId) as any;
    return row ? rowToLoad(row) : null;
  });

// ── Update load GPS location ────────────────────────────────────────────
export const updateLoadLocation = createServerFn({ method: "POST" })
  .validator(
    (data: { loadId: string; locationLat: number; locationLng: number }) => data,
  )
  .handler(async ({ data }) => {
    const { getSessionUser } = await import("~/auth.server");
    const { getDb } = await import("~/db");
    const user = getSessionUser();
    if (!user) throw new Error("You must be logged in.");

    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE loads SET current_location_lat = ?, current_location_lng = ?, updated_at = ?
      WHERE id = ? AND carrier_id = ?
    `).run(data.locationLat, data.locationLng, now, data.loadId, user.id);

    return { success: true };
  });

// ── Fetch status history for a load ─────────────────────────────────────
export const fetchStatusHistory = createServerFn({ method: "GET" })
  .validator((loadId: string) => loadId)
  .handler(async ({ data: loadId }) => {
    const { getDb } = await import("~/db");
    const db = getDb();
    const rows = db.prepare(`
      SELECT * FROM status_history WHERE load_id = ? ORDER BY timestamp ASC
    `).all(loadId) as any[];

    return rows.map((r: any) => ({
      id: r.id,
      loadId: r.load_id,
      status: r.status,
      timestamp: r.timestamp,
      locationLat: r.location_lat,
      locationLng: r.location_lng,
      notes: r.notes,
    })) as StatusHistoryEntry[];
  });

// ── Submit proof of delivery ────────────────────────────────────────────
export const submitProofOfDelivery = createServerFn({ method: "POST" })
  .validator(
    (data: {
      loadId: string;
      recipientName: string;
      signatureBase64: string;
      photoBase64: string | null;
      notes: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { getSessionUser } = await import("~/auth.server");
    const { getDb } = await import("~/db");
    const user = getSessionUser();
    if (!user) throw new Error("You must be logged in.");

    const db = getDb();
    const now = new Date().toISOString();
    const podId = `pod-${crypto.randomUUID().slice(0, 8)}`;

    db.prepare(`
      INSERT INTO proof_of_delivery (id, load_id, recipient_name, signature_base64, photo_base64, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      podId,
      data.loadId,
      data.recipientName,
      data.signatureBase64,
      data.photoBase64,
      data.notes,
      now,
    );

    // Also record in status history
    const shId = `sh-${crypto.randomUUID().slice(0, 8)}`;
    db.prepare(`
      INSERT INTO status_history (id, load_id, status, timestamp, location_lat, location_lng, notes)
      VALUES (?, ?, 'delivered', ?, NULL, NULL, ?)
    `).run(shId, data.loadId, now, `Signed by ${data.recipientName}`);

    return {
      id: podId,
      loadId: data.loadId,
      recipientName: data.recipientName,
      signatureBase64: data.signatureBase64,
      photoBase64: data.photoBase64,
      notes: data.notes,
      createdAt: now,
    } as ProofOfDelivery;
  });

// ── Fetch proof of delivery for a load ───────────────────────────────────
export const fetchProofOfDelivery = createServerFn({ method: "GET" })
  .validator((loadId: string) => loadId)
  .handler(async ({ data: loadId }) => {
    const { getDb } = await import("~/db");
    const db = getDb();
    const row = db.prepare(`
      SELECT * FROM proof_of_delivery WHERE load_id = ? ORDER BY created_at DESC LIMIT 1
    `).get(loadId) as any;

    if (!row) return null;

    return {
      id: row.id,
      loadId: row.load_id,
      recipientName: row.recipient_name,
      signatureBase64: row.signature_base64,
      photoBase64: row.photo_base64,
      notes: row.notes,
      createdAt: row.created_at,
    } as ProofOfDelivery;
  });

// ── AI Matching: Fetch ranked loads for a carrier ─────────────────────────
export const fetchRankedLoads = createServerFn({ method: "GET" }).handler(async () => {
  const { getSessionUser } = await import("~/auth.server");
  const { getDb } = await import("~/db");
  const { rankLoadsForCarrier } = await import("~/matching");
  const user = getSessionUser();
  if (!user || user.role !== "carrier") {
    throw new Error("You must be logged in as a carrier.");
  }

  const db = getDb();

  // Get carrier preferences
  const carrier = db.prepare("SELECT preferences, company_name FROM users WHERE id = ?").get(user.id) as any;
  const prefs = carrier?.preferences ? JSON.parse(carrier.preferences) : null;
  const homeCity = prefs?.homeCity || undefined;

  // Fetch only posted loads
  const rows = db.prepare(`
    SELECT l.*, s.name as shipper_name, c.name as carrier_name
    FROM loads l JOIN users s ON s.id = l.shipper_id LEFT JOIN users c ON c.id = l.carrier_id
    WHERE l.status = 'posted'
    ORDER BY l.created_at DESC
  `).all() as any[];

  if (rows.length === 0) return { loads: [], scored: [] };

  const loadsForScoring = rows.map((r: any) => ({
    id: r.id,
    originLat: r.origin_lat,
    originLng: r.origin_lng,
    destLat: r.dest_lat,
    destLng: r.dest_lng,
    cargoType: r.cargo_type,
    pickupDate: r.pickup_date,
  }));

  const scored = rankLoadsForCarrier(loadsForScoring, prefs, homeCity);

  // Build score lookup
  const scoreMap = new Map<string, (typeof scored)[0]>();
  for (const s of scored) {
    scoreMap.set(s.loadId, s);
  }

  // Build sorted loads array matching scored order
  const loads = scored
    .map((s) => {
      const row = rows.find((r: any) => r.id === s.loadId);
      if (!row) return null;
      const load = rowToLoad(row);
      load.matchScore = s.score;
      load.matchBreakdown = s.breakdown;
      load.isBackhaul = s.isBackhaul;
      return load;
    })
    .filter(Boolean) as Load[];

  return { loads, scored };
});

// ── AI Matching: Suggest carriers for a shipper's load ────────────────────
export const suggestCarriersForLoad = createServerFn({ method: "GET" })
  .validator((loadId: string) => loadId)
  .handler(async ({ data: loadId }) => {
    const { getSessionUser } = await import("~/auth.server");
    const { getDb } = await import("~/db");
    const { suggestCarriersForLoad: matchCarriers } = await import("~/matching");
    const user = getSessionUser();
    if (!user || user.role !== "shipper") {
      throw new Error("You must be logged in as a shipper.");
    }

    const db = getDb();

    // Get the load
    const load = db.prepare("SELECT * FROM loads WHERE id = ? AND shipper_id = ?").get(loadId, user.id) as any;
    if (!load) throw new Error("Load not found.");

    // Get all carriers with their preferences
    const carriers = db.prepare(
      "SELECT id, name, company_name, preferences, on_time_rate FROM users WHERE role = 'carrier'",
    ).all() as any[];

    const carriersForSuggestion = carriers.map((c: any) => ({
      id: c.id,
      name: c.name,
      companyName: c.company_name,
      onTimeRate: c.on_time_rate,
      preferences: c.preferences ? JSON.parse(c.preferences) : null,
    }));

    const suggestions = matchCarriers(
      carriersForSuggestion,
      load.origin_lat,
      load.origin_lng,
      load.cargo_type,
      load.origin,
    );

    return suggestions.slice(0, 3) as CarrierSuggestion[];
  });

// ── Carrier: Update preferences ────────────────────────────────────────────
export const updateCarrierPreferences = createServerFn({ method: "POST" })
  .validator(
    (data: {
      homeCity: string;
      preferredCargoTypes: string[];
      preferredRegions: string[];
    }) => data,
  )
  .handler(async ({ data }) => {
    const { getSessionUser } = await import("~/auth.server");
    const { getDb } = await import("~/db");
    const user = getSessionUser();
    if (!user || user.role !== "carrier") {
      throw new Error("You must be logged in as a carrier.");
    }

    const db = getDb();
    const prefs = JSON.stringify({
      homeCity: data.homeCity.trim(),
      preferredCargoTypes: data.preferredCargoTypes,
      preferredRegions: data.preferredRegions,
    });

    db.prepare("UPDATE users SET preferences = ? WHERE id = ?").run(prefs, user.id);
    return { success: true, preferences: JSON.parse(prefs) };
  });

// ── Carrier: Fetch preferences ─────────────────────────────────────────────
export const fetchCarrierPreferences = createServerFn({ method: "GET" }).handler(async () => {
  const { getSessionUser } = await import("~/auth.server");
  const { getDb } = await import("~/db");
  const user = getSessionUser();
  if (!user || user.role !== "carrier") {
    throw new Error("You must be logged in as a carrier.");
  }

  const db = getDb();
  const row = db.prepare("SELECT preferences, on_time_rate FROM users WHERE id = ?").get(user.id) as any;
  const prefs = row?.preferences ? JSON.parse(row.preferences) : {
    homeCity: "",
    preferredCargoTypes: [],
    preferredRegions: [],
  };

  return {
    preferences: prefs,
    onTimeRate: row?.on_time_rate ?? 0.90,
  };
});

// ── Shipper: Fetch suggested carriers for all my unaccepted loads ──────────
export const fetchAllLoadSuggestions = createServerFn({ method: "GET" }).handler(async () => {
  const { getSessionUser } = await import("~/auth.server");
  const { getDb } = await import("~/db");
  const { suggestCarriersForLoad: matchCarriers } = await import("~/matching");
  const user = getSessionUser();
  if (!user || user.role !== "shipper") {
    throw new Error("You must be logged in as a shipper.");
  }

  const db = getDb();

  // Get all unaccepted loads for this shipper
  const loads = db.prepare(
    "SELECT * FROM loads WHERE shipper_id = ? AND status = 'posted'",
  ).all(user.id) as any[];

  if (loads.length === 0) return {};

  // Get all carriers
  const carriers = db.prepare(
    "SELECT id, name, company_name, preferences, on_time_rate FROM users WHERE role = 'carrier'",
  ).all() as any[];

  const carriersForSuggestion = carriers.map((c: any) => ({
    id: c.id,
    name: c.name,
    companyName: c.company_name,
    onTimeRate: c.on_time_rate,
    preferences: c.preferences ? JSON.parse(c.preferences) : null,
  }));

  const result: Record<string, CarrierSuggestion[]> = {};
  for (const load of loads) {
    const suggestions = matchCarriers(
      carriersForSuggestion,
      load.origin_lat,
      load.origin_lng,
      load.cargo_type,
      load.origin,
    );
    result[load.id] = suggestions.slice(0, 3);
  }

  return result;
});

// ── Helper: map DB row to client Load type ──────────────────────────────
function rowToLoad(row: any): Load {
  return {
    id: row.id,
    shipperName: row.shipper_name,
    shipperId: row.shipper_id,
    origin: row.origin,
    destination: row.destination,
    cargoType: row.cargo_type,
    weight: row.weight_tons,
    pickupDate: row.pickup_date,
    deliveryDeadline: row.delivery_deadline,
    notes: row.notes,
    status: row.status,
    carrierName: row.carrier_name,
    carrierId: row.carrier_id,
    createdAt: row.created_at,
    originCoords: { lat: row.origin_lat, lng: row.origin_lng },
    destCoords: { lat: row.dest_lat, lng: row.dest_lng },
    currentLocation:
      row.current_location_lat != null && row.current_location_lng != null
        ? { lat: row.current_location_lat, lng: row.current_location_lng }
        : null,
  };
}
