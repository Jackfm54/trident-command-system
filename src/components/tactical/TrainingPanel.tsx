import { t, translateText, locale, useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Swords, ShieldCheck, RotateCcw } from "lucide-react";

interface Props {
  training: boolean;
  autoDefense: boolean;
  difficulty: number;
  stats: { kills: number; impacts: number; waves: number };
  running: boolean;
  sunk?: boolean;
  onToggleTraining: () => void;
  onToggleAuto: () => void;
  onDifficulty: (d: number) => void;
  onRearm: () => void;
}

export function TrainingPanel({ training, autoDefense, difficulty, stats, running, sunk, onToggleTraining, onToggleAuto, onDifficulty, onRearm }: Props) {
  useLanguage();
  return (
    <div className="hud-panel p-3 space-y-2">
       {t("")} <h3 className="font-display text-xs text-primary uppercase tracking-wider">{t("Modo Entrenamiento")}</h3>
       {t("")} {sunk && (
        <div className="border border-destructive bg-destructive/20 p-2 text-center font-mono text-[11px] text-destructive animate-blink-alert">
           {t("☠ BUQUE HUNDIDO · EJERCICIO DETENIDO")} </div>
      )}
       {t("")} <Button size="sm" disabled={!running || (sunk && !training)} variant={training ? "destructive" : "default"} className="w-full font-mono text-xs" onClick={onToggleTraining}>
         {t("")} <Swords className="w-3.5 h-3.5 mr-1" />  {t("")} {training ? t("Detener entrenamiento") : sunk ? t("Repare para reiniciar") : t("Iniciar ataque")}
       {t("")} </Button>
       {t("")} {!running && <p className="text-[10px] font-mono text-muted-foreground">{t("Active un escenario primero.")}</p>}
       {t("")} <Button size="sm" variant={autoDefense ? "default" : "outline"} className="w-full font-mono text-xs" onClick={onToggleAuto}>
         {t("")} <ShieldCheck className="w-3.5 h-3.5 mr-1" />  {t("Defensa auto")} {autoDefense ? "ON" : "OFF"}
       {t("")} </Button>
       {t("")} <p className="text-[10px] font-mono text-muted-foreground">{t("La defensa automática solo dispara en COND I (rojo).")}</p>
       {t("")} <div className="font-mono text-[10px] uppercase text-muted-foreground">{t("Intensidad")}</div>
       {t("")} <div className="grid grid-cols-3 gap-1">
         {t("")} {[1, 2, 4].map((d, i) => (
          <button key={d} onClick={() => onDifficulty(d)} className={`text-[10px] font-mono rounded py-1 border border-border ${difficulty === d ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
             {t("")} {[t("Baja"), t("Media"), t("Alta")][i]}
           {t("")} </button>
        ))}
       {t("")} </div>
       {t("")} <div className="grid grid-cols-3 gap-1 text-center font-mono">
         {t("")} <div><div className="text-threat-friend text-sm">{stats.kills}</div><div className="text-[9px] text-muted-foreground">{t("Derribos")}</div></div>
         {t("")} <div><div className="text-threat-hostile text-sm">{stats.impacts}</div><div className="text-[9px] text-muted-foreground">{t("Impactos")}</div></div>
         {t("")} <div><div className="text-accent text-sm">{stats.waves}</div><div className="text-[9px] text-muted-foreground">{t("Oleadas")}</div></div>
       {t("")} </div>
       {t("")} <Button size="sm" variant="outline" className="w-full font-mono text-xs" onClick={onRearm}>
         {t("")} <RotateCcw className="w-3.5 h-3.5 mr-1" />  {t("Reabastecer y reparar")} </Button>
     {t("")} </div>
  );
}
