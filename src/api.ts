// Server functions — callable from client components via RPC.
// Each wraps the in-memory store and runs only on the server.
import { createServerFn } from "@tanstack/react-start";
import {
  createLoad as storeCreateLoad,
  getLoads as storeGetLoads,
  getLoad as storeGetLoad,
  acceptLoad as storeAcceptLoad,
  updateLoadStatus as storeUpdateStatus,
  seedIfEmpty,
  type Load,
} from "~/store";

// Seed demo data on first request
const ensureSeeded = createServerFn({ method: "GET" }).handler(async () => {
  seedIfEmpty();
  return null;
});

export const postLoad = createServerFn({ method: "POST" })
  .validator(
    (data: {
      shipperName: string;
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
    seedIfEmpty();
    return storeCreateLoad(data);
  });

export const fetchLoads = createServerFn({ method: "GET" }).handler(async () => {
  seedIfEmpty();
  return storeGetLoads();
});

export const fetchLoad = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    return storeGetLoad(id) ?? null;
  });

export const takeLoad = createServerFn({ method: "POST" })
  .validator((data: { loadId: string; carrierName: string }) => data)
  .handler(async ({ data }) => {
    return storeAcceptLoad(data.loadId, data.carrierName);
  });

export const advanceLoadStatus = createServerFn({ method: "POST" })
  .validator(
    (data: { loadId: string; status: "in-transit" | "delivered" }) => data,
  )
  .handler(async ({ data }) => {
    return storeUpdateStatus(data.loadId, data.status);
  });

export type { Load };
