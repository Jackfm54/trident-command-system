import { t, translateText, locale, useLanguage } from "@/lib/i18n";
import { TacticalEvent } from "@/types/tactical";
import { Printer } from "lucide-react";

interface Props { events: TacticalEvent[]; title?: string; }

const sevColor: Record<string, string> = {
  info: "text-accent",
  warning: "text-primary",
  critical: "text-destructive",
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

export function EventLog({ events, title = "SISTEMA TCM POSEIDÓN" }: Props) {
  useLanguage();
  const print = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    const rows = [...events].reverse().map((e) => `<tr class="${e.severity}"><td>${new Date(e.created_at).toLocaleString(locale(), { hour12: false })}</td><td>${esc(e.domain ?? "")}</td><td>${esc(e.event_type)}</td><td>${esc(e.severity)}</td><td>${esc(e.message)}</td></tr>`).join("");
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Bitácora Táctica</title><style>
      body{font-family:monospace;font-size:11px;margin:16px;color:#111}
      h1{font-size:16px;margin:0}p{margin:2px 0 12px;color:#555}
      table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:4px;text-align:left;vertical-align:top}
      th{background:#eee}tr{break-inside:avoid}.critical td{color:#b00}.warning td{color:#a60}
      @page{size:A4;margin:12mm}
    </style></head><body><h1>${esc(title)} · BITÁCORA TÁCTICA (CIC LOG)</h1>
    <p>Impreso: ${new Date().toLocaleString(locale(), { hour12: false })} · ${events.length} eventos</p>
    <table><thead><tr><th>Hora</th><th>Dominio</th><th>Tipo</th><th>Severidad</th><th>Mensaje</th></tr></thead><tbody>${rows || '<tr><td colspan="5">Sin eventos</td></tr>'}</tbody></table>
    <script>window.onload=()=>{window.print()}</script></body></html>`);
    w.document.close();
  };

  return (
    <div className="hud-panel p-3 h-full flex flex-col">
       {t("")} <div className="flex items-center justify-between mb-2">
         {t("")} <span className="hud-label">{t("Bitácora Táctica")}</span>
         {t("")} <div className="flex items-center gap-2">
           {t("")} <button onClick={print} title={t("Imprimir bitácora")} className="flex items-center gap-1 text-[10px] font-mono uppercase text-accent hover:text-primary border border-border rounded px-2 py-0.5">
             {t("")} <Printer className="w-3 h-3" />  {t("Imprimir")} </button>
           {t("")} <span className="hud-label glow-cyan">{t("CIC LOG")}</span>
         {t("")} </div>
       {t("")} </div>
       {t("")} <div className="overflow-y-auto flex-1 space-y-0.5 font-mono text-[11px]">
         {t("")} {events.length === 0 && <div className="text-muted-foreground p-4 text-center">{t("Sin eventos.")}</div>}
         {t("")} {events.map((e) => (
          <div key={e.id} className="flex gap-2 border-b border-border/30 py-1">
             {t("")} <span className="text-muted-foreground shrink-0">
               {t("")} {new Date(e.created_at).toLocaleTimeString(locale(), { hour12: false })}
             {t("")} </span>
             {t("")} <span className={`shrink-0 uppercase text-[9px] mt-0.5 ${sevColor[e.severity] ?? "text-muted-foreground"}`}>
              [{translateText(e.event_type)}]
            </span>
             {t("")} <span className={`flex-1 ${sevColor[e.severity] ?? "text-foreground"}`}>{translateText(e.message)}</span>
           {t("")} </div>
        ))}
       {t("")} </div>
     {t("")} </div>
  );
}
