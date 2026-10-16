import { Domain } from "@/types/tactical";

export interface Sensor {
  id: string;
  name: string;
  acronym: string;
  type: "radar" | "esm" | "sonar" | "eo_ir" | "datalink";
  domain: Domain[];
  range_nm: number;
  status: "online" | "degraded" | "offline" | "standby";
  mode: string;
  description: string;
}

export interface Weapon {
  id: string;
  name: string;
  acronym: string;
  domain: Domain;
  type: "missile" | "gun" | "torpedo" | "ciws" | "decoy" | "ew" | "rocket";
  range_nm: number;
  speed_kts: number; // weapon speed for time-of-flight
  pk: number; // probability of kill 0-1
  ammo: number;
  max_ammo: number;
  description: string;
}

// A weapon round in flight, rendered on the radar/chart
export interface Shot {
  id: string;
  acronym: string;
  domain: Domain;
  type: Weapon["type"];
  contactId: string;
  trackId: string;
  bearing: number;   // target bearing at launch
  range_nm: number;  // target range at launch
  start: number;     // Date.now() at launch
  duration: number;  // ms of flight
}

export interface ShipSystem {
  hull_integrity: number; // 0-100
  propulsion: number;
  power: number;
  cms_status: "nominal" | "degraded" | "battle";
  alert_level: "yellow" | "white" | "red";
}

export const INITIAL_SENSORS: Sensor[] = [
  {
    id: "spy",
    name: "Radar 3D Volumétrico",
    acronym: "SMART-S MK2",
    type: "radar",
    domain: ["air", "surface"],
    range_nm: 80,
    status: "online",
    mode: "TWS · Volumen",
    description: "Radar 3D banda S, vigilancia aérea/superficie, hasta 250 tracks.",
  },
  {
    id: "stir",
    name: "Radar Control de Tiro",
    acronym: "STIR-1.2 EO Mk2",
    type: "radar",
    domain: ["air", "surface"],
    range_nm: 50,
    status: "online",
    mode: "Track-Lock",
    description: "Radar banda X de seguimiento e iluminación para misiles SAM.",
  },
  {
    id: "irst",
    name: "Cámara EO/IR Estabilizada",
    acronym: "Mirador EO/IR",
    type: "eo_ir",
    domain: ["air", "surface"],
    range_nm: 18,
    status: "online",
    mode: "YOLO Auto-ID",
    description: "Cámara electro-óptica + IR con detección YOLO de plataformas y drones.",
  },
  {
    id: "esm",
    name: "Sistema ESM/ECM",
    acronym: "Vigile EW",
    type: "esm",
    domain: ["electronic", "air", "surface"],
    range_nm: 120,
    status: "online",
    mode: "Pasivo · DF",
    description: "Detecta y clasifica emisiones radar/comms hostiles, soporta jamming.",
  },
  {
    id: "hms",
    name: "Sonar de Casco",
    acronym: "Kingklip Mk2",
    type: "sonar",
    domain: ["subsurface"],
    range_nm: 12,
    status: "online",
    mode: "Activo Pulso CW",
    description: "Sonar de casco activo/pasivo, detección submarinos y torpedos.",
  },
  {
    id: "tas",
    name: "Sonar Remolcado",
    acronym: "CAPTAS-2",
    type: "sonar",
    domain: ["subsurface"],
    range_nm: 35,
    status: "standby",
    mode: "Pasivo LF",
    description: "Sonar de baja frecuencia remolcado, detección submarinos a larga distancia.",
  },
  {
    id: "link",
    name: "Datalink Táctico",
    acronym: "Link-Y / Link-16",
    type: "datalink",
    domain: ["air", "surface"],
    range_nm: 200,
    status: "online",
    mode: "NPG Activo",
    description: "Intercambio de pista táctica con flota y CCA.",
  },
];

export const INITIAL_WEAPONS: Weapon[] = [
  // AAW
  { id: "barak8", name: "Barak-8 SAM", acronym: "LRSAM", domain: "air", type: "missile", range_nm: 38, speed_kts: 1300, pk: 0.85, ammo: 16, max_ammo: 16, description: "Misil SAM larga distancia. Doble pulso." },
  { id: "essm", name: "ESSM Block 2", acronym: "ESSM", domain: "air", type: "missile", range_nm: 27, speed_kts: 2500, pk: 0.9, ammo: 24, max_ammo: 24, description: "Misil SAM corto-medio alcance, anti-vampiro." },
  { id: "ram", name: "RIM-116 RAM", acronym: "RAM", domain: "air", type: "missile", range_nm: 5, speed_kts: 1800, pk: 0.92, ammo: 21, max_ammo: 21, description: "Misil punto-defensa contra ASM y drones." },
  { id: "ciws", name: "Phalanx CIWS 20mm", acronym: "CIWS", domain: "air", type: "ciws", range_nm: 1.5, speed_kts: 3600, pk: 0.7, ammo: 1550, max_ammo: 1550, description: "Cañón gatling última línea, 4500 rpm." },
  { id: "chaff", name: "Chaff/Flares", acronym: "DECOY", domain: "air", type: "decoy", range_nm: 0.5, speed_kts: 0, pk: 0.6, ammo: 36, max_ammo: 36, description: "Cartuchos señuelo RF/IR contra misiles." },

  // ASuW
  { id: "nsm", name: "NSM Anti-buque", acronym: "NSM", domain: "surface", type: "missile", range_nm: 100, speed_kts: 600, pk: 0.88, ammo: 8, max_ammo: 8, description: "Misil antibuque furtivo sea-skimming." },
  { id: "gun76", name: "Cañón OTO 76mm", acronym: "76/62 SR", domain: "surface", type: "gun", range_nm: 8, speed_kts: 1700, pk: 0.5, ammo: 80, max_ammo: 80, description: "Cañón medio dual antibuque y NGS." },
  { id: "mg50", name: "Ametralladora .50", acronym: "M2HB", domain: "surface", type: "gun", range_nm: 1, speed_kts: 1700, pk: 0.4, ammo: 600, max_ammo: 600, description: "Defensa contra USV y embarcaciones rápidas." },

  // ASW
  { id: "mk46", name: "Torpedo Mk46 LWT", acronym: "Mk46", domain: "subsurface", type: "torpedo", range_nm: 6, speed_kts: 45, pk: 0.75, ammo: 6, max_ammo: 6, description: "Torpedo ligero antisubmarino guiado." },
  { id: "asroc", name: "VL-ASROC", acronym: "ASROC", domain: "subsurface", type: "missile", range_nm: 12, speed_kts: 1000, pk: 0.78, ammo: 4, max_ammo: 4, description: "Misil-cohete con torpedo Mk54, ASW lanzamiento vertical." },
  { id: "depth", name: "Cargas Profundidad", acronym: "DC", domain: "subsurface", type: "rocket", range_nm: 0.3, speed_kts: 0, pk: 0.4, ammo: 12, max_ammo: 12, description: "Cargas hundimiento contra UUV y submarinos cercanos." },

  // EW
  { id: "jam", name: "Jammer Banda X/S", acronym: "ECM", domain: "electronic", type: "ew", range_nm: 60, speed_kts: 0, pk: 0.7, ammo: 999, max_ammo: 999, description: "Interferencia activa contra radares y datalinks." },
  { id: "decoy_ew", name: "Señuelo Activo", acronym: "ANC", domain: "electronic", type: "decoy", range_nm: 4, speed_kts: 0, pk: 0.65, ammo: 8, max_ammo: 8, description: "Señuelo flotante de RF para deception de misiles." },
];

export const INITIAL_SHIP: ShipSystem = {
  hull_integrity: 100,
  propulsion: 100,
  power: 100,
  cms_status: "nominal",
  alert_level: "yellow",
};
