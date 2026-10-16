import { t as tr, translateText, locale, useLanguage } from "@/lib/i18n";
import { Weapon } from "@/lib/combatSystems";
import { Domain, DOMAIN_META } from "@/types/tactical";
import { Rocket, Crosshair, Bomb, Zap, Shield, Target } from "lucide-react";

const ICON: Record<Weapon["type"], React.ComponentType<{ className?: string }>> = {
  missile: Rocket,
  gun: Crosshair,
  torpedo: Target,
  ciws: Shield,
  decoy: Shield,
  ew: Zap,
  rocket: Bomb,
};

interface Props {
  weapons: Weapon[];
  filter?: Domain | "all";
  onSelect?: (w: Weapon) => void;
}

export function WeaponsPanel({ weapons, filter = "all", onSelect }: Props) {
  useLanguage();
  const list = filter === "all" ? weapons : weapons.filter((w) => w.domain === filter);
  return (
    <div className="hud-panel p-3 space-y-1.5">
       <div className="flex items-center justify-between mb-1">
         <span className="hud-label">{tr("Arsenal · Magazines")}</span>
         <span className="hud-label glow-amber">{tr("SAFE")}</span>
       </div>
       {list.map((w) => {
        const Icon = ICON[w.type];
        const dom = DOMAIN_META[w.domain];
        const pct = (w.ammo / w.max_ammo) * 100;
        const low = pct < 30;
        const empty = w.ammo === 0;
        return (
          <button
            key={w.id}
            disabled={!onSelect || empty}
            onClick={() => onSelect?.(w)}
            className="w-full text-left border border-border/60 hover:border-primary/70 disabled:opacity-50 disabled:cursor-not-allowed transition-colors p-1.5"
            title={translateText(w.description)}
          >
             <div className="flex items-center gap-2">
               <Icon className="w-4 h-4 text-primary" />
               <div className="flex-1 min-w-0">
                 <div className="flex items-center justify-between font-mono text-[11px]">
                   <span className="text-foreground truncate">{w.acronym}</span>
                   <span className={`tabular-nums ${empty ? "text-destructive" : low ? "text-primary" : "text-foreground"}`}>
                     {w.ammo}/{w.max_ammo}
                   </span>
                 </div>
                 <div className="text-[9px] font-mono text-muted-foreground flex justify-between">
                   <span style={{ color: `hsl(var(--${dom.color}))` }}>{dom.abbr}</span>
                   <span>{w.range_nm}nm · pk {Math.round(w.pk * 100)}%</span>
                 </div>
                 <div className="h-0.5 bg-secondary mt-1">
                   <div
                    className={`h-full ${empty ? "bg-destructive" : low ? "bg-primary" : "bg-threat-friend"}`}
                    style={{ width: `${pct}%` }}
                  />
                 </div>
               </div>
             </div>
           </button>
        );
      })}
     </div>
  );
}
