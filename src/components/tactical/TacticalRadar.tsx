import { useEffect, useRef } from "react";
import { Contact, Domain, CLASSIFICATION_META } from "@/types/tactical";

interface Props {
  contacts: Contact[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  filterDomain?: Domain | "all";
}

export function TacticalRadar({ contacts, selectedId, onSelect, filterDomain = "all" }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const filtered = contacts.filter((c) => filterDomain === "all" || c.domain === filterDomain);

  return (
    <div ref={ref} className="hud-panel relative aspect-square w-full max-w-[640px] mx-auto bg-gradient-hud overflow-hidden">
      {/* Range rings */}
      <svg viewBox="0 0 400 400" className="absolute inset-0 w-full h-full">
        <defs>
          <radialGradient id="ringGrad">
            <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.05" />
            <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0.2" />
          </radialGradient>
        </defs>
        {[50, 100, 150, 195].map((r) => (
          <circle key={r} cx="200" cy="200" r={r} fill="none" stroke="hsl(var(--accent))" strokeOpacity="0.25" strokeWidth="0.5" />
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
        {[10, 20, 30, 40].map((nm, i) => (
          <text key={nm} x="202" y={200 - (i + 1) * 50 + 3} fill="hsl(var(--accent))" fontSize="8" fontFamily="JetBrains Mono" opacity="0.5">
            {nm}nm
          </text>
        ))}

        {/* Sweep */}
        <g style={{ transformOrigin: "200px 200px", animation: "radar-sweep 6s linear infinite" }}>
          <path d="M 200 200 L 200 5 A 195 195 0 0 1 333 95 Z" fill="url(#ringGrad)" opacity="0.6" />
        </g>

        {/* Own ship */}
        <g>
          <circle cx="200" cy="200" r="5" fill="hsl(var(--threat-friend))" />
          <circle cx="200" cy="200" r="9" fill="none" stroke="hsl(var(--threat-friend))" strokeWidth="1" />
          <text x="208" y="204" fill="hsl(var(--threat-friend))" fontSize="9" fontFamily="JetBrains Mono">ARC-FRIGATE</text>
        </g>

        {/* Contacts */}
        {filtered.map((c) => {
          const r = Math.min((c.range_nm ?? 0) * 4.5, 195);
          const a = ((c.bearing ?? 0) * Math.PI) / 180;
          const x = 200 + r * Math.sin(a);
          const y = 200 - r * Math.cos(a);
          const meta = CLASSIFICATION_META[c.classification];
          const selected = c.id === selectedId;
          const color = `hsl(var(--${meta.color}))`;
          return (
            <g key={c.id} onClick={() => onSelect?.(c.id)} style={{ cursor: "pointer" }}>
              {selected && <circle cx={x} cy={y} r="14" fill="none" stroke={color} strokeWidth="1" opacity="0.6" />}
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
              <text x={x + 10} y={y - 4} fill={color} fontSize="7" fontFamily="JetBrains Mono" opacity="0.85">
                {c.track_id}
              </text>
            </g>
          );
        })}
      </svg>

      {/* HUD overlay corners */}
      <div className="absolute top-2 left-3 hud-label">PPI · ARC-FRIGATA</div>
      <div className="absolute top-2 right-3 hud-label glow-cyan">RNG 40NM</div>
      <div className="absolute bottom-2 left-3 hud-label">CONTACTS: <span className="hud-value text-primary">{filtered.length}</span></div>
      <div className="absolute bottom-2 right-3 hud-label">MODE: <span className="text-primary">AUTO</span></div>
    </div>
  );
}
