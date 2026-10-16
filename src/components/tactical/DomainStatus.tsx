import { t, translateText, locale, useLanguage } from "@/lib/i18n";
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
       {t("")} {(Object.keys(counts) as Domain[]).map((d) => {
        const meta = DOMAIN_META[d];
        const c = counts[d];
        const alert = c.hostile > 0;
        return (
          <div
            key={d}
            className={`hud-panel p-2 ${alert ? "shadow-glow-red" : t("")}`}
            style={{ borderColor: `hsl(var(--${meta.color}) / 0.5)` }}
          >
             {t("")} <div className="flex items-center justify-between">
               {t("")} <span className="hud-label" style={{ color: `hsl(var(--${meta.color}))` }}>{meta.abbr}</span>
               {t("")} {alert && <span className="text-destructive text-[10px] font-mono animate-blink-alert">{t("⚠ ALERT")}</span>}
             {t("")} </div>
             {t("")} <div className="font-display text-2xl" style={{ color: `hsl(var(--${meta.color}))` }}>
               {t("")} {c.total.toString().padStart(2, "0")}
             {t("")} </div>
             {t("")} <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
               {t("")} {translateText(meta.label)} · <span className="text-destructive">{c.hostile}  {t("hostil")}</span>
             {t("")} </div>
           {t("")} </div>
        );
      })}
     {t("")} </div>
  );
}
