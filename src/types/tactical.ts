export type Domain = "air" | "surface" | "subsurface" | "electronic";
export type Classification = "friend" | "hostile" | "neutral" | "suspect" | "unknown";

export interface Contact {
  id: string;
  scenario_id: string | null;
  track_id: string;
  domain: Domain;
  classification: Classification;
  platform_type: string | null;
  bearing: number | null;
  range_nm: number | null;
  speed_kts: number | null;
  altitude_ft: number | null;
  heading: number | null;
  ai_confidence: number | null;
  ai_reasoning: string | null;
  status: string;
  target_unit_id?: string | null;
  created_at: string;
  updated_at: string;
}

/** A friendly round in flight from own ship toward a target contact. */
export interface ShotInFlight {
  id: string;
  targetId: string;
  trackId: string;
  acronym: string;
  domain: Domain;
  wtype: "missile" | "gun" | "torpedo" | "ciws" | "decoy" | "ew" | "rocket";
  firedAt: number; // Date.now()
  tofMs: number;   // visual flight time, matches impact resolution
}

export interface Scenario {
  id: string;
  name: string;
  description: string | null;
  domain: string;
  threat_level: string;
}

export interface TacticalEvent {
  id: string;
  scenario_id: string | null;
  contact_id: string | null;
  event_type: string;
  domain: string;
  severity: string;
  message: string;
  created_at: string;
}

export const DOMAIN_META: Record<Domain, { label: string; color: string; abbr: string }> = {
  air: { label: "Aéreo", color: "domain-air", abbr: "AAW" },
  surface: { label: "Superficie", color: "domain-surface", abbr: "ASuW" },
  subsurface: { label: "Submarino", color: "domain-subsurface", abbr: "ASW" },
  electronic: { label: "Electrónico", color: "domain-electronic", abbr: "EW" },
};

export const CLASSIFICATION_META: Record<Classification, { label: string; color: string; symbol: string }> = {
  friend: { label: "Amigo", color: "threat-friend", symbol: "◯" },
  hostile: { label: "Hostil", color: "threat-hostile", symbol: "◇" },
  neutral: { label: "Neutral", color: "threat-neutral", symbol: "□" },
  suspect: { label: "Sospechoso", color: "threat-suspect", symbol: "△" },
  unknown: { label: "Desconocido", color: "threat-unknown", symbol: "?" },
};
