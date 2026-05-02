import { Contact, CLASSIFICATION_META, DOMAIN_META } from "@/types/tactical";
import { Button } from "@/components/ui/button";
import { Crosshair, Shield, Zap } from "lucide-react";

interface Props {
  contact: Contact | null;
  onEngage?: (c: Contact) => void;
}

export function ContactDetail({ contact, onEngage }: Props) {
  if (!contact) {
    return (
      <div className="hud-panel p-4 h-full flex items-center justify-center text-muted-foreground font-mono text-xs">
        Seleccione un track del PPI o de la lista
      </div>
    );
  }
  const meta = CLASSIFICATION_META[contact.classification];
  const dom = DOMAIN_META[contact.domain];

  return (
    <div className="hud-panel p-3 h-full flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="hud-label">Track Detail</span>
        <span className="text-xs font-mono px-2 py-0.5 border" style={{ color: `hsl(var(--${dom.color}))`, borderColor: `hsl(var(--${dom.color}) / 0.5)` }}>
          {dom.abbr} · {dom.label}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-3xl font-bold" style={{ color: `hsl(var(--${meta.color}))`, textShadow: `0 0 12px hsl(var(--${meta.color}) / 0.6)` }}>
          {meta.symbol}
        </span>
        <div>
          <div className="font-display text-lg text-foreground">{contact.track_id}</div>
          <div className="text-[10px] uppercase tracking-widest" style={{ color: `hsl(var(--${meta.color}))` }}>
            {meta.label} {contact.platform_type && `· ${contact.platform_type}`}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 font-mono text-xs">
        {[
          ["BRG", `${Math.round(contact.bearing ?? 0)}°`],
          ["RNG", `${(contact.range_nm ?? 0).toFixed(1)} nm`],
          ["SPD", `${Math.round(contact.speed_kts ?? 0)} kts`],
          ["HDG", `${Math.round(contact.heading ?? 0)}°`],
          ["ALT", contact.altitude_ft ? `${Math.round(contact.altitude_ft)} ft` : "—"],
          ["CONF", contact.ai_confidence ? `${(contact.ai_confidence * 100).toFixed(0)}%` : "—"],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between border-b border-border/30 py-1">
            <span className="text-muted-foreground">{k}</span>
            <span className="text-foreground">{v}</span>
          </div>
        ))}
      </div>
      {contact.ai_reasoning && (
        <div className="border border-accent/40 bg-accent/5 p-2 text-[11px] font-mono text-accent/90">
          <div className="hud-label mb-1">IA · LLAMA+YOLO</div>
          {contact.ai_reasoning}
        </div>
      )}
      <div className="mt-auto grid grid-cols-3 gap-1">
        <Button variant="outline" size="sm" className="font-mono text-[10px]"><Shield className="w-3 h-3 mr-1"/>SHADOW</Button>
        <Button variant="outline" size="sm" className="font-mono text-[10px]"><Zap className="w-3 h-3 mr-1"/>JAM</Button>
        <Button
          variant="destructive"
          size="sm"
          disabled={contact.classification !== "hostile"}
          onClick={() => onEngage?.(contact)}
          className="font-mono text-[10px]"
        >
          <Crosshair className="w-3 h-3 mr-1"/>ENGAGE
        </Button>
      </div>
    </div>
  );
}
