import { t, translateText, locale, useLanguage } from "@/lib/i18n";
import { Scenario } from "@/types/tactical";
import { Button } from "@/components/ui/button";
import { Square, Plus, Brain } from "lucide-react";

interface Props {
  scenarios: Scenario[];
  activeId: string | null;
  onActivate: (id: string) => void;
  onStop: () => void;
  onAddContact: () => void;
  onClassifyAll: () => void;
  running: boolean;
}

export function ScenarioBar({ scenarios, activeId, onActivate, onStop, onAddContact, onClassifyAll, running }: Props) {
  useLanguage();
  return (
    <div className="hud-panel p-3 flex flex-wrap items-center gap-2">
       {t("")} <span className="hud-label mr-2">{t("Escenarios")}</span>
       {t("")} {scenarios.map((s) => {
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
             {t("")} {s.name}
           {t("")} </button>
        );
      })}
       {t("")} <div className="ml-auto flex items-center gap-2">
         {t("")} <Button variant="outline" size="sm" onClick={onAddContact} disabled={!activeId} className="font-mono uppercase">
           {t("")} <Plus className="w-3 h-3 mr-1" />  {t("Contacto")} </Button>
         {t("")} <Button variant="outline" size="sm" onClick={onClassifyAll} disabled={!activeId} className="font-mono uppercase border-accent/60 text-accent hover:bg-accent/10">
           {t("")} <Brain className="w-3 h-3 mr-1" />  {t("IA Auto")} </Button>
         {t("")} {running ? (
          <Button variant="destructive" size="sm" onClick={onStop} className="font-mono uppercase">
             {t("")} <Square className="w-3 h-3 mr-1" />  {t("Parar")} </Button>
        ) : (
          <span className="text-xs font-mono text-muted-foreground">{t("Seleccione escenario")}</span>
        )}
       {t("")} </div>
     {t("")} </div>
  );
}
