// Server functions — callable from client components via RPC.
// All server-only imports are dynamic inside .handler() closures.
import { createServerFn } from "@tanstack/react-start";
import { lookupCoords } from "~/db";

// ── Load type exposed to the client ─────────────────────────────────────
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
  status: "posted" | "accepted" | "in-transit" | "delivered";
  carrierName: string | null;
  carrierId: string | null;
  createdAt: string;
  originCoords: { lat: number; lng: number };
  destCoords: { lat: number; lng: number };
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
    (data: { loadId: string; status: "in-transit" | "delivered" }) => data,
  )
  .handler(async ({ data }) => {
    const { getSessionUser } = await import("~/auth.server");
    const { getDb } = await import("~/db");
    const user = getSessionUser();
    if (!user) throw new Error("You must be logged in.");

    const db = getDb();
    const now = new Date().toISOString();
    const result = db.prepare(`
      UPDATE loads SET status = ?, updated_at = ? WHERE id = ? AND carrier_id = ?
    `).run(data.status, now, data.loadId, user.id);

    if (result.changes === 0) return null;

    const row = db.prepare(`
      SELECT l.*, s.name as shipper_name, c.name as carrier_name
      FROM loads l JOIN users s ON s.id = l.shipper_id LEFT JOIN users c ON c.id = l.carrier_id
      WHERE l.id = ?
    `).get(data.loadId) as any;
    return row ? rowToLoad(row) : null;
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
  };
}
