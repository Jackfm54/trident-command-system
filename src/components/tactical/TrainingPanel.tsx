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
  return (
    <div className="hud-panel p-3 space-y-2">
      <h3 className="font-display text-xs text-primary uppercase tracking-wider">Modo Entrenamiento</h3>
      {sunk && (
        <div className="border border-destructive bg-destructive/20 p-2 text-center font-mono text-[11px] text-destructive animate-blink-alert">
          ☠ BUQUE HUNDIDO · EJERCICIO DETENIDO
        </div>
      )}
      <Button size="sm" disabled={!running || (sunk && !training)} variant={training ? "destructive" : "default"} className="w-full font-mono text-xs" onClick={onToggleTraining}>
        <Swords className="w-3.5 h-3.5 mr-1" /> {training ? "Detener entrenamiento" : sunk ? "Repare para reiniciar" : "Iniciar ataque"}
      </Button>
      {!running && <p className="text-[10px] font-mono text-muted-foreground">Active un escenario primero.</p>}
      <Button size="sm" variant={autoDefense ? "default" : "outline"} className="w-full font-mono text-xs" onClick={onToggleAuto}>
        <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Defensa auto {autoDefense ? "ON" : "OFF"}
      </Button>
      <p className="text-[10px] font-mono text-muted-foreground">La defensa automática solo dispara en COND I (rojo).</p>
      <div className="font-mono text-[10px] uppercase text-muted-foreground">Intensidad</div>
      <div className="grid grid-cols-3 gap-1">
        {[1, 2, 4].map((d, i) => (
          <button key={d} onClick={() => onDifficulty(d)} className={`text-[10px] font-mono rounded py-1 border border-border ${difficulty === d ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
            {["Baja", "Media", "Alta"][i]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1 text-center font-mono">
        <div><div className="text-threat-friend text-sm">{stats.kills}</div><div className="text-[9px] text-muted-foreground">Derribos</div></div>
        <div><div className="text-threat-hostile text-sm">{stats.impacts}</div><div className="text-[9px] text-muted-foreground">Impactos</div></div>
        <div><div className="text-accent text-sm">{stats.waves}</div><div className="text-[9px] text-muted-foreground">Oleadas</div></div>
      </div>
      <Button size="sm" variant="outline" className="w-full font-mono text-xs" onClick={onRearm}>
        <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reabastecer y reparar
      </Button>
    </div>
  );
}
