import { useEffect, useRef, useState } from "react";
import { Contact, Domain, CLASSIFICATION_META, ShotInFlight } from "@/types/tactical";
import { Weapon } from "@/lib/combatSystems";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Maximize2, Footprints } from "lucide-react";

interface Props {
  contacts: Contact[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  filterDomain?: Domain | "all";
  rangeNm: number;
  onRangeChange: (r: number) => void;
  weapons?: Weapon[];
  showWeaponRings?: boolean;
  onToggleWeaponRings?: () => void;
  ownName?: string;
  shots?: ShotInFlight[];
}

const RANGE_PRESETS = [5, 10, 20, 40, 80, 160];

const WEAPON_RING_COLOR: Record<Domain, string> = {
  air: "var(--domain-air)",
  surface: "var(--domain-surface)",
  subsurface: "var(--domain-subsurface)",
  electronic: "var(--domain-electronic)",
};

// Realistic projectile glyph drawn pointing "up" (0°) and rotated along its flight path.
// Missiles get a body, wings and a flickering exhaust flame; torpedoes a hull with
// propeller wake; guns/CIWS a burst of tracer rounds.
function ShotGlyph({ wtype, color, angleDeg, px, py }: { wtype: ShotInFlight["wtype"]; color: string; angleDeg: number; px: number; py: number }) {
  if (wtype === "missile" || wtype === "rocket") {
    return (
      <g transform={`translate(${px} ${py}) rotate(${angleDeg})`} style={{ filter: `drop-shadow(0 0 3px ${color})` }}>
        {/* exhaust plume */}
        <line x1="0" y1="6" x2="0" y2="18" stroke={color} strokeWidth="1.6" opacity="0.35" strokeLinecap="round" />
        <line x1="0" y1="6" x2="0" y2="12" stroke="#fff" strokeWidth="0.9" opacity="0.5" strokeLinecap="round" />
        {/* flame */}
        <ellipse className="animate-flame" cx="0" cy="6.5" rx="1.6" ry="3.4" fill="url(#shotFlame)" />
        {/* body */}
        <rect x="-1.1" y="-8" width="2.2" height="13" rx="1" fill={color} stroke="#fff" strokeWidth="0.3" />
        {/* nose cone */}
        <path d="M -1.1 -8 L 0 -12 L 1.1 -8 Z" fill={color} />
        {/* wings */}
        <path d="M -1.1 0 L -3.2 4 L -1.1 4 Z M 1.1 0 L 3.2 4 L 1.1 4 Z" fill={color} opacity="0.9" />
      </g>
    );
  }
  if (wtype === "torpedo") {
    return (
      <g transform={`translate(${px} ${py}) rotate(${angleDeg})`} style={{ filter: `drop-shadow(0 0 3px ${color})` }}>
        {/* bubble wake */}
        {[7, 10, 13, 16].map((dy, i) => (
          <circle key={dy} className="animate-bubble" style={{ animationDelay: `${i * 0.3}s` }} cx={i % 2 === 0 ? -0.8 : 0.8} cy={dy} r={0.9 - i * 0.15} fill="#e0f2fe" opacity="0.7" />
        ))}
        {/* hull */}
        <rect x="-1.3" y="-9" width="2.6" height="15" rx="1.3" fill={color} stroke="#fff" strokeWidth="0.3" />
        <path d="M -1.3 -9 A 1.3 1.3 0 0 1 1.3 -9 Z" fill="#e2e8f0" />
        {/* tail fins */}
        <path d="M -1.3 3 L -2.8 6.5 L -1.3 6 Z M 1.3 3 L 2.8 6.5 L 1.3 6 Z" fill={color} />
      </g>
    );
  }
  if (wtype === "gun" || wtype === "ciws") {
    return (
      <g transform={`translate(${px} ${py}) rotate(${angleDeg})`} style={{ filter: `drop-shadow(0 0 3px ${color})` }}>
        {/* tracer burst */}
        {[[-1.6, -6], [0, -9], [1.6, -5]].map(([dx, dy], i) => (
          <line key={i} x1={dx} y1={dy} x2={dx} y2={dy + 6} stroke="#fde68a" strokeWidth="1.1" opacity={0.9 - i * 0.2} strokeLinecap="round" />
        ))}
        <circle cx="0" cy="0" r="1.4" fill="#fff" />
      </g>
    );
  }
  // decoy / EW — pulsing cloud
  return (
    <g transform={`translate(${px} ${py})`}>
      <circle cx="0" cy="0" r="5" fill="none" stroke={color} strokeWidth="0.8" className="animate-pulse-threat" opacity="0.8" />
      <circle cx="0" cy="0" r="2" fill={color} opacity="0.7" />
    </g>
  );
}

export function TacticalRadar({
  contacts,
  selectedId,
  onSelect,
  filterDomain = "all",
  rangeNm,
  onRangeChange,
  weapons = [],
  showWeaponRings = true,
  onToggleWeaponRings,
  ownName = "ARC ALM. PADILLA",
  shots = [],
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [showTrails, setShowTrails] = useState(true);

  // Smooth animation tick while friendly rounds are in flight
  const shotsActive = shots.length > 0;
  useEffect(() => {
    if (!shotsActive) return;
    const iv = setInterval(() => force((n) => n + 1), 80);
    return () => clearInterval(iv);
  }, [shotsActive]);
  const trailsRef = useRef<Map<string, { x: number; y: number; t: number }[]>>(new Map());
  const shotTrailsRef = useRef<Map<string, { x: number; y: number; t: number }[]>>(new Map());
  const [, force] = useState(0);

  const filtered = contacts.filter((c) => filterDomain === "all" || c.domain === filterDomain || c.status === "fleet" || c.status === "sunk");
  const scale = 195 / rangeNm; // px per nm

  // Update trails every time contacts change
  useEffect(() => {
    const now = Date.now();
    const map = trailsRef.current;
    const seen = new Set<string>();
    filtered.forEach((c) => {
      seen.add(c.id);
      const cr = Math.min((c.range_nm ?? 0) * scale, 195);
      const a = ((c.bearing ?? 0) * Math.PI) / 180;
      const x = 200 + cr * Math.sin(a);
      const y = 200 - cr * Math.cos(a);
      const arr = map.get(c.id) ?? [];
      const last = arr[arr.length - 1];
      if (!last || Math.hypot(last.x - x, last.y - y) > 1) {
        arr.push({ x, y, t: now });
        while (arr.length > 25) arr.shift();
        map.set(c.id, arr);
      }
    });
    // prune
    Array.from(map.keys()).forEach((k) => { if (!seen.has(k)) map.delete(k); });
    force((n) => n + 1);
  }, [contacts, rangeNm, filterDomain]);

  const ringStep = rangeNm / 4;
  const rings = [1, 2, 3, 4].map((i) => ({ nm: ringStep * i, r: scale * ringStep * i }));

  const visibleWeapons = weapons.filter((w) => {
    if (!showWeaponRings) return false;
    if (filterDomain !== "all" && w.domain !== filterDomain) return false;
    if (w.type === "decoy") return false;
    return w.ammo > 0;
  });

  const zoomIn = () => {
    const idx = RANGE_PRESETS.findIndex((r) => r >= rangeNm);
    const nextIdx = Math.max(0, idx - 1);
    onRangeChange(RANGE_PRESETS[nextIdx]);
  };
  const zoomOut = () => {
    const idx = RANGE_PRESETS.findIndex((r) => r >= rangeNm);
    const nextIdx = Math.min(RANGE_PRESETS.length - 1, idx < 0 ? RANGE_PRESETS.length - 1 : idx + 1);
    onRangeChange(RANGE_PRESETS[nextIdx]);
  };

  return (
    <div className="space-y-2">
      {/* Controls */}
      <div className="hud-panel flex items-center justify-between gap-3 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="hud-label">RANGE</span>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="outline" className="h-7 w-7" onClick={zoomIn} title="Zoom in / acercar">
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <span className="font-mono text-sm text-primary glow-amber tabular-nums w-16 text-center">
              {rangeNm} NM
            </span>
            <Button size="icon" variant="outline" className="h-7 w-7" onClick={zoomOut} title="Zoom out / alejar">
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex items-center gap-1 ml-2">
            {RANGE_PRESETS.map((r) => (
              <button
                key={r}
                onClick={() => onRangeChange(r)}
                className={`px-1.5 py-0.5 text-[10px] font-mono rounded border ${
                  r === rangeNm
                    ? "bg-primary text-primary-foreground border-primary shadow-glow-amber"
                    : "border-border text-muted-foreground hover:text-accent hover:border-accent"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={showTrails ? "default" : "outline"}
            onClick={() => setShowTrails((v) => !v)}
            className="h-7 text-[10px] font-mono uppercase tracking-wider"
          >
            <Footprints className="h-3 w-3 mr-1" />
            Estela {showTrails ? "ON" : "OFF"}
          </Button>
          <Button
            size="sm"
            variant={showWeaponRings ? "default" : "outline"}
            onClick={onToggleWeaponRings}
            className="h-7 text-[10px] font-mono uppercase tracking-wider"
          >
            <Maximize2 className="h-3 w-3 mr-1" />
            Coberturas {showWeaponRings ? "ON" : "OFF"}
          </Button>
        </div>
      </div>

      <div ref={ref} className="hud-panel relative aspect-square w-full max-w-[820px] mx-auto bg-gradient-hud overflow-hidden">
        <svg viewBox="0 0 400 400" className="absolute inset-0 w-full h-full">
          <defs>
            <radialGradient id="ringGrad">
              <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.05" />
              <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0.2" />
            </radialGradient>
            <radialGradient id="shotFlame">
              <stop offset="0%" stopColor="#fff" stopOpacity="1" />
              <stop offset="45%" stopColor="#fde68a" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Range rings */}
          {rings.map((ring) => (
            <circle
              key={ring.nm}
              cx="200" cy="200" r={ring.r}
              fill="none" stroke="hsl(var(--accent))" strokeOpacity="0.25" strokeWidth="0.5"
            />
          ))}
          {[0, 45, 90, 135].map((a) => (
            <line
              key={a}
              x1="200" y1="200"
              x2={200 + 195 * Math.sin((a * Math.PI) / 180)}
              y2={200 - 195 * Math.cos((a * Math.PI) / 180)}
              stroke="hsl(var(--accent))" strokeOpacity="0.2" strokeWidth="0.5"
            />
          ))}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <text
              key={a}
              x={200 + 205 * Math.sin((a * Math.PI) / 180)}
              y={200 - 205 * Math.cos((a * Math.PI) / 180)}
              fill="hsl(var(--accent))"
              fontSize="9"
              fontFamily="JetBrains Mono"
              textAnchor="middle"
              dominantBaseline="middle"
              opacity="0.7"
            >
              {String(a).padStart(3, "0")}
            </text>
          ))}
          {rings.map((ring) => (
            <text
              key={`lbl-${ring.nm}`}
              x="202"
              y={200 - ring.r + 3}
              fill="hsl(var(--accent))"
              fontSize="8"
              fontFamily="JetBrains Mono"
              opacity="0.55"
            >
              {ring.nm.toFixed(ring.nm < 10 ? 1 : 0)}nm
            </text>
          ))}

          {/* Weapon coverage rings */}
          {visibleWeapons.map((w, i) => {
            const wr = Math.min(w.range_nm * scale, 360);
            if (wr < 4) return null;
            const color = `hsl(${WEAPON_RING_COLOR[w.domain]})`;
            const dash = w.type === "ciws" || w.type === "gun" ? "2 3" : w.type === "torpedo" ? "5 4" : "8 4";
            // distribute labels along bearings
            const bearing = (i * 37) % 360;
            const lblX = 200 + (wr - 8) * Math.sin((bearing * Math.PI) / 180);
            const lblY = 200 - (wr - 8) * Math.cos((bearing * Math.PI) / 180);
            return (
              <g key={w.id} opacity="0.55">
                <circle
                  cx="200" cy="200" r={wr}
                  fill="none"
                  stroke={color}
                  strokeWidth="0.7"
                  strokeDasharray={dash}
                />
                <text
                  x={lblX}
                  y={lblY}
                  fill={color}
                  fontSize="7.5"
                  fontFamily="JetBrains Mono"
                  fontWeight="bold"
                  textAnchor="middle"
                  style={{ paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                >
                  {w.acronym} {w.range_nm}nm
                </text>
              </g>
            );
          })}

          {/* Sweep */}
          <g style={{ transformOrigin: "200px 200px", animation: "radar-sweep 6s linear infinite" }}>
            <path d="M 200 200 L 200 5 A 195 195 0 0 1 333 95 Z" fill="url(#ringGrad)" opacity="0.6" />
          </g>

          {/* Own ship */}
          <g>
            <circle cx="200" cy="200" r="5" fill="hsl(var(--threat-friend))" />
            <circle cx="200" cy="200" r="9" fill="none" stroke="hsl(var(--threat-friend))" strokeWidth="1" />
            <text x="208" y="204" fill="hsl(var(--threat-friend))" fontSize="9" fontFamily="JetBrains Mono">{ownName}</text>
          </g>

          {/* Trails */}
          {showTrails && filtered.map((c) => {
            const trail = trailsRef.current.get(c.id);
            if (!trail || trail.length < 2) return null;
            const meta = CLASSIFICATION_META[c.classification];
            const color = `hsl(var(--${meta.color}))`;
            const d = trail.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
            return (
              <g key={`trail-${c.id}`} opacity="0.7">
                <path d={d} fill="none" stroke={color} strokeWidth="0.8" strokeDasharray="2 2" opacity="0.55" />
                {trail.slice(-6).map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={0.8 + i * 0.25} fill={color} opacity={0.15 + i * 0.12} />
                ))}
              </g>
            );
          })}

          {/* Friendly rounds in flight (own weapons) */}
          {shots.map((s) => {
            const target = filtered.find((c) => c.id === s.targetId);
            if (!target) return null;
            const cr = Math.min((target.range_nm ?? 0) * scale, 195);
            const a = ((target.bearing ?? 0) * Math.PI) / 180;
            const tx = 200 + cr * Math.sin(a);
            const ty = 200 - cr * Math.cos(a);
            const frac = Math.min(1, (Date.now() - s.firedAt) / s.tofMs);
            const px = 200 + (tx - 200) * frac;
            const py = 200 + (ty - 200) * frac;
            const color = `hsl(${WEAPON_RING_COLOR[s.domain]})`;
            // Flight direction: 0° = north, matches the "up"-pointing glyph
            const angleDeg = (Math.atan2(tx - 200, -(ty - 200)) * 180) / Math.PI;
            // Wake/trail for the round in flight (same style as contact trails)
            const smap = shotTrailsRef.current;
            const sarr = smap.get(s.id) ?? [];
            const slast = sarr[sarr.length - 1];
            if (!slast || Math.hypot(slast.x - px, slast.y - py) > 0.5) {
              sarr.push({ x: px, y: py, t: Date.now() });
              while (sarr.length > 25) sarr.shift();
              smap.set(s.id, sarr);
            }
            Array.from(smap.keys()).forEach((k) => { if (!shots.some((sh) => sh.id === k)) smap.delete(k); });
            const strail = sarr.length >= 2 ? sarr : null;
            return (
              <g key={s.id}>
                {/* fire vector from own ship to round */}
                <line x1="200" y1="200" x2={px} y2={py} stroke={color} strokeWidth="1" strokeDasharray="3 2" opacity="0.6" />
                {/* wake trail */}
                {showTrails && strail && (
                  <g opacity="0.7">
                    <path
                      d={strail.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ")}
                      fill="none" stroke={color} strokeWidth="0.8" strokeDasharray="2 2" opacity="0.55"
                    />
                    {strail.slice(-6).map((p, i) => (
                      <circle key={i} cx={p.x} cy={p.y} r={0.8 + i * 0.25} fill={color} opacity={0.15 + i * 0.12} />
                    ))}
                  </g>
                )}
                <ShotGlyph wtype={s.wtype} color={color} angleDeg={angleDeg} px={px} py={py} />
                <text
                  x={px} y={py - 9}
                  fill={color}
                  fontSize="6.5"
                  fontFamily="JetBrains Mono"
                  textAnchor="middle"
                  style={{ paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: 1.8 }}
                >
                  {s.acronym}
                </text>
              </g>
            );
          })}

          {/* Contacts */}
          {filtered.map((c) => {
            const rawCr = (c.range_nm ?? 0) * scale;
            const cr = Math.min(rawCr, 195);
            const a = ((c.bearing ?? 0) * Math.PI) / 180;
            const x = 200 + cr * Math.sin(a);
            const y = 200 - cr * Math.cos(a);
            const meta = CLASSIFICATION_META[c.classification];
            const selected = c.id === selectedId;
            const color = `hsl(var(--${meta.color}))`;
            // Velocity vector (leader line) — length proportional to speed
            const spd = c.speed_kts ?? 0;
            const hd = ((c.heading ?? 0) * Math.PI) / 180;
            const vecLen = Math.min(28, spd / 8); // px
            const vx = x + vecLen * Math.sin(hd);
            const vy = y - vecLen * Math.cos(hd);
            const labelOffsetX = x > 200 ? 12 : -12;
            const labelAnchor = x > 200 ? "start" : "end";
            return (
              <g key={c.id} onClick={() => onSelect?.(c.id)} style={{ cursor: "pointer" }}>
                {selected && <circle cx={x} cy={y} r="14" fill="none" stroke={color} strokeWidth="1" opacity="0.7" />}
                {/* Heading vector */}
                {spd > 0 && (
                  <line x1={x} y1={y} x2={vx} y2={vy} stroke={color} strokeWidth="1" opacity="0.85" />
                )}
                <text
                  x={x} y={y + 4}
                  fill={color}
                  fontSize={c.classification === "hostile" ? 18 : 14}
                  fontFamily="JetBrains Mono"
                  fontWeight="bold"
                  textAnchor="middle"
                  style={c.classification === "hostile" ? { filter: `drop-shadow(0 0 4px ${color})` } : undefined}
                  className={c.classification === "hostile" ? "animate-pulse-threat" : ""}
                >
                  {meta.symbol}
                </text>
                {/* Data block: track_id / heading-speed / range */}
                <g
                  fontFamily="JetBrains Mono"
                  fontSize="6.5"
                  fill={color}
                  textAnchor={labelAnchor}
                  style={{ paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: 1.8 }}
                >
                  <text x={x + labelOffsetX} y={y - 6} fontWeight="bold">{c.track_id}</text>
                  <text x={x + labelOffsetX} y={y + 2} opacity="0.9">
                    {String(Math.round(c.heading ?? 0)).padStart(3, "0")}° · {Math.round(spd)}kt
                  </text>
                  <text x={x + labelOffsetX} y={y + 10} opacity="0.85">
                    {(c.range_nm ?? 0).toFixed(1)}nm
                  </text>
                </g>
              </g>
            );
          })}
        </svg>

        {/* HUD overlay corners */}
        <div className="absolute top-2 left-3 hud-label">PPI · {ownName}</div>
        <div className="absolute top-2 right-3 hud-label glow-cyan">RNG {rangeNm}NM</div>
        <div className="absolute bottom-2 left-3 hud-label">CONTACTS: <span className="hud-value text-primary">{filtered.length}</span></div>
        <div className="absolute bottom-2 right-3 hud-label">MODE: <span className="text-primary">AUTO</span></div>
      </div>
    </div>
  );
}
