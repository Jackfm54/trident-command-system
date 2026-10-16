import { t, translateText, locale, useLanguage } from "@/lib/i18n";
import { Contact, CLASSIFICATION_META, DOMAIN_META } from "@/types/tactical";
import { Button } from "@/components/ui/button";
import { Brain, Loader2 } from "lucide-react";

interface Props {
  contacts: Contact[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClassify: (c: Contact) => void;
  classifyingId: string | null;
}

export function ContactList({ contacts, selectedId, onSelect, onClassify, classifyingId }: Props) {
  useLanguage();
  return (
    <div className="hud-panel p-3 h-full flex flex-col">
       {t("")} <div className="flex items-center justify-between mb-2">
         {t("")} <span className="hud-label">{t("Track Manager ·")} {contacts.length}</span>
         {t("")} <span className="hud-label glow-cyan animate-flicker">{t("LIVE")}</span>
       {t("")} </div>
       {t("")} <div className="overflow-y-auto flex-1 space-y-1 pr-1">
         {t("")} {contacts.length === 0 && (
          <div className="text-muted-foreground text-sm font-mono p-4 text-center">
             {t("Sin contactos. Cargue un escenario para iniciar simulación.")} </div>
        )}
         {t("")} {contacts.map((c) => {
          const meta = CLASSIFICATION_META[c.classification];
          const dom = DOMAIN_META[c.domain];
          const sel = c.id === selectedId;
          return (
            <div
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={`relative border-l-2 px-2 py-1.5 cursor-pointer transition-colors font-mono text-xs ${
                sel ? "bg-accent/10 border-l-accent" : "border-l-transparent hover:bg-secondary/40"
              }`}
              style={{ borderLeftColor: sel ? undefined : `hsl(var(--${meta.color}))` }}
            >
               {t("")} <div className="flex items-center justify-between">
                 {t("")} <div className="flex items-center gap-2">
                   {t("")} <span style={{ color: `hsl(var(--${meta.color}))` }} className="text-base font-bold">
                     {t("")} {meta.symbol}
                   {t("")} </span>
                   {t("")} <span className="text-foreground">{c.track_id}</span>
                   {t("")} <span className="text-[9px] uppercase px-1 py-0.5 border" style={{ color: `hsl(var(--${dom.color}))`, borderColor: `hsl(var(--${dom.color}) / 0.4)` }}>
                     {t("")} {dom.abbr}
                   {t("")} </span>
                 {t("")} </div>
                 {t("")} <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClassify(c);
                  }}
                  disabled={classifyingId === c.id}
                  className="text-accent hover:text-accent-foreground hover:bg-accent/20 p-1 rounded transition-colors disabled:opacity-50"
                  title={t("Clasificar con IA")}
                >
                   {t("")} {classifyingId === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
                 {t("")} </button>
               {t("")} </div>
               {t("")} <div className="grid grid-cols-3 gap-1 mt-1 text-[10px] text-muted-foreground">
                 {t("")} <span>BRG <span className="text-foreground">{Math.round(c.bearing ?? 0)}°</span></span>
                 {t("")} <span>RNG <span className="text-foreground">{(c.range_nm ?? 0).toFixed(1)}</span></span>
                 {t("")} <span>SPD <span className="text-foreground">{Math.round(c.speed_kts ?? 0)}</span></span>
               {t("")} </div>
               {t("")} {c.platform_type && (
                <div className="text-[10px] text-muted-foreground mt-0.5">
                   {t("")} {translateText(c.platform_type)}  {t("")} {c.ai_confidence ? `· conf ${(c.ai_confidence * 100).toFixed(0)}%` : t("")}
                 {t("")} </div>
              )}
             {t("")} </div>
          );
        })}
       {t("")} </div>
     {t("")} </div>
  );
}
