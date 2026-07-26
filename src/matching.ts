// AI-powered freight matching engine for LOGISTIQS INTELLIGENCE.
// Pure server-side, deterministic scoring — no external API calls.
// ────────────────────────────────────────────────────────────────────────────

import { lookupCoords } from "~/db";

// ── Types ──────────────────────────────────────────────────────────────────

export interface CarrierPreferences {
  homeCity?: string;
  preferredCargoTypes?: string[];
  preferredRegions?: string[]; // SA, Zim, Zam, Bots, Moz, Nam
}

export interface ScoredLoad {
  loadId: string;
  score: number; // 0–100
  isBackhaul: boolean;
  breakdown: {
    routeProximity: number; // 0–40
    cargoMatch: number; // 0–25
    backhaulPotential: number; // 0–20
    timelineFit: number; // 0–15
  };
}

export interface CarrierMatch {
  carrierId: string;
  carrierName: string;
  companyName: string;
  onTimeRate: number;
  score: number; // 0–100
  breakdown: {
    routeFamiliarity: number; // 0–35
    onTimeScore: number; // 0–25
    cargoExperience: number; // 0–25
    proximityToOrigin: number; // 0–15
  };
}

// ── Constants ──────────────────────────────────────────────────────────────

const BACKHAUL_RADIUS_KM = 200;

// Cargo category groups for "related" matching
const CARGO_CATEGORIES: Record<string, string[]> = {
  copper: ["copper", "iron ore", "machinery", "steel"],
  coal: ["coal", "iron ore", "cement", "steel"],
  fuel: ["fuel", "general freight", "grain"],
  grain: ["grain", "fertilizer", "fuel", "general freight"],
  machinery: ["machinery", "steel", "copper", "general freight"],
  cement: ["cement", "steel", "coal", "general freight"],
  steel: ["steel", "machinery", "copper", "cement", "coal"],
  fertilizer: ["fertilizer", "grain", "general freight"],
  "iron ore": ["iron ore", "coal", "copper", "steel"],
  "general freight": ["general freight", "fuel", "grain", "machinery", "steel", "fertilizer", "cement"],
  other: ["other"],
};

// Region centerpoints (approximate centroids)
const REGION_CENTERS: Record<string, { lat: number; lng: number }> = {
  SA: { lat: -29.0, lng: 24.0 },
  Zim: { lat: -19.0, lng: 30.0 },
  Zam: { lat: -13.5, lng: 28.0 },
  Bots: { lat: -22.0, lng: 24.0 },
  Moz: { lat: -18.5, lng: 35.0 },
  Nam: { lat: -22.0, lng: 17.0 },
};

// Country→city mapping for region detection
const CITY_COUNTRIES: Record<string, string> = {
  johannesburg: "SA", pretoria: "SA", durban: "SA", "cape town": "SA",
  polokwane: "SA", mbombela: "SA", nelspruit: "SA", bloemfontein: "SA",
  "port elizabeth": "SA", gqeberha: "SA", "east london": "SA",
  kimberley: "SA", richardsbay: "SA", rustenburg: "SA", harrismith: "SA",
  pietermaritzburg: "SA", emalahleni: "SA",
  harare: "Zim", bulawayo: "Zim", beitbridge: "Zim", mutare: "Zim",
  masvingo: "Zim", gweru: "Zim",
  lusaka: "Zam", kitwe: "Zam", ndola: "Zam", chingola: "Zam",
  kabwe: "Zam", solwezi: "Zam", livingstone: "Zam",
  gaborone: "Bots", francistown: "Bots", lobatse: "Bots", ghanzi: "Bots", kasane: "Bots",
  maputo: "Moz", beira: "Moz", chimoio: "Moz", tete: "Moz", nacala: "Moz",
  windhoek: "Nam", walvisbay: "Nam", swakopmund: "Nam", gobabis: "Nam",
  lubumbashi: "DRC", likasi: "DRC", kolwezi: "DRC",
  lilongwe: "Malawi", blantyre: "Malawi",
  mbabane: "Eswatini", manzini: "Eswatini", maseru: "Lesotho",
};

// ── Haversine distance ─────────────────────────────────────────────────────

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ── Get carrier's effective location ───────────────────────────────────────

function getCarrierLocation(
  prefs: CarrierPreferences | null,
): { lat: number; lng: number } | null {
  if (!prefs) return null;

  // Use home city first
  if (prefs.homeCity) {
    try {
      return lookupCoords(prefs.homeCity);
    } catch {
      // fall through
    }
  }

  // Fall back to preferred region centroid
  if (prefs.preferredRegions && prefs.preferredRegions.length > 0) {
    const region = prefs.preferredRegions[0];
    const center = REGION_CENTERS[region];
    if (center) return center;
  }

  return null;
}

// ── Cargo matching helper ──────────────────────────────────────────────────

function cargoMatchScore(
  loadCargoType: string,
  preferredTypes: string[] | undefined,
): number {
  if (!preferredTypes || preferredTypes.length === 0) {
    return 1.0; // No preferences → all loads get full score
  }

  const loadType = loadCargoType.toLowerCase().trim();
  const prefs = preferredTypes.map((t) => t.toLowerCase().trim());

  // Exact match
  if (prefs.includes(loadType)) return 1.0;

  // Related category match
  const related = CARGO_CATEGORIES[loadType];
  if (related && prefs.some((p) => related.includes(p))) return 0.5;

  return 0.0;
}

// ── Get city's country/region ──────────────────────────────────────────────

function getCityRegion(cityName: string): string | null {
  const key = cityName.toLowerCase().trim();
  if (CITY_COUNTRIES[key]) return CITY_COUNTRIES[key];

  // Fuzzy match
  for (const [ck, cv] of Object.entries(CITY_COUNTRIES)) {
    if (ck.includes(key) || key.includes(ck)) return cv;
  }
  return null;
}

// ── Main scoring: score a single load for a carrier ────────────────────────

export function scoreLoadForCarrier(params: {
  loadOriginLat: number;
  loadOriginLng: number;
  loadDestLat: number;
  loadDestLng: number;
  loadCargoType: string;
  loadPickupDate: string;
  carrierPreferences: CarrierPreferences | null;
  carrierHomeCity?: string;
}): ScoredLoad {
  const {
    loadOriginLat,
    loadOriginLng,
    loadDestLat,
    loadDestLng,
    loadCargoType,
    loadPickupDate,
    carrierPreferences,
    carrierHomeCity,
  } = params;

  // ── 1. Route proximity (40 points) ──────────────────────────────────────
  let routeProximity = 0;
  const carrierLoc = getCarrierLocation(carrierPreferences);
  if (carrierLoc) {
    const distToOrigin = haversineDistance(
      carrierLoc.lat,
      carrierLoc.lng,
      loadOriginLat,
      loadOriginLng,
    );
    // Score decays from 40 at 0km to 0 at 3000km
    routeProximity = Math.max(0, 40 * (1 - distToOrigin / 3000));
  } else {
    // No location info → neutral score
    routeProximity = 20;
  }

  // ── 2. Cargo match (25 points) ──────────────────────────────────────────
  const cargoFactor = cargoMatchScore(
    loadCargoType,
    carrierPreferences?.preferredCargoTypes,
  );
  const cargoMatch = Math.round(25 * cargoFactor);

  // ── 3. Backhaul potential (20 points) ───────────────────────────────────
  let backhaulPotential = 0;
  let isBackhaul = false;
  if (carrierPreferences?.homeCity || carrierHomeCity) {
    const homeCity = carrierPreferences?.homeCity || carrierHomeCity || "";
    try {
      const homeCoords = lookupCoords(homeCity);
      const distToHome = haversineDistance(
        loadDestLat,
        loadDestLng,
        homeCoords.lat,
        homeCoords.lng,
      );
      if (distToHome <= BACKHAUL_RADIUS_KM) {
        isBackhaul = true;
        // Full 20 points within 50km, linear decay to 0 at 200km
        backhaulPotential = Math.max(0, 20 * (1 - (distToHome - 50) / 150));
      } else {
        // Partial score for being somewhat close (200–500km)
        if (distToHome <= 500) {
          backhaulPotential = Math.max(0, 8 * (1 - (distToHome - 200) / 300));
        }
      }
    } catch {
      // fall through
    }
  }

  // ── 4. Timeline fit (15 points) ─────────────────────────────────────────
  let timelineFit = 0;
  try {
    const now = new Date();
    const pickupDate = new Date(loadPickupDate);
    const daysUntilPickup =
      (pickupDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

    if (daysUntilPickup < 0) {
      // Already past pickup — still available? Give moderate score
      timelineFit = 8;
    } else if (daysUntilPickup <= 3) {
      // Urgent — high score
      timelineFit = 15;
    } else if (daysUntilPickup <= 7) {
      // Good fit
      timelineFit = 15 * (1 - (daysUntilPickup - 3) / 4);
    } else if (daysUntilPickup <= 14) {
      // Moderate
      timelineFit = 10 * (1 - (daysUntilPickup - 7) / 7);
    } else if (daysUntilPickup <= 30) {
      // Planning ahead
      timelineFit = 5 * (1 - (daysUntilPickup - 14) / 16);
    } else {
      // Far future — low score
      timelineFit = 2;
    }
  } catch {
    timelineFit = 7; // Default if date parsing fails
  }
  timelineFit = Math.round(Math.max(0, Math.min(15, timelineFit)));

  // ── Combine ─────────────────────────────────────────────────────────────
  const totalScore = Math.round(routeProximity + cargoMatch + backhaulPotential + timelineFit);

  return {
    loadId: "", // Set by caller
    score: Math.min(100, totalScore),
    isBackhaul,
    breakdown: {
      routeProximity: Math.round(routeProximity),
      cargoMatch,
      backhaulPotential: Math.round(backhaulPotential),
      timelineFit,
    },
  };
}

// ── Score a batch of loads for a carrier ───────────────────────────────────

export interface LoadForScoring {
  id: string;
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  cargoType: string;
  pickupDate: string;
}

export function rankLoadsForCarrier(
  loads: LoadForScoring[],
  carrierPreferences: CarrierPreferences | null,
  carrierHomeCity?: string,
): ScoredLoad[] {
  const scored = loads.map((load) => {
    const result = scoreLoadForCarrier({
      loadOriginLat: load.originLat,
      loadOriginLng: load.originLng,
      loadDestLat: load.destLat,
      loadDestLng: load.destLng,
      loadCargoType: load.cargoType,
      loadPickupDate: load.pickupDate,
      carrierPreferences,
      carrierHomeCity,
    });
    result.loadId = load.id;
    return result;
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

// ── Suggest carriers for a shipper's load ─────────────────────────────────

export interface CarrierForSuggestion {
  id: string;
  name: string;
  companyName: string;
  onTimeRate: number;
  preferences: CarrierPreferences | null;
}

export function suggestCarriersForLoad(
  carriers: CarrierForSuggestion[],
  loadOriginLat: number,
  loadOriginLng: number,
  loadCargoType: string,
  loadOriginCity: string,
): CarrierMatch[] {
  const loadRegion = getCityRegion(loadOriginCity);

  const scored = carriers.map((carrier) => {
    // 1. Route familiarity (35 points) — carrier has preferred regions matching the load region
    let routeFamiliarity = 0;
    if (loadRegion && carrier.preferences?.preferredRegions) {
      if (carrier.preferences.preferredRegions.includes(loadRegion)) {
        routeFamiliarity = 35;
      } else {
        // Check for neighboring regions
        const neighborMap: Record<string, string[]> = {
          SA: ["Zim", "Bots", "Moz", "Nam"],
          Zim: ["SA", "Zam", "Moz", "Bots"],
          Zam: ["Zim", "DRC", "Bots", "Moz"],
          Bots: ["SA", "Nam", "Zim", "Zam"],
          Moz: ["SA", "Zim", "Zam"],
          Nam: ["SA", "Bots"],
        };
        const neighbors = neighborMap[loadRegion] || [];
        if (carrier.preferences.preferredRegions.some((r) => neighbors.includes(r))) {
          routeFamiliarity = 20;
        } else {
          routeFamiliarity = 10;
        }
      }
    } else {
      routeFamiliarity = 15; // No region data
    }

    // 2. On-time rate (25 points)
    const onTimeScore = Math.round(25 * (carrier.onTimeRate - 0.80) / 0.18);
    const clampedOnTime = Math.max(0, Math.min(25, onTimeScore));

    // 3. Cargo experience (25 points)
    const cargoExp = cargoMatchScore(
      loadCargoType,
      carrier.preferences?.preferredCargoTypes,
    );
    const cargoExperience = Math.round(25 * cargoExp);

    // 4. Proximity to load origin (15 points)
    let proximityToOrigin = 0;
    const carrierLoc = getCarrierLocation(carrier.preferences);
    if (carrierLoc) {
      const dist = haversineDistance(
        carrierLoc.lat,
        carrierLoc.lng,
        loadOriginLat,
        loadOriginLng,
      );
      proximityToOrigin = Math.max(0, 15 * (1 - dist / 2000));
    } else {
      proximityToOrigin = 7;
    }

    const totalScore = Math.round(
      routeFamiliarity + clampedOnTime + cargoExperience + proximityToOrigin,
    );

    return {
      carrierId: carrier.id,
      carrierName: carrier.name,
      companyName: carrier.companyName,
      onTimeRate: carrier.onTimeRate,
      score: Math.min(100, totalScore),
      breakdown: {
        routeFamiliarity,
        onTimeScore: clampedOnTime,
        cargoExperience,
        proximityToOrigin: Math.round(proximityToOrigin),
      },
    };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);
  return scored;
}
