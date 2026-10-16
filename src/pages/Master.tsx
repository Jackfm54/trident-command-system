import logoAsset from "@/assets/poseidon.jpeg.asset.json";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { THREATS, PLATFORM_LABEL, waveFromThreats, attackerSeedAt, advanceToward, distTo, toXY, IMPACT_DAMAGE } from "@/lib/combatEngine";
import { advanceContact, generateRandomContact } from "@/lib/simulator";
import { useRef } from "react";
import type { Contact } from "@/types/tactical";
import { PLATFORM_BY_DOMAIN } from "@/lib/simulator";
import { DOMAIN_META, Domain } from "@/types/tactical";
import { Play, Square, Plus, Rocket, FileText, Printer, Monitor, LogOut, Trash2 } from "lucide-react";

type Exercise = { id: string; name: string; status: string; mode: string; scenario_id: string | null; started_at: string | null; ended_at: string | null; created_at: string };
type Unit = {
  id: string; exercise_id: string; name: string; scenario_id: string | null; status: string;
  hull_integrity: number; propulsion: number; power: number; alert_level: string;
  kills: number; impacts: number; shots: number; ammo_pct: number; updated_at: string; pos_x_nm: number; pos_y_nm: number;
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
  const [toDelete, setToDelete] = useState<Unit | null>(null);
  const [toDeleteScn, setToDeleteScn] = useState<Scn | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [templates, setTemplates] = useState<Scn[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [contactCounts, setContactCounts] = useState<Record<string, Record<string, number>>>({});
  const [newEx, setNewEx] = useState("");
  const [newMode, setNewMode] = useState<"independent" | "integrated">("integrated");
  const [newUnit, setNewUnit] = useState({ name: "", template: "", bearing: 0, dist: 0 });
  const [seedTpl, setSeedTpl] = useState("");
  const [fleetContacts, setFleetContacts] = useState<Contact[]>([]);
  const fcRef = useRef<Contact[]>([]);
  const unitsRef = useRef<Unit[]>([]);
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
    let scenario_id: string | null = null;
    if (newMode === "integrated") {
      const { data: scn, error: e0 } = await supabase.from("scenarios").insert({ name: `${newEx.trim()} · Teatro común`, domain: "mixed", threat_level: "high", is_template: false, created_by: user.id }).select().single();
      if (e0) return toast.error(e0.message);
      scenario_id = scn.id;
    }
    const { data, error } = await supabase.from("exercises").insert({ name: newEx.trim(), created_by: user.id, mode: newMode, scenario_id }).select().single();
    if (error) return toast.error(error.message);
    setNewEx("");
    setExId(data.id);
    loadExercises();
    toast.success("Ejercicio creado");
  };

  const addUnit = async () => {
    if (!ex || !newUnit.name.trim()) return toast.warning("Escriba el nombre del buque");
    const b = (newUnit.bearing * Math.PI) / 180;
    const pos = { pos_x_nm: newUnit.dist * Math.sin(b), pos_y_nm: newUnit.dist * Math.cos(b) };
    if (ex.mode === "integrated") {
      const { error } = await supabase.from("exercise_units").insert({ exercise_id: ex.id, name: newUnit.name.trim(), scenario_id: ex.scenario_id, ...pos });
      if (error) return toast.error(error.message);
      setNewUnit({ ...newUnit, name: "" });
      return toast.success(`Buque ${newUnit.name} posicionado a ${newUnit.dist} NM / ${newUnit.bearing}°`);
    }
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
    const { error } = await supabase.from("exercise_units").insert({ exercise_id: ex.id, name: newUnit.name.trim(), scenario_id: scn.id, ...pos });
    if (error) return toast.error(error.message);
    setNewUnit({ ...newUnit, name: "" });
    toast.success(`Buque ${newUnit.name} añadido`);
  };

  const removeUnit = async (u: Unit) => {
    setToDelete(null);
    await supabase.from("contacts").update({ target_unit_id: null }).eq("target_unit_id", u.id);
    const { error } = await supabase.from("exercise_units").delete().eq("id", u.id);
    if (error) return toast.error(error.message);
    setUnits((prev: any[]) => prev.filter((x) => x.id !== u.id));
    toast.success(`Buque ${u.name} eliminado`);
  };

  const removeScenario = async (s: Scn) => {
    setToDeleteScn(null);
    const { error } = await supabase.from("scenarios").delete().eq("id", s.id);
    if (error) return toast.error(error.message);
    setTemplates((prev) => prev.filter((x) => x.id !== s.id));
    toast.success(`Escenario ${s.name} eliminado`);
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
    if (ex.mode === "integrated" && ex.scenario_id) {
      for (const u of live) {
        const wave = threats.flatMap((t) => Array.from({ length: Math.min(20, t.count) }, () => attackerSeedAt(ex.scenario_id!, t.platform, u.id, Number(u.pos_x_nm), Number(u.pos_y_nm)))).filter(Boolean) as any[];
        await supabase.from("contacts").insert(wave);
        await supabase.from("tactical_events").insert({
          scenario_id: ex.scenario_id, event_type: "raid", domain: "mixed", severity: "critical",
          message: `🚨 RAID DEL INSTRUCTOR · ${wave.length}× ${PLATFORM_LABEL[raid.platform]} contra ${u.name}`,
        });
        await supabase.from("exercise_commands").insert({ exercise_id: ex.id, unit_id: u.id, command_type: "raid", payload: { threats }, created_by: user.id });
      }
      return toast.error(`Raid lanzado contra ${live.length} buque(s)`);
    }
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

  unitsRef.current = units;

  const [formation, setFormation] = useState({ type: "circle", spacing: 3, axis: 0 });
  const applyFormation = async () => {
    if (!units.length) return toast.warning("Añada buques primero");
    const { type, spacing: d, axis } = formation;
    const n = units.length;
    // offsets in formation frame: f = forward along axis, r = to starboard
    const offs: { f: number; r: number }[] = units.map((_, i) => {
      if (i === 0) return { f: 0, r: 0 }; // guide / flagship at centre
      const k = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
      switch (type) {
        case "column": return { f: -i * d, r: 0 };
        case "line": return { f: 0, r: side * k * d };
        case "wedge": return { f: -k * d, r: side * k * d };
        case "echelon": return { f: -i * d, r: i * d };
        case "diamond": return [{ f: d, r: 0 }, { f: 0, r: d }, { f: 0, r: -d }, { f: -d, r: 0 }][(i - 1) % 4] && { ...[{ f: d, r: 0 }, { f: 0, r: d }, { f: 0, r: -d }, { f: -d, r: 0 }][(i - 1) % 4], f: [d, 0, 0, -d][(i - 1) % 4] * Math.ceil(i / 4) };
        default: { const a = ((i - 1) / Math.max(1, n - 1)) * 2 * Math.PI; return { f: Math.cos(a) * d, r: Math.sin(a) * d }; } // circle (AAW screen)
      }
    });
    const ax = (axis * Math.PI) / 180;
    await Promise.all(units.map((u, i) => {
      const { f, r } = offs[i];
      const x = f * Math.sin(ax) + r * Math.cos(ax);
      const y = f * Math.cos(ax) - r * Math.sin(ax);
      return supabase.from("exercise_units").update({ pos_x_nm: x, pos_y_nm: y }).eq("id", u.id);
    }));
    toast.success(`Formación aplicada · ${units[0].name} como guía`);
  };

  const seedTheatre = async () => {
    if (!ex?.scenario_id) return;
    const tpl = templates.find((t) => t.id === seedTpl);
    const sid = ex.scenario_id;
    const live = units.filter((u) => u.status !== "sunk");
    const threats: any[] = Array.isArray(tpl?.threats) ? tpl!.threats : [];
    let seeds: any[];
    if (threats.length) {
      seeds = threats.flatMap((t: any) => Array.from({ length: Math.min(20, t.count) }, () => {
        const tgt = live[Math.floor(Math.random() * live.length)];
        return (t.hostile && tgt && attackerSeedAt(sid, t.platform, tgt.id, Number(tgt.pos_x_nm), Number(tgt.pos_y_nm))) || { ...generateRandomContact(sid, t.domain), domain: t.domain, platform_type: t.platform };
      }));
    } else {
      const n = tpl?.threat_level === "critical" ? 10 : tpl?.threat_level === "high" ? 8 : 6;
      const dom = tpl && tpl.domain !== "mixed" ? (tpl.domain as Domain) : undefined;
      seeds = Array.from({ length: n }, () => generateRandomContact(sid, dom));
    }
    await supabase.from("contacts").delete().eq("scenario_id", sid);
    await supabase.from("contacts").insert(seeds);
    await supabase.from("tactical_events").insert({ scenario_id: sid, event_type: "scenario", domain: "mixed", severity: "info", message: `Teatro común sembrado: ${tpl?.name ?? "aleatorio"} · ${seeds.length} contactos` });
    toast.success(`Teatro común con ${seeds.length} contactos`);
  };

  const moveUnit = async (u: Unit, bearing: number, dist: number) => {
    const b = (bearing * Math.PI) / 180;
    await supabase.from("exercise_units").update({ pos_x_nm: dist * Math.sin(b), pos_y_nm: dist * Math.cos(b) }).eq("id", u.id);
  };

  // Integrated exercise: this station is the authoritative simulator of the common sea
  useEffect(() => {
    if (!ex || ex.mode !== "integrated" || !ex.scenario_id) { setFleetContacts([]); return; }
    const sid = ex.scenario_id;
    supabase.from("contacts").select("*").eq("scenario_id", sid).then(({ data }) => { fcRef.current = (data ?? []) as Contact[]; setFleetContacts(fcRef.current); });
    const ch = supabase.channel(`theatre-${sid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "contacts", filter: `scenario_id=eq.${sid}` }, (p) => {
        if (p.eventType === "INSERT") fcRef.current = [...fcRef.current, p.new as Contact];
        else if (p.eventType === "DELETE") fcRef.current = fcRef.current.filter((c) => c.id !== (p.old as any).id);
        else if (p.eventType === "UPDATE") fcRef.current = fcRef.current.map((c) => (c.id === (p.new as any).id ? { ...c, status: (p.new as any).status, classification: (p.new as any).classification, platform_type: (p.new as any).platform_type, speed_kts: (p.new as any).speed_kts } : c));
        setFleetContacts(fcRef.current);
      }).subscribe();
    if (ex.status !== "running") return () => { supabase.removeChannel(ch); };
    let n = 0;
    const id = window.setInterval(() => {
      const us = unitsRef.current;
      const alive = us.filter((u) => u.status !== "sunk");
      const impacts: { c: Contact; u: Unit }[] = [];
      const next: Contact[] = [];
      for (const c of fcRef.current) {
        let t = c.target_unit_id ? us.find((u) => u.id === c.target_unit_id) : undefined;
        if (t && t.status === "sunk") {
          // retarget to nearest surviving ship
          const near = alive.sort((a, b) => distTo(c, Number(a.pos_x_nm), Number(a.pos_y_nm)) - distTo(c, Number(b.pos_x_nm), Number(b.pos_y_nm)))[0];
          if (near) { c.target_unit_id = near.id; t = near; supabase.from("contacts").update({ target_unit_id: near.id }).eq("id", c.id).then(); }
          else t = undefined;
        }
        if (t && (c.status === "attacking" || c.status === "engaged")) {
          const m = { ...c, ...advanceToward(c, Number(t.pos_x_nm), Number(t.pos_y_nm), 1.5) };
          if (distTo(m, Number(t.pos_x_nm), Number(t.pos_y_nm)) <= 0.15) impacts.push({ c: m, u: t });
          else next.push(m);
        } else next.push({ ...c, ...advanceContact(c) });
      }
      fcRef.current = next;
      setFleetContacts(next);
      for (const { c, u } of impacts) {
        const dmg = IMPACT_DAMAGE[c.platform_type ?? ""] ?? 15;
        supabase.from("contacts").delete().eq("id", c.id).then();
        supabase.from("exercise_commands").insert({ exercise_id: ex.id, unit_id: u.id, command_type: "impact", created_by: user!.id,
          payload: { track_id: c.track_id, platform_type: c.platform_type, domain: c.domain, scenario_id: sid } }).then();
        supabase.from("tactical_events").insert({ scenario_id: sid, event_type: "impact", domain: c.domain, severity: "critical",
          message: `💥 IMPACTO en ${u.name} · ${c.track_id} (${c.platform_type}) · daño ${dmg}%` }).then();
      }
      if (++n % 2 === 0) next.forEach((c) => supabase.from("contacts").update({ range_nm: c.range_nm, bearing: c.bearing, heading: c.heading }).eq("id", c.id).then());
    }, 1500);
    return () => { window.clearInterval(id); supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ex?.id, ex?.mode, ex?.scenario_id, ex?.status]);

  const ranking = [...units].sort((a, b) => unitScore(b) - unitScore(a));
  const unitMembers = (uid: string) => members.filter((m) => m.unit_id === uid);
  const fresh = (u: Unit) => Date.now() - new Date(u.updated_at).getTime() < 15000;

  const copyLink = (u: Unit, station: string) => {
    const url = `${window.location.origin}/?unit=${u.id}&station=${station}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success(`Enlace ${STATION_LABEL[station]} de ${u.name} copiado`),
      () => window.prompt("Copie el enlace:", url)
    );
  };

  const sel = "bg-input border border-border rounded px-2 py-1.5 text-xs font-mono";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-hud-bg/80 backdrop-blur sticky top-0 z-20 print:hidden">
        <div className="container py-2 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={logoAsset.url} alt="Logo Poseidón" className="w-16 h-16 rounded-full border border-primary/60 object-cover" />
            <div>
            <h1 className="font-display text-base text-primary glow-amber">PUESTO MAESTRO · INSTRUCTOR</h1>
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-accent/80">Control de ejercicio multi-buque · {displayName}</p>
            </div>
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
            <select className="bg-input border border-border rounded px-2 text-xs font-mono" value={newMode} onChange={(e) => setNewMode(e.target.value as any)}>
              <option value="integrated">Flota integrada (mismo mar)</option>
              <option value="independent">Buques independientes</option>
            </select>
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
                {ex.mode !== "integrated" && (
                  <select className={sel} value={newUnit.template} onChange={(e) => setNewUnit({ ...newUnit, template: e.target.value })}>
                    <option value="">Escenario: vacío</option>
                    {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                )}
                <span className="text-[10px] font-mono text-muted-foreground">Posición</span>
                <Input type="number" value={newUnit.bearing} onChange={(e) => setNewUnit({ ...newUnit, bearing: Number(e.target.value) })} className="h-8 w-16 text-xs" title="Demora desde el centro (°)" />
                <span className="text-[10px] font-mono">°</span>
                <Input type="number" value={newUnit.dist} onChange={(e) => setNewUnit({ ...newUnit, dist: Number(e.target.value) })} className="h-8 w-16 text-xs" title="Distancia desde el centro (NM)" />
                <span className="text-[10px] font-mono">NM</span>
                <Button size="sm" onClick={addUnit} className="font-mono text-xs"><Plus className="w-3.5 h-3.5 mr-1" />Añadir</Button>
              </div>

              {ex.mode === "integrated" && (
                <div className="hud-panel p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="hud-label">Teatro común · flota integrada</span>
                    <select className={sel} value={seedTpl} onChange={(e) => setSeedTpl(e.target.value)}>
                      <option value="">Contactos aleatorios</option>
                      {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <Button size="sm" variant="outline" onClick={seedTheatre} className="font-mono text-xs h-8">Sembrar escenario</Button>
                    <span className="hud-label ml-2">Formación</span>
                    <select className={sel} value={formation.type} onChange={(e) => setFormation({ ...formation, type: e.target.value })}>
                      <option value="circle">Circular (pantalla AAW)</option>
                      <option value="column">Columna / línea de fila</option>
                      <option value="line">Línea de frente</option>
                      <option value="wedge">Cuña (V)</option>
                      <option value="echelon">Escalón</option>
                      <option value="diamond">Diamante</option>
                    </select>
                    <Input type="number" min={0.5} step={0.5} value={formation.spacing} onChange={(e) => setFormation({ ...formation, spacing: Number(e.target.value) })} className="h-8 w-16 text-xs" title="Distancia entre buques (NM)" />
                    <span className="text-[10px] font-mono">NM</span>
                    <Input type="number" value={formation.axis} onChange={(e) => setFormation({ ...formation, axis: Number(e.target.value) })} className="h-8 w-16 text-xs" title="Eje / rumbo de la formación (°)" />
                    <span className="text-[10px] font-mono">° eje</span>
                    <Button size="sm" onClick={applyFormation} className="font-mono text-xs h-8">Aplicar</Button>
                    {ex.status !== "running" && <span className="text-[10px] font-mono text-primary">Inicie el ejercicio para que las amenazas se muevan. Mantenga esta pantalla abierta: es el simulador central.</span>}
                  </div>
                  <FleetPlot units={units} contacts={fleetContacts} />
                </div>
              )}

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
                      {ex.mode === "integrated" && (
                        <PosEditor u={u} onSave={(b, d) => moveUnit(u, b, d)} />
                      )}
                      <div className="space-y-1">
                        <div className="text-[10px] font-mono text-muted-foreground">Copiar enlace de invitación por puesto:</div>
                        <div className="grid grid-cols-5 gap-1">
                          {Object.keys(STATION_LABEL).map((st) => {
                            const taken = unitMembers(u.id).find((m) => m.station === st);
                            return (
                              <button key={st} onClick={() => copyLink(u, st)} title={taken ? `Ocupado por ${names[taken.user_id] ?? "?"}` : "Libre"}
                                className={`text-[10px] font-mono border py-1 ${taken ? "border-threat-friend text-threat-friend" : "border-border hover:border-accent"}`}>
                                {STATION_LABEL[st]}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="destructive" disabled={ex.status !== "running" || u.status === "sunk"} onClick={() => launchRaid([u])} className="flex-1 font-mono text-[10px] h-7"><Rocket className="w-3 h-3 mr-1" />Raid</Button>
                        <Button size="sm" variant="outline" onClick={() => resetUnit(u)} className="flex-1 font-mono text-[10px] h-7">Reparar</Button>
                        <Button size="sm" variant="ghost" onClick={() => setToDelete(u)} className="h-7 px-2"><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <aside className="xl:col-span-4 space-y-3">
              <div className="hud-panel p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="hud-label">Bitácora de toda la flota</div>
                  <button
                    title="Imprimir bitácora del ejercicio"
                    className="flex items-center gap-1 text-[10px] font-mono uppercase text-accent hover:text-primary border border-border rounded px-2 py-0.5"
                    onClick={() => {
                      const w = window.open("", "_blank");
                      if (!w) return toast.warning("Permita ventanas emergentes para imprimir");
                      const esc = (s: string) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" } as any)[c]);
                      const rows = [...events].reverse().map((e: any) => `<tr class="${e.severity}"><td>${new Date(e.created_at).toLocaleString("es-CO", { hour12: false })}</td><td>${esc(unitByScenario[e.scenario_id] ?? "?")}</td><td>${esc(e.domain)}</td><td>${esc(e.event_type)}</td><td>${esc(e.severity)}</td><td>${esc(e.message)}</td></tr>`).join("");
                      w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Bitácora del ejercicio</title><style>body{font-family:monospace;font-size:11px;margin:16px;color:#111}h1{font-size:16px;margin:0}p{margin:2px 0 12px;color:#555}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:4px;text-align:left;vertical-align:top}th{background:#eee}tr{break-inside:avoid}.critical td{color:#b00}.warning td{color:#a60}@page{size:A4;margin:12mm}</style></head><body><h1>SISTEMA TCM POSEIDÓN · BITÁCORA DEL EJERCICIO</h1><p>Ejercicio: ${esc(ex?.name ?? "")} · Buques: ${esc(units.map((u) => u.name).join(", "))} · Impreso: ${new Date().toLocaleString("es-CO", { hour12: false })} · ${events.length} eventos</p><table><thead><tr><th>Hora</th><th>Buque</th><th>Dominio</th><th>Tipo</th><th>Severidad</th><th>Mensaje</th></tr></thead><tbody>${rows || '<tr><td colspan="6">Sin eventos</td></tr>'}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`);
                      w.document.close();
                    }}
                  >
                    <Printer className="w-3 h-3" /> Imprimir
                  </button>
                </div>
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
                <div className="hud-label pt-1">Escenarios creados</div>
                <div className="space-y-0.5 max-h-40 overflow-y-auto">
                  {templates.length === 0 && <div className="text-[10px] font-mono text-muted-foreground">Sin escenarios.</div>}
                  {templates.map((t) => (
                    <div key={t.id} className="flex items-center justify-between text-[10px] font-mono border border-border/50 px-1 py-0.5">
                      <span className="truncate pr-1">{t.name}</span>
                      <Button size="sm" variant="ghost" onClick={() => setToDeleteScn(t)} className="h-6 px-1.5"><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        )}

        {!ex && <div className="hud-panel p-6 text-center text-xs font-mono text-muted-foreground">Cree un ejercicio para empezar.</div>}
      </main>
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent className="hud-panel border-primary/60">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-primary">Eliminar buque</AlertDialogTitle>
            <AlertDialogDescription className="font-mono text-xs">
              ¿Desea retirar el buque <span className="text-accent">{toDelete?.name}</span> del ejercicio? Sus puestos asignados también se eliminarán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-mono">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="font-mono bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => toDelete && removeUnit(toDelete)}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!toDeleteScn} onOpenChange={(o) => !o && setToDeleteScn(null)}>
        <AlertDialogContent className="hud-panel border-primary/60">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-primary">Eliminar escenario</AlertDialogTitle>
            <AlertDialogDescription className="font-mono text-xs">
              ¿Desea eliminar el escenario <span className="text-accent">{toDeleteScn?.name}</span>? Ya no podrá usarse para crear nuevos ejercicios.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-mono">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="font-mono bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => toDeleteScn && removeScenario(toDeleteScn)}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PosEditor({ u, onSave }: { u: Unit; onSave: (b: number, d: number) => void }) {
  const x = Number(u.pos_x_nm), y = Number(u.pos_y_nm);
  const [b, setB] = useState(Math.round(((Math.atan2(x, y) * 180) / Math.PI + 360) % 360));
  const [d, setD] = useState(Math.round(Math.hypot(x, y) * 10) / 10);
  return (
    <div className="flex items-center gap-1 text-[10px] font-mono">
      <span className="text-muted-foreground">Posición</span>
      <Input type="number" value={b} onChange={(e) => setB(Number(e.target.value))} className="h-6 w-14 text-[10px]" />°
      <Input type="number" value={d} onChange={(e) => setD(Number(e.target.value))} className="h-6 w-14 text-[10px]" />NM
      <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => onSave(b, d)}>Mover</Button>
    </div>
  );
}

const CLS_COLOR: Record<string, string> = { hostile: "hsl(var(--threat-hostile))", friend: "hsl(var(--threat-friend))", neutral: "hsl(var(--threat-neutral))", suspect: "hsl(var(--primary))" };

function FleetPlot({ units, contacts }: { units: Unit[]; contacts: Contact[] }) {
  const pts = [...units.map((u) => ({ x: Number(u.pos_x_nm), y: Number(u.pos_y_nm) })), ...contacts.map((c) => toXY(c))];
  const max = Math.max(10, ...pts.map((p) => Math.max(Math.abs(p.x), Math.abs(p.y)))) * 1.1;
  const S = 200 / max;
  return (
    <svg viewBox="-210 -210 420 420" className="w-full max-h-[480px] bg-hud-bg/60 border border-border">
      {[0.25, 0.5, 0.75, 1].map((k) => <circle key={k} r={200 * k} fill="none" stroke="hsl(var(--border))" strokeDasharray="2 4" />)}
      <line x1={-200} y1={0} x2={200} y2={0} stroke="hsl(var(--border))" />
      <line x1={0} y1={-200} x2={0} y2={200} stroke="hsl(var(--border))" />
      <text x={4} y={-192} fontSize="9" fill="hsl(var(--muted-foreground))">N · radio {max.toFixed(0)} NM</text>
      {contacts.map((c) => {
        const p = toXY(c);
        const col = CLS_COLOR[c.classification] ?? "hsl(var(--muted-foreground))";
        return (
          <g key={c.id} transform={`translate(${p.x * S},${-p.y * S})`}>
            <circle r={c.status === "attacking" ? 3.5 : 2.5} fill={col} />
            {c.status === "attacking" && <circle r={6} fill="none" stroke={col} className="animate-pulse" />}
            <text x={5} y={3} fontSize="7" fill={col}>{c.track_id}</text>
          </g>
        );
      })}
      {units.map((u) => (
        <g key={u.id} transform={`translate(${Number(u.pos_x_nm) * S},${-Number(u.pos_y_nm) * S})`}>
          {u.status === "sunk" ? (
            <text textAnchor="middle" y={4} fontSize="12" fill="hsl(var(--destructive))">✕</text>
          ) : (
            <rect x={-5} y={-5} width={10} height={10} fill="none" stroke="hsl(var(--accent))" strokeWidth={2} />
          )}
          <text x={8} y={-6} fontSize="9" fill="hsl(var(--accent))">{u.name}</text>
        </g>
      ))}
    </svg>
  );
}
