import { t as tr, useLanguage } from "@/lib/i18n";
import { ShipSystem } from "@/lib/combatSystems";
import { Anchor, Battery, Cpu, Heart } from "lucide-react";

const ALERT_BG = {
  white: "bg-secondary text-foreground",
  yellow: "bg-primary text-primary-foreground shadow-glow-amber",
  red: "bg-destructive text-destructive-foreground shadow-glow-red animate-blink-alert",
};

interface Props {
  ship: ShipSystem;
  onAlertChange: (a: ShipSystem["alert_level"]) => void;
}

function Bar({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  useLanguage();
  const color =
    value > 70
      ? "bg-threat-friend"
      : value > 40
        ? "bg-primary"
        : "bg-destructive";
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between font-mono text-[10px]">
        <span className="flex items-center gap-1 text-muted-foreground uppercase tracking-wider">
          <Icon className="w-3 h-3" />
          {label}
        </span>
        <span className="text-foreground tabular-nums">
          {Math.round(value)}%
        </span>
      </div>
      <div className="h-1 bg-secondary">
        <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function ShipStatusPanel({ ship, onAlertChange }: Props) {
  useLanguage();
  return (
    <div className="hud-panel p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="hud-label">{tr("ARC-FRAGATA · Estado")}</span>
        <span className="hud-label glow-cyan">
          CMS {tr(ship.cms_status).toUpperCase()}
        </span>
      </div>
      <Bar label={tr("Casco")} value={ship.hull_integrity} icon={Heart} />
      <Bar label={tr("Propulsión")} value={ship.propulsion} icon={Anchor} />
      <Bar label={tr("Energía")} value={ship.power} icon={Battery} />
      <div className="pt-1 border-t border-border/40">
        <div className="hud-label mb-1 flex items-center gap-1">
          <Cpu className="w-3 h-3" /> {tr("Battle Stations")}
        </div>
        <div className="grid grid-cols-3 gap-1">
          {(["white", "yellow", "red"] as const).map((lvl) => (
            <button
              key={lvl}
              onClick={() => onAlertChange(lvl)}
              className={`text-[10px] font-mono uppercase py-1 border transition-all ${
                ship.alert_level === lvl
                  ? ALERT_BG[lvl] + " border-transparent"
                  : "border-border text-muted-foreground hover:border-foreground"
              }`}
            >
              COND {lvl === "white" ? "III" : lvl === "yellow" ? "II" : "I"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
