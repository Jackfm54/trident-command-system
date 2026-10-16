import { t, translateText, locale, useLanguage } from "@/lib/i18n";
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

function Bar({ label, value, icon: Icon }: { label: string; value: number; icon: React.ComponentType<{ className?: string }> }) {
  useLanguage();
  const color = value > 70 ? "bg-threat-friend" : value > 40 ? "bg-primary" : "bg-destructive";
  return (
    <div className="space-y-0.5">
       {t("")} <div className="flex items-center justify-between font-mono text-[10px]">
         {t("")} <span className="flex items-center gap-1 text-muted-foreground uppercase tracking-wider">
           {t("")} <Icon className="w-3 h-3" />
           {t("")} {label}
         {t("")} </span>
         {t("")} <span className="text-foreground tabular-nums">{Math.round(value)}%</span>
       {t("")} </div>
       {t("")} <div className="h-1 bg-secondary">
         {t("")} <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
       {t("")} </div>
     {t("")} </div>
  );
}

export function ShipStatusPanel({ ship, onAlertChange }: Props) {
  useLanguage();
  return (
    <div className="hud-panel p-3 space-y-2">
       {t("")} <div className="flex items-center justify-between">
         {t("")} <span className="hud-label">{t("ARC-FRAGATA · Estado")}</span>
         {t("")} <span className="hud-label glow-cyan">CMS {t(ship.cms_status).toUpperCase()}</span>
       {t("")} </div>
       {t("")} <Bar label={t("Casco")} value={ship.hull_integrity} icon={Heart} />
       {t("")} <Bar label={t("Propulsión")} value={ship.propulsion} icon={Anchor} />
       {t("")} <Bar label={t("Energía")} value={ship.power} icon={Battery} />
       {t("")} <div className="pt-1 border-t border-border/40">
         {t("")} <div className="hud-label mb-1 flex items-center gap-1"><Cpu className="w-3 h-3" />  {t("Battle Stations")}</div>
         {t("")} <div className="grid grid-cols-3 gap-1">
           {t("")} {([t("white"), t("yellow"), t("red")] as const).map((lvl) => (
            <button
              key={lvl}
              onClick={() => onAlertChange(lvl)}
              className={`text-[10px] font-mono uppercase py-1 border transition-all ${
                ship.alert_level === lvl ? ALERT_BG[lvl] + " border-transparent" : "border-border text-muted-foreground hover:border-foreground"
              }`}
            >
              COND {lvl === "white" ? "III" : lvl === "yellow" ? "II" : "I"}
             {t("")} </button>
          ))}
         {t("")} </div>
       {t("")} </div>
     {t("")} </div>
  );
}
