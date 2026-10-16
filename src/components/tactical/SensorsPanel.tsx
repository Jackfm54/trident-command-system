import { t as tr, translateText, locale, useLanguage } from "@/lib/i18n";
import { Sensor } from "@/lib/combatSystems";
import { Radar, Eye, Radio, Waves, Antenna, Wifi } from "lucide-react";

const ICONS = {
  radar: Radar,
  eo_ir: Eye,
  esm: Antenna,
  sonar: Waves,
  datalink: Wifi,
} as const;

const STATUS_COLOR = {
  online: "text-threat-friend",
  standby: "text-accent",
  degraded: "text-primary",
  offline: "text-destructive",
};

interface Props {
  sensors: Sensor[];
  onToggle: (id: string) => void;
}

export function SensorsPanel({ sensors, onToggle }: Props) {
  useLanguage();
  return (
    <div className="hud-panel p-3 space-y-1.5">
       <div className="flex items-center justify-between mb-1">
         <span className="hud-label">{tr("Sensores · Fusión Multi-Dominio")}</span>
         <span className="hud-label glow-cyan animate-flicker">RX</span>
       </div>
       {sensors.map((s) => {
        const Icon = ICONS[s.type as keyof typeof ICONS] ?? Radio;
        return (
          <button
            key={s.id}
            onClick={() => onToggle(s.id)}
            className="w-full text-left border border-border/60 hover:border-accent/60 transition-colors p-1.5 flex items-center gap-2 group"
            title={translateText(s.description)}
          >
             <Icon className={`w-4 h-4 ${STATUS_COLOR[s.status]}`} />
             <div className="flex-1 min-w-0">
               <div className="flex items-center justify-between font-mono text-[11px]">
                 <span className="text-foreground truncate">{s.acronym}</span>
                 <span className={`text-[9px] uppercase ${STATUS_COLOR[s.status]}`}>{translateText(s.status)}</span>
               </div>
               <div className="text-[9px] font-mono text-muted-foreground flex justify-between">
                 <span className="truncate">{translateText(s.mode)}</span>
                 <span>{s.range_nm}nm</span>
               </div>
             </div>
           </button>
        );
      })}
     </div>
  );
}
