import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { THREATS, PLATFORM_LABEL, waveFromThreats } from "@/lib/combatEngine";
import { PLATFORM_BY_DOMAIN } from "@/lib/simulator";
import { DOMAIN_META, Domain } from "@/types/tactical";
import { Play, Square, Plus, Rocket, FileText, Printer, Monitor, LogOut, Trash2 } from "lucide-react";

type Exercise = { id: string; name: string; status: string; started_at: string | null; ended_at: string | null; created_at: string };
type Unit = {
  id: string; exercise_id: string; name: string; scenario_id: string | null; status: string;
  hull_integrity: number; propulsion: number; power: number; alert_level: string;
  kills: number; impacts: number; shots: number; ammo_pct: number; updated_at: string;
};
type Member = { id: string; unit_id: string; user_id: string; station: string };
type Scn = { id: string; name: string; domain: string; threat_level: string; threats: any; is_template: boolean };
type ThreatRow = { platform: string; domain: Domain; count: number; hostile: boolean };

const STATION_LABEL: Record<string, string> = { command: "Mando", aaw: "AAW", asuw: "ASuW", asw: "ASW", ew: "EW" };
const STATUS_META: Record<string, { label: string; cls: string }> = {
  active: { label: "EN COMBATE", cls: "text-threat-friend border-threat-friend" },
  out_of_action: { label: "FUERA DE COMBATE", cls: "text-primary border-primary" },
  sunk: { label: "HUNDIDO", cls: "text-destructive border-destructive animate-blink-alert" },
};

export const unitScore = (u: Unit) => Math.round(u.kills * 10 - u.impacts * 15 + Number(u.hull_integrity) * 0.5 + (u.status === "sunk" ? -50 : 0));

function Bar({ v, label }: { v: number; label: string }) {
  const c = v > 70 ? "bg-threat-friend" : v > 40 ? "bg-primary" : "bg-destructive";
  return (
    <div>
      <div className="flex justify-between text-[10px] font-mono text-muted-foreground"><span>{label}</span><span>{Math.round(v)}%</span></div>
      <div className="h-1 bg-secondary"><div className={`h-full ${c}`} style={{ width: `${Math.max(0, v)}%` }} /></div>
    </div>
  );
}

export default function Master() {
  const { user, displayName, signOut } = useAuth();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [exId, setExId] = useState<string | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [templates, setTemplates] = useState<Scn[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [contactCounts, setContactCounts] = useState<Record<string, Record<string, number>>>({});
  const [newEx, setNewEx] = useState("");
  const [newUnit, setNewUnit] = useState({ name: "", template: "" });
  const [raid, setRaid] = useState<{ platform: string; count: number }>({ platform: THREATS[0].platform, count: 2 });
  const [showReport, setShowReport] = useState(false);
  // scenario builder
  const [sb, setSb] = useState({ name: "", domain: "mixed", threat_level: "high" });
  const [sbThreats, setSbThreats] = useState<ThreatRow[]>([]);
  const [sbPick, setSbPick] = useState<ThreatRow>({ platform: "frigate", domain: "surface", count: 1, hostile: false });

  const ex = exercises.find((e) => e.id === exId) ?? null;

  const loadExercises = () =>
    supabase.from("exercises").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      setExercises((data ?? []) as Exercise[]);
      if (!exId && data?.length) setExId(data[0].id);
    });
  const loadTemplates = () =>
    supabase.from("scenarios").select("*").eq("is_template", true).order("created_at").then(({ data }) => setTemplates((data ?? []) as Scn[]));

  useEffect(() => {
    loadExercises();
    loadTemplates();
    supabase.from("profiles").select("id, display_name").then(({ data }) => {
      setNames(Object.fromEntries((data ?? []).map((p) => [p.id, p.display_name])));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!exId) return;
    const load = async () => {
      const { data: u } = await supabase.from("exercise_units").select("*").eq("exercise_id", exId).order("created_at");
      const list = (u ?? []) as Unit[];
      setUnits(list);
      const ids = list.map((x) => x.id);
      if (ids.length) {
        const { data: m } = await supabase.from("unit_members").select("*").in("unit_id", ids);
        setMembers((m ?? []) as Member[]);
      } else setMembers([]);
    };
    load();
    const ch = supabase
      .channel(`master-${exId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "exercise_units", filter: `exercise_id=eq.${exId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "unit_members" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "exercises" }, loadExercises)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exId]);

  // Live picture: contact counts + combined event feed (poll every 4s)
  useEffect(() => {
    const scnIds = units.map((u) => u.scenario_id).filter(Boolean) as string[];
    if (!scnIds.length) { setEvents([]); setContactCounts({}); return; }
    const tick = async () => {
      const [{ data: cs }, { data: ev }] = await Promise.all([
        supabase.from("contacts").select("scenario_id, domain, classification").in("scenario_id", scnIds),
        supabase.from("tactical_events").select("*").in("scenario_id", scnIds).order("created_at", { ascending: false }).limit(60),
      ]);
      const counts: Record<string, Record<string, number>> = {};
      (cs ?? []).forEach((c) => {
        const k = c.scenario_id!;
        counts[k] = counts[k] ?? {};
        counts[k][c.domain] = (counts[k][c.domain] ?? 0) + 1;
        if (c.classification === "hostile") counts[k].hostile = (counts[k].hostile ?? 0) + 1;
      });
      setContactCounts(counts);
      setEvents(ev ?? []);
    };
    tick();
    const id = window.setInterval(tick, 4000);
    return () => window.clearInterval(id);
  }, [units.map((u) => u.scenario_id).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const unitByScenario = useMemo(() => Object.fromEntries(units.map((u) => [u.scenario_id, u.name])), [units]);

  const createExercise = async () => {
    if (!newEx.trim() || !user) return;
    const { data, error } = await supabase.from("exercises").insert({ name: newEx.trim(), created_by: user.id }).select().single();
    if (error) return toast.error(error.message);
    setNewEx("");
    setExId(data.id);
    loadExercises();
    toast.success("Ejercicio creado");
  };

  const addUnit = async () => {
    if (!ex || !newUnit.name.trim()) return toast.warning("Escriba el nombre del buque");
    const tpl = templates.find((t) => t.id === newUnit.template);
    const { data: scn, error: e1 } = await supabase.from("scenarios").insert({
      name: `${ex.name} · ${newUnit.name.trim()}`,
      description: tpl ? `Basado en ${tpl.name}` : "Escenario de ejercicio",
      domain: tpl?.domain ?? "mixed",
      threat_level: tpl?.threat_level ?? "medium",
      threats: tpl?.threats ?? [],
      is_template: false,
      created_by: user?.id,
    }).select().single();
    if (e1) return toast.error(e1.message);
    const { error } = await supabase.from("exercise_units").insert({ exercise_id: ex.id, name: newUnit.name.trim(), scenario_id: scn.id });
    if (error) return toast.error(error.message);
    setNewUnit({ name: "", template: newUnit.template });
    toast.success(`Buque ${newUnit.name} añadido`);
  };

  const removeUnit = async (u: Unit) => {
    await supabase.from("exercise_units").delete().eq("id", u.id);
  };

  const setStatus = async (status: "running" | "ended") => {
    if (!ex || !user) return;
    await supabase.from("exercises").update(status === "running" ? { status, started_at: new Date().toISOString(), ended_at: null } : { status, ended_at: new Date().toISOString() }).eq("id", ex.id);
    await supabase.from("exercise_commands").insert({ exercise_id: ex.id, unit_id: null, command_type: status === "running" ? "start" : "end", created_by: user.id });
    toast.success(status === "running" ? "Ejercicio iniciado" : "Ejercicio finalizado");
    if (status === "ended") setShowReport(true);
    loadExercises();
  };

  const launchRaid = async (targets: Unit[]) => {
    if (!ex || !user) return;
    const live = targets.filter((u) => u.status !== "sunk" && u.scenario_id);
    if (!live.length) return toast.warning("No hay buques a flote para atacar");
    const threats = [{ platform: raid.platform, count: raid.count }];
    for (const u of live) {
      // Insert threats directly so the raid arrives even if the ship console is momentarily disconnected
      const wave = waveFromThreats(u.scenario_id!, threats);
      await supabase.from("contacts").insert(wave);
      await supabase.from("tactical_events").insert({
        scenario_id: u.scenario_id, event_type: "raid", domain: "mixed", severity: "critical",
        message: `🚨 RAID DEL INSTRUCTOR · ${wave.length}× ${PLATFORM_LABEL[raid.platform]} inbound`,
      });
      await supabase.from("exercise_commands").insert({ exercise_id: ex.id, unit_id: u.id, command_type: "raid", payload: { threats }, created_by: user.id });
    }
    toast.error(`Raid lanzado contra ${live.length} buque(s)`);
  };

  const resetUnit = async (u: Unit) => {
    if (!ex || !user) return;
    await supabase.from("exercise_commands").insert({ exercise_id: ex.id, unit_id: u.id, command_type: "reset", created_by: user.id });
    toast.success(`Orden de reparación enviada a ${u.name}`);
  };

  const saveScenario = async () => {
    if (!sb.name.trim()) return toast.warning("Nombre del escenario");
    if (!sbThreats.length) return toast.warning("Agregue al menos un contacto");
    const { error } = await supabase.from("scenarios").insert({ ...sb, name: sb.name.trim(), threats: sbThreats, is_template: true, created_by: user?.id, description: `Escenario personalizado · ${sbThreats.reduce((a, t) => a + t.count, 0)} contactos` });
    if (error) return toast.error(error.message);
    toast.success("Escenario guardado");
    setSb({ name: "", domain: "mixed", threat_level: "high" });
    setSbThreats([]);
    loadTemplates();
  };

  const ranking = [...units].sort((a, b) => unitScore(b) - unitScore(a));
  const unitMembers = (uid: string) => members.filter((m) => m.unit_id === uid);
  const fresh = (u: Unit) => Date.now() - new Date(u.updated_at).getTime() < 15000;

  const sel = "bg-input border border-border rounded px-2 py-1.5 text-xs font-mono";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-hud-bg/80 backdrop-blur sticky top-0 z-20 print:hidden">
        <div className="container py-2 flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-base text-primary glow-amber">PUESTO MAESTRO · INSTRUCTOR</h1>
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-accent/80">Control de ejercicio multi-buque · {displayName}</p>
          </div>
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline" className="font-mono text-xs"><Link to="/"><Monitor className="w-3.5 h-3.5 mr-1" />Consola</Link></Button>
            <Button size="sm" variant="ghost" className="font-mono text-xs" onClick={signOut}><LogOut className="w-3.5 h-3.5 mr-1" />Salir</Button>
          </div>
        </div>
      </header>

      <main className="container py-4 space-y-3">
        {/* Exercise selector */}
        <div className="hud-panel p-3 flex flex-wrap items-center gap-2 print:hidden">
          <span className="hud-label mr-2">Ejercicios</span>
          {exercises.map((e) => (
            <button key={e.id} onClick={() => { setExId(e.id); setShowReport(false); }} className={`px-3 py-1.5 text-xs font-mono uppercase border ${e.id === exId ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-accent"}`}>
              {e.name} · {e.status === "running" ? "EN CURSO" : e.status === "ended" ? "FINALIZADO" : "PLANEACIÓN"}
            </button>
          ))}
          <div className="ml-auto flex gap-2">
            <Input value={newEx} onChange={(e) => setNewEx(e.target.value)} placeholder="Nuevo ejercicio (ej. UNITAS 2026)" className="h-8 w-56 text-xs" />
            <Button size="sm" onClick={createExercise} className="font-mono text-xs"><Plus className="w-3.5 h-3.5 mr-1" />Crear</Button>
          </div>
        </div>

        {ex && (
          <div className="hud-panel p-3 flex flex-wrap items-center gap-2 print:hidden">
            <span className="font-display text-sm text-accent">{ex.name}</span>
            {ex.status !== "running" && <Button size="sm" onClick={() => setStatus("running")} className="font-mono text-xs"><Play className="w-3.5 h-3.5 mr-1" />Iniciar ejercicio</Button>}
            {ex.status === "running" && <Button size="sm" variant="destructive" onClick={() => setStatus("ended")} className="font-mono text-xs"><Square className="w-3.5 h-3.5 mr-1" />Finalizar ejercicio</Button>}
            <Button size="sm" variant="outline" onClick={() => setShowReport((v) => !v)} className="font-mono text-xs"><FileText className="w-3.5 h-3.5 mr-1" />{showReport ? "Ver tablero" : "Informe"}</Button>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <span className="hud-label">Raid</span>
              <select className={sel} value={raid.platform} onChange={(e) => setRaid({ ...raid, platform: e.target.value })}>
                {THREATS.map((t) => <option key={t.platform} value={t.platform}>{PLATFORM_LABEL[t.platform]}</option>)}
              </select>
              <Input type="number" min={1} max={20} value={raid.count} onChange={(e) => setRaid({ ...raid, count: Number(e.target.value) })} className="h-8 w-16 text-xs" />
              <Button size="sm" variant="destructive" disabled={ex.status !== "running"} onClick={() => launchRaid(units)} className="font-mono text-xs"><Rocket className="w-3.5 h-3.5 mr-1" />A toda la flota</Button>
            </div>
          </div>
        )}

        {ex && showReport && (
          <div className="hud-panel p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-primary">INFORME FINAL · {ex.name}</h2>
              <Button size="sm" variant="outline" onClick={() => window.print()} className="font-mono text-xs print:hidden"><Printer className="w-3.5 h-3.5 mr-1" />Imprimir</Button>
            </div>
            <p className="text-xs font-mono text-muted-foreground">
              Inicio: {ex.started_at ? new Date(ex.started_at).toLocaleString("es-CO") : "—"} · Fin: {ex.ended_at ? new Date(ex.ended_at).toLocaleString("es-CO") : "en curso"}
            </p>
            <table className="w-full text-xs font-mono">
              <thead className="text-muted-foreground text-left border-b border-border">
                <tr><th className="py-1">#</th><th>Buque</th><th>Estado</th><th>Casco</th><th>Derribos</th><th>Impactos</th><th>Disparos</th><th>Efectividad</th><th>Munición</th><th>Puntaje</th></tr>
              </thead>
              <tbody>
                {ranking.map((u, i) => (
                  <tr key={u.id} className="border-b border-border/40">
                    <td className="py-1">{i + 1}</td>
                    <td className="text-accent">{u.name}</td>
                    <td>{STATUS_META[u.status]?.label ?? u.status}</td>
                    <td>{Math.round(u.hull_integrity)}%</td>
                    <td>{u.kills}</td>
                    <td>{u.impacts}</td>
                    <td>{u.shots}</td>
                    <td>{u.shots ? Math.round((u.kills / u.shots) * 100) : 0}%</td>
                    <td>{Math.round(u.ammo_pct)}%</td>
                    <td className="text-primary">{unitScore(u)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[10px] font-mono text-muted-foreground">Puntaje = derribos×10 − impactos×15 + casco×0.5 − 50 si hundido.</p>
          </div>
        )}

        {ex && !showReport && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
            <section className="xl:col-span-8 space-y-3">
              <div className="hud-panel p-3 flex flex-wrap gap-2 items-center">
                <span className="hud-label mr-1">Añadir buque</span>
                <Input value={newUnit.name} onChange={(e) => setNewUnit({ ...newUnit, name: e.target.value })} placeholder="ARC Almirante Padilla" className="h-8 w-52 text-xs" />
                <select className={sel} value={newUnit.template} onChange={(e) => setNewUnit({ ...newUnit, template: e.target.value })}>
                  <option value="">Escenario: vacío</option>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <Button size="sm" onClick={addUnit} className="font-mono text-xs"><Plus className="w-3.5 h-3.5 mr-1" />Añadir</Button>
              </div>

              {units.length === 0 && <div className="hud-panel p-6 text-center text-xs font-mono text-muted-foreground">Añada buques al ejercicio. Cada operador se une desde su consola con su usuario.</div>}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {units.map((u) => {
                  const st = STATUS_META[u.status] ?? STATUS_META.active;
                  const cc = (u.scenario_id && contactCounts[u.scenario_id]) || {};
                  return (
                    <div key={u.id} className={`hud-panel p-3 space-y-2 ${u.status === "sunk" ? "opacity-70" : ""}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-display text-sm text-accent">{u.name}</div>
                          <div className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full ${fresh(u) ? "bg-threat-friend animate-pulse" : "bg-muted-foreground"}`} />
                            {fresh(u) ? "En línea" : "Sin enlace"} · COND {u.alert_level === "red" ? "I" : u.alert_level === "yellow" ? "II" : "III"}
                          </div>
                        </div>
                        <span className={`text-[10px] font-mono border px-1.5 py-0.5 ${st.cls}`}>{st.label}</span>
                      </div>
                      <Bar v={Number(u.hull_integrity)} label="Casco" />
                      <Bar v={Number(u.propulsion)} label="Propulsión" />
                      <Bar v={Number(u.ammo_pct)} label="Munición" />
                      <div className="grid grid-cols-4 gap-1 text-center font-mono">
                        <div><div className="text-threat-friend">{u.kills}</div><div className="text-[9px] text-muted-foreground">Derribos</div></div>
                        <div><div className="text-threat-hostile">{u.impacts}</div><div className="text-[9px] text-muted-foreground">Impactos</div></div>
                        <div><div>{u.shots}</div><div className="text-[9px] text-muted-foreground">Disparos</div></div>
                        <div><div className="text-primary">{unitScore(u)}</div><div className="text-[9px] text-muted-foreground">Puntaje</div></div>
                      </div>
                      <div className="flex flex-wrap gap-1 text-[10px] font-mono">
                        {(["air", "surface", "subsurface", "electronic"] as Domain[]).map((d) => (
                          <span key={d} className="border border-border px-1">{DOMAIN_META[d].abbr} {cc[d] ?? 0}</span>
                        ))}
                        <span className="border border-destructive text-destructive px-1">Hostiles {cc.hostile ?? 0}</span>
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground">
                        Puestos: {unitMembers(u.id).length === 0 ? "ninguno conectado" : unitMembers(u.id).map((m) => `${STATION_LABEL[m.station] ?? m.station}: ${names[m.user_id] ?? "?"}`).join(" · ")}
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="destructive" disabled={ex.status !== "running" || u.status === "sunk"} onClick={() => launchRaid([u])} className="flex-1 font-mono text-[10px] h-7"><Rocket className="w-3 h-3 mr-1" />Raid</Button>
                        <Button size="sm" variant="outline" onClick={() => resetUnit(u)} className="flex-1 font-mono text-[10px] h-7">Reparar</Button>
                        <Button size="sm" variant="ghost" onClick={() => removeUnit(u)} className="h-7 px-2"><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <aside className="xl:col-span-4 space-y-3">
              <div className="hud-panel p-3">
                <div className="hud-label mb-2">Bitácora de toda la flota</div>
                <div className="space-y-1 max-h-[420px] overflow-y-auto">
                  {events.length === 0 && <div className="text-xs font-mono text-muted-foreground">Sin eventos.</div>}
                  {events.map((e) => (
                    <div key={e.id} className={`text-[10px] font-mono border-l-2 pl-2 ${e.severity === "critical" ? "border-destructive" : e.severity === "warning" ? "border-primary" : "border-accent"}`}>
                      <span className="text-muted-foreground">{new Date(e.created_at).toLocaleTimeString("es-CO", { hour12: false })} </span>
                      <span className="text-accent">[{unitByScenario[e.scenario_id] ?? "?"}]</span> {e.message}
                    </div>
                  ))}
                </div>
              </div>

              <div className="hud-panel p-3 space-y-2">
                <div className="hud-label">Crear escenario</div>
                <Input value={sb.name} onChange={(e) => setSb({ ...sb, name: e.target.value })} placeholder="Nombre del escenario" className="h-8 text-xs" />
                <div className="flex gap-1">
                  <select className={sel + " flex-1"} value={sb.domain} onChange={(e) => setSb({ ...sb, domain: e.target.value })}>
                    <option value="mixed">Mixto</option><option value="air">Aéreo</option><option value="surface">Superficie</option><option value="subsurface">Submarino</option><option value="electronic">Electrónico</option>
                  </select>
                  <select className={sel + " flex-1"} value={sb.threat_level} onChange={(e) => setSb({ ...sb, threat_level: e.target.value })}>
                    <option value="low">Amenaza baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="critical">Crítica</option>
                  </select>
                </div>
                <div className="flex gap-1 flex-wrap">
                  <select className={sel + " flex-1"} value={`${sbPick.domain}|${sbPick.platform}`} onChange={(e) => { const [d, p] = e.target.value.split("|"); setSbPick({ ...sbPick, domain: d as Domain, platform: p }); }}>
                    {(Object.keys(PLATFORM_BY_DOMAIN) as Domain[]).map((d) => (
                      <optgroup key={d} label={DOMAIN_META[d].label}>
                        {PLATFORM_BY_DOMAIN[d].map((p) => <option key={p} value={`${d}|${p}`}>{p}</option>)}
                      </optgroup>
                    ))}
                  </select>
                  <Input type="number" min={1} max={20} value={sbPick.count} onChange={(e) => setSbPick({ ...sbPick, count: Number(e.target.value) })} className="h-8 w-14 text-xs" />
                  <label className="flex items-center gap-1 text-[10px] font-mono"><input type="checkbox" checked={sbPick.hostile} onChange={(e) => setSbPick({ ...sbPick, hostile: e.target.checked })} />Ataca</label>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setSbThreats([...sbThreats, sbPick])}><Plus className="w-3 h-3" /></Button>
                </div>
                <div className="space-y-0.5">
                  {sbThreats.map((t, i) => (
                    <div key={i} className="flex justify-between text-[10px] font-mono border border-border/50 px-1">
                      <span>{t.count}× {t.platform} ({DOMAIN_META[t.domain].abbr}){t.hostile ? " · ATACA" : ""}</span>
                      <button onClick={() => setSbThreats(sbThreats.filter((_, j) => j !== i))} className="text-destructive">✕</button>
                    </div>
                  ))}
                </div>
                <p className="text-[9px] font-mono text-muted-foreground">"Ataca" solo aplica a misiles, drones kamikaze, lanchas kamikaze y torpedos; esos contactos irán directo contra el buque.</p>
                <Button size="sm" onClick={saveScenario} className="w-full font-mono text-xs">Guardar escenario</Button>
              </div>
            </aside>
          </div>
        )}

        {!ex && <div className="hud-panel p-6 text-center text-xs font-mono text-muted-foreground">Cree un ejercicio para empezar.</div>}
      </main>
    </div>
  );
}
