import { Contact, Domain } from "@/types/tactical";

const TRACK_PREFIXES: Record<Domain, string> = {
  air: "AIR",
  surface: "SUR",
  subsurface: "SUB",
  electronic: "ELE",
};

export const PLATFORM_BY_DOMAIN: Record<Domain, string[]> = {
  air: ["fast-jet", "anti-ship-missile", "helo", "uav-recon", "uav-kamikaze", "loitering-munition", "patrol-aircraft"],
  surface: ["frigate", "patrol-boat", "fishing-vessel", "cargo-ship", "fast-attack-craft", "usv-recon", "usv-kamikaze"],
  subsurface: ["submarine", "uuv-recon", "uuv-kamikaze", "torpedo"],
  electronic: ["jammer", "radar-emitter", "comms-intercept", "deception-source", "drone-datalink"],
};

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export function generateRandomContact(scenarioId: string, dominantDomain?: Domain): Omit<Contact, "id" | "created_at" | "updated_at"> {
  const domains: Domain[] = ["air", "surface", "subsurface", "electronic"];
  const domain = dominantDomain && Math.random() < 0.7 ? dominantDomain : domains[Math.floor(Math.random() * 4)];
  const platforms = PLATFORM_BY_DOMAIN[domain];
  const platform = platforms[Math.floor(Math.random() * platforms.length)];
  const trackId = `${TRACK_PREFIXES[domain]}-${Math.floor(rand(1000, 9999))}`;

  let speed = 0, altitude = 0;
  if (domain === "air") {
    if (platform === "anti-ship-missile") { speed = rand(550, 750); altitude = rand(30, 150); }
    else if (platform === "uav-recon") { speed = rand(60, 130); altitude = rand(2000, 18000); }
    else if (platform === "uav-kamikaze" || platform === "loitering-munition") { speed = rand(80, 180); altitude = rand(150, 1500); }
    else if (platform === "helo") { speed = rand(80, 150); altitude = rand(200, 3000); }
    else { speed = rand(200, 600); altitude = rand(1000, 35000); }
  } else if (domain === "surface") {
    if (platform === "usv-kamikaze") speed = rand(25, 55);
    else if (platform === "usv-recon") speed = rand(10, 30);
    else speed = rand(8, 35);
  } else if (domain === "subsurface") {
    if (platform === "uuv-recon") speed = rand(3, 10);
    else if (platform === "uuv-kamikaze") speed = rand(8, 35);
    else speed = rand(4, 25);
    altitude = -rand(30, 400);
  } else {
    speed = 0;
  }

  return {
    scenario_id: scenarioId,
    track_id: trackId,
    domain,
    classification: "unknown",
    platform_type: platform,
    bearing: rand(0, 360),
    range_nm: rand(2, 60),
    speed_kts: speed,
    altitude_ft: altitude,
    heading: rand(0, 360),
    ai_confidence: 0,
    ai_reasoning: null,
    status: "tracking",
  };
}

export function advanceContact(c: Contact): Partial<Contact> {
  // crude kinematic update
  const dt = 1 / 3600; // seconds -> hours? we update every ~1.5s
  const dist = (c.speed_kts ?? 0) * dt * 1.5;
  const headingRad = ((c.heading ?? 0) * Math.PI) / 180;
  const dx = Math.sin(headingRad) * dist;
  const dy = Math.cos(headingRad) * dist;
  const bearingRad = (((c.bearing ?? 0) * Math.PI) / 180);
  const x = (c.range_nm ?? 0) * Math.sin(bearingRad) + dx;
  const y = (c.range_nm ?? 0) * Math.cos(bearingRad) + dy;
  const newRange = Math.max(0.5, Math.sqrt(x * x + y * y));
  const newBearing = (Math.atan2(x, y) * 180) / Math.PI;
  return {
    range_nm: newRange,
    bearing: (newBearing + 360) % 360,
  };
}
