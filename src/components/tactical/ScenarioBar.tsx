import { Scenario } from "@/types/tactical";
import { Button } from "@/components/ui/button";
import { Play, Square, Plus } from "lucide-react";

interface Props {
  scenarios: Scenario[];
  activeId: string | null;
  onActivate: (id: string) => void;
  onStop: () => void;
  onAddContact: () => void;
  running: boolean;
}

export function ScenarioBar({ scenarios, activeId, onActivate, onStop, onAddContact, running }: Props) {
  return (
    <div className="hud-panel p-3 flex flex-wrap items-center gap-2">
      <span className="hud-label mr-2">Escenarios</span>
      {scenarios.map((s) => {
        const active = s.id === activeId;
        return (
          <button
            key={s.id}
            onClick={() => onActivate(s.id)}
            className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider border transition-all ${
              active
                ? "bg-primary text-primary-foreground border-primary shadow-glow-amber"
                : "border-border text-foreground hover:border-accent hover:text-accent"
            }`}
          >
            {s.name}
          </button>
        );
      })}
      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onAddContact} disabled={!activeId} className="font-mono uppercase">
          <Plus className="w-3 h-3 mr-1" /> Contacto
        </Button>
        {running ? (
          <Button variant="destructive" size="sm" onClick={onStop} className="font-mono uppercase">
            <Square className="w-3 h-3 mr-1" /> Parar
          </Button>
        ) : (
          <span className="text-xs font-mono text-muted-foreground">Seleccione escenario</span>
        )}
      </div>
    </div>
  );
}
