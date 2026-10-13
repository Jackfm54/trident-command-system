import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Circle, Polyline, CircleMarker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Contact, CLASSIFICATION_META, Domain } from "@/types/tactical";
import { Weapon } from "@/lib/combatSystems";

interface Props {
  contacts: Contact[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  filterDomain?: Domain | "all";
  weapons?: Weapon[];
  showWeaponRings?: boolean;
}

// Own ship anchored off Cartagena, Colombia
const SHIP: [number, number] = [10.55, -75.85];

// Convert bearing+range from ship to lat/lon (great-circle approx)
function destination(lat: number, lon: number, bearingDeg: number, distNm: number): [number, number] {
  const R = 3440.065; // nm
  const br = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lon * Math.PI) / 180;
  const dr = distNm / R;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(dr) + Math.cos(lat1) * Math.sin(dr) * Math.cos(br));
  const lon2 =
    lon1 +
    Math.atan2(Math.sin(br) * Math.sin(dr) * Math.cos(lat1), Math.cos(dr) - Math.sin(lat1) * Math.sin(lat2));
  return [(lat2 * 180) / Math.PI, (lon2 * 180) / Math.PI];
}

const DOMAIN_HEX: Record<Domain, string> = {
  air: "#22d3ee",
  surface: "#facc15",
  subsurface: "#a855f7",
  electronic: "#ef4444",
};

const CLASS_HEX: Record<string, string> = {
  hostile: "#ef4444",
  friend: "#22c55e",
  neutral: "#eab308",
  unknown: "#94a3b8",
  suspect: "#f97316",
  assumed_friend: "#16a34a",
};

function ShipIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="width:18px;height:18px;border-radius:50%;background:#22c55e;border:2px solid #052e16;box-shadow:0 0 12px #22c55e;"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function ContactIcon(symbol: string, color: string, hostile: boolean) {
  return L.divIcon({
    className: "",
    html: `<div style="font-family:'JetBrains Mono',monospace;font-weight:bold;font-size:${hostile ? 20 : 16}px;color:${color};text-shadow:0 0 6px ${color},0 0 2px #000;line-height:1;">${symbol}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function FitOnce({ contacts, weaponMaxNm }: { contacts: Contact[]; weaponMaxNm: number }) {
  const map = useMap();
  const did = useRef(false);
  useEffect(() => {
    if (did.current) return;
    const pts: [number, number][] = [SHIP];
    contacts.forEach((c) => pts.push(destination(SHIP[0], SHIP[1], c.bearing ?? 0, c.range_nm ?? 0)));
    // Include weapon coverage so user sees the rings on first load
    if (weaponMaxNm > 0) {
      [0, 90, 180, 270].forEach((b) => pts.push(destination(SHIP[0], SHIP[1], b, weaponMaxNm)));
    }
    if (pts.length < 2) return;
    const b = L.latLngBounds(pts);
    map.fitBounds(b.pad(0.15));
    did.current = true;
  }, [contacts, weaponMaxNm, map]);
  return null;
}

export function NauticalChart({
  contacts,
  selectedId,
  onSelect,
  filterDomain = "all",
  weapons = [],
  showWeaponRings: showWeaponRingsProp = true,
  ownName = "ARC ALM. PADILLA",
}: Props) {
  const [localShowRings, setLocalShowRings] = useState(showWeaponRingsProp);
  const showWeaponRings = localShowRings;

  const filtered = useMemo(
    () => contacts.filter((c) => filterDomain === "all" || c.domain === filterDomain || c.status === "fleet" || c.status === "sunk"),
    [contacts, filterDomain]
  );

  const visibleWeapons = (weapons ?? []).filter(
    (w) =>
      showWeaponRings &&
      w.type !== "decoy" &&
      w.ammo > 0 &&
      (filterDomain === "all" || w.domain === filterDomain)
  );

  const weaponMaxNm = useMemo(
    () => (weapons ?? []).filter((w) => w.type !== "decoy" && w.ammo > 0).reduce((m, w) => Math.max(m, w.range_nm), 0),
    [weapons]
  );

  return (
    <div className="space-y-2">
      <div className="hud-panel flex items-center justify-between gap-3 px-3 py-2">
        <span className="hud-label">CARTA NÁUTICA · COBERTURAS DE ARMAS</span>
        <button
          onClick={() => setLocalShowRings((v) => !v)}
          className={`px-2 py-1 text-[10px] font-mono uppercase tracking-wider rounded border ${
            showWeaponRings
              ? "bg-primary text-primary-foreground border-primary shadow-glow-amber"
              : "border-border text-muted-foreground hover:text-accent"
          }`}
        >
          Coberturas {showWeaponRings ? "ON" : "OFF"}
        </button>
      </div>
      <div className="hud-panel relative w-full max-w-[820px] mx-auto overflow-hidden" style={{ height: 600 }}>
        <MapContainer
          center={SHIP}
          zoom={6}
          style={{ height: "100%", width: "100%", background: "#021018" }}
          worldCopyJump
        >
          <TileLayer
            attribution='© OpenStreetMap'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitOnce contacts={filtered} weaponMaxNm={showWeaponRings ? weaponMaxNm : 0} />

          {/* Weapon coverage rings around ship */}
          {visibleWeapons.map((w) => (
            <Circle
              key={w.id}
              center={SHIP}
              radius={w.range_nm * 1852}
              pathOptions={{
                color: DOMAIN_HEX[w.domain],
                weight: 0.8,
                opacity: 0.55,
                fill: false,
                dashArray: w.type === "ciws" || w.type === "gun" ? "2 4" : w.type === "torpedo" ? "5 4" : "8 4",
              }}
            >
              <Tooltip permanent direction="top" offset={[0, -6]} opacity={0.85}>
                <span style={{ color: DOMAIN_HEX[w.domain], fontFamily: "JetBrains Mono", fontSize: 10 }}>
                  {w.acronym} {w.range_nm}NM
                </span>
              </Tooltip>
            </Circle>
          ))}

          {/* Own ship */}
          <Marker position={SHIP} icon={ShipIcon()}>
            <Tooltip permanent direction="right" offset={[10, 0]}>
              <span style={{ fontFamily: "JetBrains Mono", fontSize: 10, color: "#22c55e" }}>{ownName}</span>
            </Tooltip>
          </Marker>

          {/* Contacts */}
          {filtered.map((c) => {
            const pos = destination(SHIP[0], SHIP[1], c.bearing ?? 0, c.range_nm ?? 0);
            const meta = CLASSIFICATION_META[c.classification];
            const color = CLASS_HEX[c.classification] ?? "#94a3b8";
            const spd = c.speed_kts ?? 0;
            // velocity vector — project 3 minutes ahead
            const ahead = destination(pos[0], pos[1], c.heading ?? 0, (spd / 60) * 3);
            return (
              <Fragment key={c.id}>
                <Marker
                  position={pos}
                  icon={ContactIcon(meta.symbol, color, c.classification === "hostile")}
                  eventHandlers={{ click: () => onSelect?.(c.id) }}
                >
                  <Tooltip permanent direction="right" offset={[10, 0]} opacity={0.9}>
                    <div style={{ fontFamily: "JetBrains Mono", fontSize: 10, color, lineHeight: 1.2 }}>
                      <div style={{ fontWeight: "bold" }}>{c.track_id}</div>
                      <div>{String(Math.round(c.heading ?? 0)).padStart(3, "0")}° · {Math.round(spd)}kt</div>
                      <div>{(c.range_nm ?? 0).toFixed(1)}nm</div>
                    </div>
                  </Tooltip>
                </Marker>
                {spd > 0 && (
                  <Polyline positions={[pos, ahead]} pathOptions={{ color, weight: 1.5, opacity: 0.85 }} />
                )}
                {c.id === selectedId && (
                  <CircleMarker center={pos} radius={14} pathOptions={{ color, weight: 1.5, fill: false, opacity: 0.8 }} />
                )}
              </Fragment>
            );
          })}
        </MapContainer>

        <div className="absolute top-2 left-3 hud-label z-[1000] bg-background/70 px-2 py-0.5 rounded">
          CARTA NÁUTICA · WGS-84
        </div>
        <div className="absolute top-2 right-3 hud-label z-[1000] bg-background/70 px-2 py-0.5 rounded glow-cyan">
          {SHIP[0].toFixed(2)}°N · {Math.abs(SHIP[1]).toFixed(2)}°W
        </div>
        <div className="absolute bottom-2 left-3 hud-label z-[1000] bg-background/70 px-2 py-0.5 rounded">
          CONTACTS: <span className="hud-value text-primary">{filtered.length}</span>
        </div>
      </div>
    </div>
  );
}
