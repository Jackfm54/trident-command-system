import { Contact, Domain } from "@/types/tactical";

const TRACK_PREFIXES: Record<Domain, string> = {
  air: "AIR",
  surface: "SUR",
  subsurface: "SUB",
  electronic: "ELE",
};

const PLATFORM_BY_DOMAIN: Record<Domain, string[]> = {
  air: ["fast-jet", "anti-ship-missile", "helo", "uav", "patrol-aircraft"],
  surface: ["frigate", "patrol-boat", "fishing-vessel", "cargo-ship", "fast-attack-craft"],
  subsurface: ["submarine", "uuv", "torpedo"],
  electronic: ["jammer", "radar-emitter", "comms-intercept", "deception-source"],
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
    speed = platform === "anti-ship-missile" ? rand(550, 750) : rand(200, 600);
    altitude = platform === "anti-ship-missile" ? rand(30, 150) : rand(1000, 35000);
  } else if (domain === "surface") {
    speed = rand(8, 35);
  } else if (domain === "subsurface") {
    speed = rand(4, 25);
    altitude = -rand(50, 400);
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
