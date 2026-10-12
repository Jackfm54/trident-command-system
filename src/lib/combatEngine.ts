import { Contact, Domain } from "@/types/tactical";
import { Sensor, Weapon } from "@/lib/combatSystems";

/** A contact is held only if an online/degraded sensor covering its domain reaches it. */
export function isDetected(c: Contact, sensors: Sensor[]): boolean {
  const r = c.range_nm ?? 0;
  return sensors.some((s) => {
    if (s.status !== "online" && s.status !== "degraded") return false;
    if (!s.domain.includes(c.domain as Domain)) return false;
    const eff = s.status === "degraded" ? s.range_nm * 0.6 : s.range_nm;
    return r <= eff;
  });
}

export function detectingSensors(c: Contact, sensors: Sensor[]) {
  return sensors.filter((s) => (s.status === "online" || s.status === "degraded") && s.domain.includes(c.domain as Domain) && (c.range_nm ?? 0) <= s.range_nm);
}

/** Inbound attackers steer to own ship and close range (no 0.5nm floor). */
export function advanceAttacker(c: Contact, dtSec: number): Partial<Contact> {
  const dist = ((c.speed_kts ?? 0) * dtSec) / 3600;
  return { heading: ((c.bearing ?? 0) + 180) % 360, range_nm: Math.max(0, (c.range_nm ?? 0) - dist) };
}

export const IMPACT_DAMAGE: Record<string, number> = {
  "anti-ship-missile": 30,
  "uav-kamikaze": 12,
  "loitering-munition": 15,
  "usv-kamikaze": 22,
  torpedo: 40,
  "uuv-kamikaze": 30,
};

type Seed = Omit<Contact, "id" | "created_at" | "updated_at">;
const r = (a: number, b: number) => a + Math.random() * (b - a);

export const THREATS: { domain: Domain; platform: string; speed: [number, number]; range: [number, number]; alt: [number, number] }[] = [
  { domain: "air", platform: "anti-ship-missile", speed: [550, 750], range: [22, 35], alt: [20, 60] },
  { domain: "air", platform: "uav-kamikaze", speed: [90, 160], range: [10, 20], alt: [200, 1200] },
  { domain: "air", platform: "loitering-munition", speed: [100, 180], range: [8, 16], alt: [150, 800] },
  { domain: "surface", platform: "usv-kamikaze", speed: [35, 55], range: [6, 12], alt: [0, 0] },
  { domain: "subsurface", platform: "torpedo", speed: [40, 55], range: [4, 8], alt: [-60, -20] },
];

export const PLATFORM_LABEL: Record<string, string> = {
  "anti-ship-missile": "Misil antibuque",
  "uav-kamikaze": "Dron aéreo kamikaze",
  "loitering-munition": "Munición merodeadora",
  "usv-kamikaze": "Lancha no tripulada kamikaze",
  torpedo: "Torpedo",
};

export function attackerSeed(scenarioId: string, platform: string): Seed | null {
  const t = THREATS.find((x) => x.platform === platform);
  if (!t) return null;
  const bearing = r(0, 360);
  return {
    scenario_id: scenarioId,
    track_id: `${t.domain === "air" ? "AIR" : t.domain === "surface" ? "SUR" : "SUB"}-${Math.floor(r(1000, 9999))}`,
    domain: t.domain,
    classification: "hostile",
    platform_type: t.platform,
    bearing,
    range_nm: r(t.range[0], t.range[1]),
    speed_kts: r(t.speed[0], t.speed[1]),
    altitude_ft: r(t.alt[0], t.alt[1]),
    heading: (bearing + 180) % 360,
    ai_confidence: 0.95,
    ai_reasoning: "ENTRENAMIENTO · Amenaza inbound con rumbo de colisión hacia propia unidad.",
    status: "attacking",
  } as Seed;
}

export function generateAttackWave(scenarioId: string, difficulty: number): Seed[] {
  const n = Math.max(1, Math.round(r(1, 1 + difficulty)));
  return Array.from({ length: n }, () => attackerSeed(scenarioId, THREATS[Math.floor(Math.random() * THREATS.length)].platform)!);
}

export function waveFromThreats(scenarioId: string, threats: { platform: string; count: number }[]): Seed[] {
  return threats.flatMap((t) => Array.from({ length: Math.min(20, Math.max(0, t.count)) }, () => attackerSeed(scenarioId, t.platform)).filter(Boolean) as Seed[]);
}

/** TEWA: best weapon = in domain, with ammo, in range; prefers highest pk then longest range margin. */
export function pickWeapon(c: Contact, weapons: Weapon[]): Weapon | null {
  const range = c.range_nm ?? 0;
  const cand = weapons.filter((w) => w.domain === c.domain && w.ammo > 0 && w.range_nm >= range && w.type !== "decoy");
  const decoys = weapons.filter((w) => w.domain === c.domain && w.ammo > 0 && w.range_nm >= range && w.type === "decoy");
  const list = cand.length ? cand : decoys;
  if (!list.length) return null;
  return list.sort((a, b) => b.pk - a.pk || a.range_nm - b.range_nm)[0];
}

export function ammoCost(w: Weapon) {
  return w.type === "ciws" ? 100 : w.type === "gun" ? 8 : 1;
}

// ===== Fleet geometry (integrated exercises) =====
// Reference frame: x = east nm, y = north nm from the exercise centre. Contacts store range/bearing from the centre.
export function toXY(c: { range_nm: number | null; bearing: number | null }) {
  const b = ((c.bearing ?? 0) * Math.PI) / 180;
  const r0 = c.range_nm ?? 0;
  return { x: r0 * Math.sin(b), y: r0 * Math.cos(b) };
}
export function fromXY(x: number, y: number) {
  return { range_nm: Math.sqrt(x * x + y * y), bearing: ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360 };
}
/** Re-express a centre-frame contact as range/bearing from an own-ship position. */
export function relativeTo<T extends { range_nm: number | null; bearing: number | null }>(c: T, ox: number, oy: number): T {
  const p = toXY(c);
  return { ...c, ...fromXY(p.x - ox, p.y - oy) };
}
/** Move a centre-frame contact toward a target point. */
export function advanceToward(c: Contact, tx: number, ty: number, dtSec: number): Partial<Contact> {
  const p = toXY(c);
  const dx = tx - p.x, dy = ty - p.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  const step = ((c.speed_kts ?? 0) * dtSec) / 3600;
  const k = d <= step || d === 0 ? 1 : step / d;
  const n = fromXY(p.x + dx * k, p.y + dy * k);
  return { ...n, heading: ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360 };
}
export function distTo(c: Contact, tx: number, ty: number) {
  const p = toXY(c);
  return Math.hypot(tx - p.x, ty - p.y);
}
/** Attacker seed placed around a target ship (centre frame). */
export function attackerSeedAt(scenarioId: string, platform: string, unitId: string, ux: number, uy: number): Seed | null {
  const s = attackerSeed(scenarioId, platform);
  if (!s) return null;
  const p = toXY(s);
  const n = fromXY(ux + p.x, uy + p.y);
  return { ...s, ...n, heading: ((s.bearing ?? 0) + 180) % 360, target_unit_id: unitId } as Seed;
}
