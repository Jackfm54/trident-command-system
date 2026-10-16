import { t as tr, translateText, useLanguage } from "@/lib/i18n";
import { Contact, Domain, DOMAIN_META } from "@/types/tactical";

interface Props {
  contacts: Contact[];
}

export function DomainStatus({ contacts }: Props) {
  useLanguage();
  const counts: Record<Domain, { total: number; hostile: number }> = {
    air: { total: 0, hostile: 0 },
    surface: { total: 0, hostile: 0 },
    subsurface: { total: 0, hostile: 0 },
    electronic: { total: 0, hostile: 0 },
  };
  contacts.forEach((c) => {
    counts[c.domain].total++;
    if (c.classification === "hostile") counts[c.domain].hostile++;
  });

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      {(Object.keys(counts) as Domain[]).map((d) => {
        const meta = DOMAIN_META[d];
        const c = counts[d];
        const alert = c.hostile > 0;
        return (
          <div
            key={d}
            className={`hud-panel p-2 ${alert ? "shadow-glow-red" : ""}`}
            style={{ borderColor: `hsl(var(--${meta.color}) / 0.5)` }}
          >
            <div className="flex items-center justify-between">
              <span
                className="hud-label"
                style={{ color: `hsl(var(--${meta.color}))` }}
              >
                {meta.abbr}
              </span>
              {alert && (
                <span className="text-destructive text-[10px] font-mono animate-blink-alert">
                  {tr("⚠ ALERT")}
                </span>
              )}
            </div>
            <div
              className="font-display text-2xl"
              style={{ color: `hsl(var(--${meta.color}))` }}
            >
              {c.total.toString().padStart(2, "0")}
            </div>
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              {translateText(meta.label)} ·{" "}
              <span className="text-destructive">
                {c.hostile} {tr("hostil")}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
