import { useMemo } from "react";
import { Contact, CLASSIFICATION_META } from "@/types/tactical";
import { Weapon } from "@/lib/combatSystems";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crosshair, Rocket } from "lucide-react";

interface Props {
  open: boolean;
  contact: Contact | null;
  weapons: Weapon[];
  onClose: () => void;
  onFire: (w: Weapon, c: Contact) => void;
}

export function EngagementDialog({ open, contact, weapons, onClose, onFire }: Props) {
  const recommended = useMemo(() => {
    if (!contact) return null;
    const valid = weapons.filter((w) => w.domain === contact.domain && w.ammo > 0 && (contact.range_nm ?? 0) <= w.range_nm);
    if (valid.length === 0) return null;
    // pick best pk * range fit
    return valid.sort((a, b) => b.pk * (1 - Math.abs((contact.range_nm ?? 0) - a.range_nm * 0.6) / a.range_nm) - a.pk)[0];
  }, [weapons, contact]);

  if (!contact) return null;
  const meta = CLASSIFICATION_META[contact.classification];
  const valid = weapons.filter((w) => w.domain === contact.domain);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="hud-panel max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display text-primary glow-amber flex items-center gap-2">
            <Crosshair className="w-5 h-5" />
            TEWA · Asignación de Arma
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">
            Track <span style={{ color: `hsl(var(--${meta.color}))` }}>{contact.track_id}</span> · {contact.platform_type ?? "?"} ·
            BRG {Math.round(contact.bearing ?? 0)}° / RNG {(contact.range_nm ?? 0).toFixed(1)}nm / SPD {Math.round(contact.speed_kts ?? 0)}kts
          </DialogDescription>
        </DialogHeader>

        {recommended && (
          <div className="border border-accent/60 bg-accent/10 p-2 font-mono text-xs">
            <div className="hud-label mb-1">TEWA Recomienda</div>
            <span className="text-accent">{recommended.acronym}</span> · pk {Math.round(recommended.pk * 100)}% · ToF {(((contact.range_nm ?? 0) / Math.max(1, recommended.speed_kts)) * 3600).toFixed(1)}s
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[400px] overflow-y-auto">
          {valid.map((w) => {
            const inRange = (contact.range_nm ?? 0) <= w.range_nm;
            const empty = w.ammo === 0;
            const tof = ((contact.range_nm ?? 0) / Math.max(1, w.speed_kts)) * 3600;
            return (
              <button
                key={w.id}
                onClick={() => inRange && !empty && onFire(w, contact)}
                disabled={!inRange || empty}
                className={`text-left border p-2 transition-all font-mono text-xs ${
                  recommended?.id === w.id
                    ? "border-accent shadow-glow-cyan"
                    : "border-border hover:border-primary"
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-primary font-bold flex items-center gap-1">
                    <Rocket className="w-3 h-3" /> {w.acronym}
                  </span>
                  <span className="text-foreground">{w.ammo}/{w.max_ammo}</span>
                </div>
                <div className="text-muted-foreground text-[10px]">{w.name}</div>
                <div className="grid grid-cols-3 gap-1 mt-1 text-[10px]">
                  <span>RNG <span className={inRange ? "text-threat-friend" : "text-destructive"}>{w.range_nm}nm</span></span>
                  <span>PK <span className="text-foreground">{Math.round(w.pk * 100)}%</span></span>
                  <span>ToF <span className="text-foreground">{tof < 600 ? tof.toFixed(0) + "s" : "—"}</span></span>
                </div>
                {!inRange && <div className="text-[9px] text-destructive mt-1">FUERA DE ALCANCE</div>}
                {empty && <div className="text-[9px] text-destructive mt-1">SIN MUNICIÓN</div>}
              </button>
            );
          })}
        </div>

        <Button variant="outline" onClick={onClose} className="font-mono uppercase">Cancelar</Button>
      </DialogContent>
    </Dialog>
  );
}
