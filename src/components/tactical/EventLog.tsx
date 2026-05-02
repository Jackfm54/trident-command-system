import { TacticalEvent } from "@/types/tactical";

interface Props { events: TacticalEvent[]; }

const sevColor: Record<string, string> = {
  info: "text-accent",
  warning: "text-primary",
  critical: "text-destructive",
};

export function EventLog({ events }: Props) {
  return (
    <div className="hud-panel p-3 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <span className="hud-label">Bitácora Táctica</span>
        <span className="hud-label glow-cyan">CIC LOG</span>
      </div>
      <div className="overflow-y-auto flex-1 space-y-0.5 font-mono text-[11px]">
        {events.length === 0 && <div className="text-muted-foreground p-4 text-center">Sin eventos.</div>}
        {events.map((e) => (
          <div key={e.id} className="flex gap-2 border-b border-border/30 py-1">
            <span className="text-muted-foreground shrink-0">
              {new Date(e.created_at).toLocaleTimeString("es-CO", { hour12: false })}
            </span>
            <span className={`shrink-0 uppercase text-[9px] mt-0.5 ${sevColor[e.severity] ?? "text-muted-foreground"}`}>
              [{e.event_type}]
            </span>
            <span className={`flex-1 ${sevColor[e.severity] ?? "text-foreground"}`}>{e.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
