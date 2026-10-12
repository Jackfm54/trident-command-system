import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Contact, Scenario, TacticalEvent, Domain, DOMAIN_META } from "@/types/tactical";
import { advanceContact, generateRandomContact } from "@/lib/simulator";
import { INITIAL_SENSORS, INITIAL_WEAPONS, INITIAL_SHIP, Sensor, Weapon, ShipSystem } from "@/lib/combatSystems";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TacticalRadar } from "@/components/tactical/TacticalRadar";
import { NauticalChart } from "@/components/tactical/NauticalChart";
import { ContactList } from "@/components/tactical/ContactList";
import { ContactDetail } from "@/components/tactical/ContactDetail";
import { EventLog } from "@/components/tactical/EventLog";
import { ScenarioBar } from "@/components/tactical/ScenarioBar";
import { DomainStatus } from "@/components/tactical/DomainStatus";
import { SensorsPanel } from "@/components/tactical/SensorsPanel";
import { WeaponsPanel } from "@/components/tactical/WeaponsPanel";
import { ShipStatusPanel } from "@/components/tactical/ShipStatusPanel";
import { EngagementDialog } from "@/components/tactical/EngagementDialog";
import { VisualIntelPanel } from "@/components/tactical/VisualIntelPanel";
import { toast } from "sonner";
import { TrainingPanel } from "@/components/tactical/TrainingPanel";
import { UnitLinkBar, UnitLink } from "@/components/tactical/UnitLinkBar";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
import { attackerSeed, relativeTo, advanceToward } from "@/lib/combatEngine";
import { isDetected, advanceAttacker, IMPACT_DAMAGE, generateAttackWave, pickWeapon, ammoCost } from "@/lib/combatEngine";

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
import { Activity, Radar, Anchor, Waves, Radio } from "lucide-react";

const TAB_DOMAINS: { key: "ALL" | Domain; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "ALL", label: "TCM Global", icon: Activity },
  { key: "air", label: "AAW · Antiaérea", icon: Radar },
  { key: "surface", label: "ASuW · Superficie", icon: Anchor },
  { key: "subsurface", label: "ASW · Submarina", icon: Waves },
  { key: "electronic", label: "EW · Electrónica", icon: Radio },
];

const Index = () => {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [events, setEvents] = useState<TacticalEvent[]>([]);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [classifyingId, setClassifyingId] = useState<string | null>(null);
  const [tab, setTab] = useState<"ALL" | Domain>("ALL");
  const [sensors, setSensors] = useState<Sensor[]>(() => load("tcm.sensors", INITIAL_SENSORS));
  const [weapons, setWeapons] = useState<Weapon[]>(() => load("tcm.weapons", INITIAL_WEAPONS));
  const [ship, setShip] = useState<ShipSystem>(() => load("tcm.ship", INITIAL_SHIP));
  const [engageOpen, setEngageOpen] = useState(false);
  const [engageContact, setEngageContact] = useState<Contact | null>(null);
  const [training, setTraining] = useState(false);
  const [autoDefense, setAutoDefense] = useState(false);
  const [difficulty, setDifficulty] = useState(2);
  const [stats, setStats] = useState({ kills: 0, impacts: 0, waves: 0, shots: 0 });
  const { user, isInstructor, signOut } = useAuth();
  const [link, setLink] = useState<UnitLink | null>(() => load<UnitLink | null>("tcm.link", null));
  const [unit, setUnit] = useState<any>(null);
  const [unitScenario, setUnitScenario] = useState<Scenario | null>(null);
  const [exerciseName, setExerciseName] = useState("");
  const isCommand = !link || link.station === "command";
  const isCommandRef = useRef(isCommand);
  isCommandRef.current = isCommand;
  const fireRef = useRef<(w: Weapon, c: Contact, auto?: boolean) => void>(() => {});
  const rearmRef = useRef<() => void>(() => {});
  const setAlertRef = useRef<(l: ShipSystem["alert_level"], fromStation?: boolean) => void>(() => {});
  const [exercise, setExercise] = useState<any>(null);
  const [fleet, setFleet] = useState<any[]>([]);
  const integrated = exercise?.mode === "integrated";
  const integratedRef = useRef(false);
  integratedRef.current = integrated;
  const fleetRef = useRef<any[]>([]);
  fleetRef.current = fleet;
  const ownRef = useRef({ x: 0, y: 0 });
  ownRef.current = { x: Number(unit?.pos_x_nm ?? 0), y: Number(unit?.pos_y_nm ?? 0) };
  const applyImpactRef = useRef<(c: { track_id: string; platform_type: string | null; domain: string; scenario_id: string | null; id?: string }, local: boolean) => void>(() => {});
  const statsRef = useRef(stats);
  statsRef.current = stats;
  const simRef = useRef<number | null>(null);
  const contactsRef = useRef<Contact[]>([]);
  const displayRef = useRef<Contact[]>([]);
  const weaponsRef = useRef(weapons);
  const sensorsRef = useRef(sensors);
  const shipRef = useRef(ship);
  const autoRef = useRef(autoDefense);
  const engagedRef = useRef<Set<string>>(new Set());
  const endTrainingRef = useRef<(lost?: boolean) => void>(() => {});
  contactsRef.current = contacts;
  weaponsRef.current = weapons;
  sensorsRef.current = sensors;
  shipRef.current = ship;
  autoRef.current = autoDefense;

  useEffect(() => { localStorage.setItem("tcm.sensors", JSON.stringify(sensors)); }, [sensors]);
  useEffect(() => { localStorage.setItem("tcm.weapons", JSON.stringify(weapons)); }, [weapons]);
  useEffect(() => { localStorage.setItem("tcm.ship", JSON.stringify(ship)); }, [ship]);
  useEffect(() => { localStorage.setItem("tcm.link", JSON.stringify(link)); }, [link]);

  // ===== Invite links: /?unit=<id>&station=<aaw|asuw|asw|ew|command> auto-join =====
  useEffect(() => {
    if (!user) return;
    const q = new URLSearchParams(window.location.search.includes("unit=") ? window.location.search : localStorage.getItem("tcm.pending") ?? "");
    localStorage.removeItem("tcm.pending");
    const unitId = q.get("unit");
    const station = q.get("station") ?? "command";
    if (!unitId) return;
    window.history.replaceState({}, "", "/");
    supabase.from("unit_members").upsert({ unit_id: unitId, user_id: user.id, station }, { onConflict: "unit_id,user_id" }).then(({ error }) => {
      if (error) return toast.error("No se pudo unir al buque: " + error.message);
      setLink({ unitId, station });
      toast.success(`Enlazado al buque · puesto ${station.toUpperCase()}`);
    });
  }, [user?.id]);

  // ===== Exercise link: load unit, follow its scenario, sync state =====
  useEffect(() => {
    if (!link) { setUnit(null); setUnitScenario(null); setExercise(null); setFleet([]); return; }
    let alive = true;
    (async () => {
      const { data: u } = await supabase.from("exercise_units").select("*").eq("id", link.unitId).maybeSingle();
      if (!alive) return;
      if (!u) { setLink(null); toast.error("El buque ya no existe en el ejercicio"); return; }
      setUnit(u);
      const [{ data: ex }, { data: scn }] = await Promise.all([
        supabase.from("exercises").select("*").eq("id", u.exercise_id).maybeSingle(),
        u.scenario_id ? supabase.from("scenarios").select("*").eq("id", u.scenario_id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      setExerciseName(ex?.name ?? "");
      setExercise(ex);
      if (scn) setUnitScenario(scn as Scenario);
      if (ex?.mode === "integrated" && ex.scenario_id) setActiveScenario(ex.scenario_id);
      else if (u.scenario_id) setActiveScenario(u.scenario_id);
      const st = link.station;
      setTab(st === "aaw" ? "air" : st === "asuw" ? "surface" : st === "asw" ? "subsurface" : st === "ew" ? "electronic" : "ALL");
    })();
    const ch = supabase
      .channel(`unit-${link.unitId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "exercise_units", filter: `id=eq.${link.unitId}` }, (p) => {
        if (p.eventType === "DELETE") { setLink(null); toast.error("El instructor retiró este buque"); return; }
        const u = p.new as any;
        setUnit(u);
        if (!isCommandRef.current) {
          setShip((s) => ({ ...s, hull_integrity: Number(u.hull_integrity), propulsion: Number(u.propulsion), power: Number(u.power), alert_level: u.alert_level }));
          if (Array.isArray(u.weapons) && u.weapons.length) setWeapons(u.weapons);
          setStats((s) => ({ ...s, kills: u.kills, impacts: u.impacts, shots: u.shots }));
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "exercise_commands" }, (p) => {
        const cmd = p.new as any;
        if (cmd.unit_id && cmd.unit_id !== link.unitId) return;
        if (cmd.command_type === "start") toast.success("📡 El instructor inició el ejercicio");
        if (cmd.command_type === "end") { toast.info("🏁 El instructor finalizó el ejercicio"); endTrainingRef.current(); }
        if (cmd.command_type === "raid") toast.error("🚨 RAID ordenado por el instructor");
        if (!isCommandRef.current) return;
        if (cmd.command_type === "reset") rearmRef.current();
        if (cmd.command_type === "impact" && cmd.payload) applyImpactRef.current(cmd.payload, false);
        if (cmd.command_type === "alert" && cmd.payload?.level) { setAlertRef.current(cmd.payload.level, true); return; }
        if (cmd.command_type === "kill") { setStats((s) => ({ ...s, kills: s.kills + 1 })); return; }
        if (cmd.command_type === "fire" && cmd.payload?.executed) {
          setWeapons((ws) => ws.map((x) => (x.id === cmd.payload.weapon_id ? { ...x, ammo: Math.max(0, x.ammo - (cmd.payload.cost ?? 1)) } : x)));
          setStats((s) => ({ ...s, shots: s.shots + 1 }));
          return;
        }
        if (cmd.command_type === "fire") {
          const w = weaponsRef.current.find((x) => x.id === cmd.payload?.weapon_id);
          const c = displayRef.current.find((x) => x.id === cmd.payload?.contact_id);
          if (w && c) fireRef.current(w, c);
        }
      })
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link?.unitId, link?.station]);

  // Integrated exercise: follow every ship of the fleet (positions + status)
  useEffect(() => {
    if (!exercise?.id) { setFleet([]); return; }
    const load = () => supabase.from("exercise_units").select("*").eq("exercise_id", exercise.id).then(({ data }) => setFleet(data ?? []));
    load();
    const ch = supabase.channel(`fleet-${exercise.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "exercise_units", filter: `exercise_id=eq.${exercise.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [exercise?.id]);

  // Command station publishes ship state for the instructor and other stations
  useEffect(() => {
    if (!link || !isCommand) return;
    const id = window.setInterval(() => {
      const s = shipRef.current;
      const ws = weaponsRef.current;
      const ammo_pct = (ws.reduce((a, w) => a + w.ammo / w.max_ammo, 0) / ws.length) * 100;
      const st = statsRef.current;
      const status = s.hull_integrity <= 0 ? "sunk" : s.hull_integrity < 25 || s.propulsion <= 0 || ammo_pct <= 1 ? "out_of_action" : "active";
      supabase.from("exercise_units").update({
        hull_integrity: s.hull_integrity, propulsion: s.propulsion, power: s.power, alert_level: s.alert_level,
        kills: st.kills, impacts: st.impacts, shots: st.shots, ammo_pct, weapons: ws as any, status, updated_at: new Date().toISOString(),
      }).eq("id", link.unitId).then();
    }, 2000);
    return () => window.clearInterval(id);
  }, [link?.unitId, isCommand]);

  // Load scenarios once
  useEffect(() => {
    supabase.from("scenarios").select("*").eq("is_template", true).order("created_at").then(({ data }) => {
      if (data) setScenarios(data as Scenario[]);
    });
  }, []);

  // Load contacts + events when scenario changes; also subscribe realtime
  useEffect(() => {
    if (!activeScenario) {
      setContacts([]);
      setEvents([]);
      return;
    }
    supabase.from("contacts").select("*").eq("scenario_id", activeScenario).then(({ data }) => {
      setContacts((data ?? []) as Contact[]);
    });
    supabase
      .from("tactical_events")
      .select("*")
      .eq("scenario_id", activeScenario)
      .order("created_at", { ascending: false })
      .limit(80)
      .then(({ data }) => setEvents((data ?? []) as TacticalEvent[]));

    const ch = supabase
      .channel(`scn-${activeScenario}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "contacts", filter: `scenario_id=eq.${activeScenario}` }, (p) => {
        if (p.eventType === "INSERT") setContacts((cs) => [...cs, p.new as Contact]);
        else if (p.eventType === "UPDATE")
          setContacts((cs) => cs.map((c) => (c.id === (p.new as Contact).id ? (p.new as Contact) : c)));
        else if (p.eventType === "DELETE") setContacts((cs) => cs.filter((c) => c.id !== (p.old as Contact).id));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tactical_events", filter: `scenario_id=eq.${activeScenario}` }, (p) => {
        setEvents((es) => [p.new as TacticalEvent, ...es].slice(0, 80));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [activeScenario]);

  const applyImpact = (c: { track_id: string; platform_type: string | null; domain: string; scenario_id: string | null; id?: string }, local: boolean) => {
    if (shipRef.current.hull_integrity <= 0) return;
    const dmg = IMPACT_DAMAGE[c.platform_type ?? ""] ?? 15;
    setStats((s) => ({ ...s, impacts: s.impacts + 1 }));
    const s0 = shipRef.current;
    const hull = Math.max(0, s0.hull_integrity - dmg);
    const nextShip: ShipSystem = {
      ...s0,
      hull_integrity: hull,
      propulsion: Math.max(0, s0.propulsion - dmg * 0.6),
      power: Math.max(0, s0.power - dmg * 0.5),
      cms_status: hull < 50 ? "degraded" : s0.cms_status,
    };
    shipRef.current = nextShip;
    setShip(nextShip);
    if (hull === 0) {
      toast.error("☠ BUQUE PERDIDO · fin del ejercicio. Pulse 'Reabastecer y reparar' para reiniciar.");
      endTrainingRef.current(true);
    }
    if (dmg >= 25) setSensors((ss) => ss.map((s, i) => (i === Math.floor(Math.random() * ss.length) ? { ...s, status: "degraded" } : s)));
    toast.error(`💥 IMPACTO · ${c.track_id} (${c.platform_type}) −${dmg}% casco`);
    if (local && c.id) {
      supabase.from("contacts").delete().eq("id", c.id).then();
      supabase.from("tactical_events").insert({
        scenario_id: c.scenario_id, contact_id: null, event_type: "impact", domain: c.domain, severity: "critical",
        message: `💥 IMPACTO EN PROPIA UNIDAD · ${c.track_id} (${c.platform_type}) · daño ${dmg}%`,
      }).then();
    }
  };
  applyImpactRef.current = applyImpact;

  // Auto TEWA only in COND I; list must be expressed relative to own ship
  const runAutoDefense = (list: Contact[]) => {
    if (!(autoRef.current && shipRef.current.alert_level === "red" && shipRef.current.hull_integrity > 0)) return;
    const threats = list
      .filter((c) => c.classification === "hostile" && c.status !== "engaged" && !engagedRef.current.has(c.id) && isDetected(c, sensorsRef.current))
      .sort((a, b) => (a.range_nm ?? 0) - (b.range_nm ?? 0))
      .slice(0, 3);
    for (const t of threats) {
      const w = pickWeapon(t, weaponsRef.current);
      if (w) fireRef.current(w, t, true);
    }
  };

  // Simulation loop — kinematics, attacker homing, impacts, auto-defense
  useEffect(() => {
    if (!activeScenario) {
      if (simRef.current) window.clearInterval(simRef.current);
      simRef.current = null;
      return;
    }
    simRef.current = window.setInterval(() => {
      if (integratedRef.current) {
        // Shared sea: smooth local motion only; the instructor station is authoritative (persists + resolves impacts)
        const units = fleetRef.current;
        const next = contactsRef.current.map((c) => {
          const t = c.target_unit_id ? units.find((u) => u.id === c.target_unit_id) : null;
          if (t && (c.status === "attacking" || c.status === "engaged")) return { ...c, ...advanceToward(c, Number(t.pos_x_nm), Number(t.pos_y_nm), 1.5) };
          return { ...c, ...advanceContact(c) };
        });
        contactsRef.current = next;
        setContacts(next);
        if (isCommandRef.current) runAutoDefense(next.map((c) => relativeTo(c, ownRef.current.x, ownRef.current.y)));
        return;
      }
      if (!isCommandRef.current) return;
      // Ship sunk: freeze the exercise and purge any remaining training threats
      if (shipRef.current.hull_integrity <= 0) {
        const left = contactsRef.current.filter((c) => (c.ai_reasoning ?? "").startsWith("ENTRENAMIENTO"));
        if (left.length) {
          const ids = left.map((c) => c.id);
          contactsRef.current = contactsRef.current.filter((c) => !ids.includes(c.id));
          setContacts(contactsRef.current);
          supabase.from("contacts").delete().in("id", ids).then();
        }
        return;
      }
      const next = contactsRef.current.map((c) =>
        c.status === "attacking" || (c.status === "engaged" && (c.ai_reasoning ?? "").startsWith("ENTRENAMIENTO"))
          ? { ...c, ...advanceAttacker(c, 1.5) }
          : { ...c, ...advanceContact(c) }
      );
      const impacts = next.filter((c) => (c.ai_reasoning ?? "").startsWith("ENTRENAMIENTO") && (c.range_nm ?? 99) <= 0.15);
      const survivors = next.filter((c) => !impacts.includes(c));
      contactsRef.current = survivors;
      setContacts(survivors);

      for (const c of impacts) applyImpactRef.current(c, true);

      runAutoDefense(survivors);
    }, 1500) as unknown as number;
    return () => {
      if (simRef.current) window.clearInterval(simRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScenario]);

  // Persist positions to backend so other consoles see movement
  useEffect(() => {
    if (!activeScenario) return;
    const id = window.setInterval(() => {
      if (!isCommandRef.current || integratedRef.current) return;
      contactsRef.current.forEach((c) => {
        supabase.from("contacts").update({ range_nm: c.range_nm, bearing: c.bearing, heading: c.heading }).eq("id", c.id).then();
      });
    }, link ? 2000 : 6000);
    return () => window.clearInterval(id);
  }, [activeScenario, link]);

  // Training: spawn attack waves
  useEffect(() => {
    if (!training || !activeScenario) return;
    const spawn = async () => {
      if (shipRef.current.hull_integrity <= 0) return;
      const wave = generateAttackWave(activeScenario, difficulty);
      setStats((s) => ({ ...s, waves: s.waves + 1 }));
      await supabase.from("contacts").insert(wave);
      await supabase.from("tactical_events").insert({
        scenario_id: activeScenario, event_type: "raid", domain: "mixed", severity: "critical",
        message: `🚨 RAID INBOUND · ${wave.length} amenaza(s): ${wave.map((w) => `${w.track_id} ${w.platform_type}`).join(", ")}`,
      });
      toast.error(`🚨 Raid inbound · ${wave.length} amenaza(s)`);
    };
    spawn();
    const id = window.setInterval(spawn, Math.max(8000, 22000 - difficulty * 3500));
    return () => window.clearInterval(id);
  }, [training, activeScenario, difficulty]);

  const activateScenario = async (id: string) => {
    setActiveScenario(id);
    setSelectedId(null);
    // Clear previous contacts for this scenario
    await supabase.from("contacts").delete().eq("scenario_id", id);
    await supabase.from("tactical_events").delete().eq("scenario_id", id);
    const scn = [...scenarios, ...(unitScenario ? [unitScenario] : [])].find((s) => s.id === id);
    const dom = (scn?.domain && scn.domain !== "mixed" ? (scn.domain as Domain) : undefined);
    const isDroneSwarm = scn?.name?.toLowerCase().includes("enjambre");
    const count = scn?.threat_level === "critical" ? 8 : scn?.threat_level === "high" ? 6 : 4;
    let seeds;
    const custom = Array.isArray((scn as any)?.threats) ? ((scn as any).threats as { platform: string; domain: Domain; count: number; hostile: boolean }[]) : [];
    if (custom.length) {
      seeds = custom.flatMap((t) => Array.from({ length: Math.min(20, t.count) }, () =>
        (t.hostile && attackerSeed(id, t.platform)) || { ...generateRandomContact(id, t.domain), domain: t.domain, platform_type: t.platform }
      ));
    } else if (isDroneSwarm) {
      seeds = [
        ...Array.from({ length: 3 }, () => ({ ...generateRandomContact(id, "air"), platform_type: "uav-kamikaze" })),
        ...Array.from({ length: 2 }, () => ({ ...generateRandomContact(id, "air"), platform_type: "loitering-munition" })),
        ...Array.from({ length: 3 }, () => ({ ...generateRandomContact(id, "surface"), platform_type: "usv-kamikaze" })),
        ...Array.from({ length: 2 }, () => ({ ...generateRandomContact(id, "subsurface"), platform_type: "uuv-recon" })),
      ];
    } else {
      seeds = Array.from({ length: count }, () => generateRandomContact(id, dom));
    }
    await supabase.from("contacts").insert(seeds);
    await supabase.from("tactical_events").insert({
      scenario_id: id,
      event_type: "scenario",
      domain: scn?.domain ?? "mixed",
      severity: "info",
      message: `Escenario activado: ${scn?.name}`,
    });
    toast.success(`Escenario "${scn?.name}" activado`);
  };

  const stop = async () => {
    if (!activeScenario) return;
    await supabase.from("contacts").delete().eq("scenario_id", activeScenario);
    setActiveScenario(null);
    toast.info("Simulación detenida");
  };

  const addManualContact = async () => {
    if (!activeScenario) return;
    const scn = scenarios.find((s) => s.id === activeScenario);
    const dom = scn?.domain && scn.domain !== "mixed" ? (scn.domain as Domain) : undefined;
    const c = generateRandomContact(activeScenario, dom);
    await supabase.from("contacts").insert(c);
    await supabase.from("tactical_events").insert({
      scenario_id: activeScenario,
      contact_id: null,
      event_type: "detection",
      domain: c.domain,
      severity: "info",
      message: `Nuevo contacto detectado ${c.track_id} (${c.domain})`,
    });
  };

  const classify = async (c: Contact) => {
    setClassifyingId(c.id);
    try {
      const { data, error } = await supabase.functions.invoke("classify-contact", {
        body: {
          contact: {
            track_id: c.track_id,
            domain: c.domain,
            bearing: c.bearing,
            range_nm: c.range_nm,
            speed_kts: c.speed_kts,
            altitude_ft: c.altitude_ft,
            heading: c.heading,
            signal_signature: c.platform_type,
          },
        },
      });
      if (error) throw error;
      const r = data?.result;
      if (!r) throw new Error("Sin resultado IA");
      await supabase.from("contacts").update({
        classification: r.classification,
        platform_type: r.platform_type,
        ai_confidence: r.ai_confidence,
        ai_reasoning: r.ai_reasoning,
      }).eq("id", c.id);
      await supabase.from("tactical_events").insert({
        scenario_id: c.scenario_id,
        contact_id: c.id,
        event_type: "classification",
        domain: c.domain,
        severity: r.classification === "hostile" ? "critical" : "info",
        message: `IA clasifica ${c.track_id} → ${r.classification.toUpperCase()} (${r.platform_type}). ${r.recommended_action ?? ""}`,
      });
      toast.success(`${c.track_id}: ${r.classification.toUpperCase()}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Error de clasificación IA");
    } finally {
      setClassifyingId(null);
    }
  };

  const openEngage = (c: Contact) => {
    setEngageContact(c);
    setEngageOpen(true);
  };

  const fireWeapon = async (w: Weapon, c: Contact, auto = false) => {
    setEngageOpen(false);
    if (shipRef.current.hull_integrity <= 0) { if (!auto) toast.error("Buque perdido · sistemas de armas inoperativos"); return; }
    if (c.status === "fleet" || c.status === "sunk") { toast.warning("Unidad propia de la flota · fuego bloqueado"); return; }
    const cur = weaponsRef.current.find((x) => x.id === w.id);
    if (!cur || cur.ammo <= 0) { toast.error(`${w.acronym} sin munición`); return; }
    const prevStatus = c.status;
    setStats((s) => ({ ...s, shots: s.shots + 1 }));
    const notify = (type: "fire" | "kill", payload: any) => {
      if (isCommandRef.current || !link || !unit) return;
      supabase.from("exercise_commands").insert({ exercise_id: unit.exercise_id, unit_id: link.unitId, command_type: type, payload, created_by: user!.id }).then();
    };
    notify("fire", { executed: true, weapon_id: w.id, cost: ammoCost(w), contact_id: c.id });
    setWeapons((ws) => ws.map((x) => (x.id === w.id ? { ...x, ammo: Math.max(0, x.ammo - ammoCost(w)) } : x)));
    setContacts((cs) => cs.map((x) => (x.id === c.id ? { ...x, status: "engaged" } : x)));
    engagedRef.current.add(c.id);
    supabase.from("contacts").update({ status: "engaged" }).eq("id", c.id).then();
    const tof = ((c.range_nm ?? 0) / Math.max(1, w.speed_kts)) * 3600;
    supabase.from("tactical_events").insert({
      scenario_id: c.scenario_id,
      contact_id: c.id,
      event_type: "engagement",
      domain: c.domain,
      severity: "critical",
      message: `🔥 ${auto ? "AUTO-TEWA" : "WEAPONS RELEASE"} · ${w.acronym} → ${c.track_id} · ToF ${tof.toFixed(1)}s · pk ${Math.round(w.pk * 100)}%`,
    }).then();
    if (!auto) toast.error(`${w.acronym} fired @ ${c.track_id}`);

    setTimeout(async () => {
      engagedRef.current.delete(c.id);
      if (!contactsRef.current.some((x) => x.id === c.id)) return; // already impacted/destroyed
      const hit = Math.random() < w.pk;
      if (hit) {
        setContacts((cs) => cs.filter((x) => x.id !== c.id));
        setStats((s) => ({ ...s, kills: s.kills + 1 }));
        notify("kill", { contact_id: c.id });
        await supabase.from("contacts").delete().eq("id", c.id);
        await supabase.from("tactical_events").insert({
          scenario_id: c.scenario_id,
          contact_id: null,
          event_type: "splash",
          domain: c.domain,
          severity: "info",
          message: `💥 SPLASH · ${c.track_id} destruido por ${w.acronym}`,
        });
        toast.success(`Splash ${c.track_id}`);
        setSelectedId((s) => (s === c.id ? null : s));
      } else {
        const back = prevStatus === "attacking" ? "attacking" : "tracking";
        setContacts((cs) => cs.map((x) => (x.id === c.id ? { ...x, status: back } : x)));
        await supabase.from("contacts").update({ status: back }).eq("id", c.id);
        await supabase.from("tactical_events").insert({
          scenario_id: c.scenario_id,
          contact_id: c.id,
          event_type: "miss",
          domain: c.domain,
          severity: "warning",
          message: `⚠ MISS · ${w.acronym} falló contra ${c.track_id}`,
        });
        toast.warning(`Miss ${c.track_id} · reattack`);
      }
    }, Math.min(4000, Math.max(800, tof * 100)));
  };

  const endTraining = (lost = false) => {
    setTraining(false);
    setAutoDefense(false);
    autoRef.current = false;
    const trainees = contactsRef.current.filter((c) => (c.ai_reasoning ?? "").startsWith("ENTRENAMIENTO"));
    const ids = trainees.map((c) => c.id);
    contactsRef.current = contactsRef.current.filter((c) => !ids.includes(c.id));
    setContacts(contactsRef.current);
    if (ids.length) supabase.from("contacts").delete().in("id", ids).then();
    if (activeScenario) {
      supabase.from("tactical_events").insert({
        scenario_id: activeScenario, event_type: "training_end", domain: "mixed", severity: lost ? "critical" : "info",
        message: lost ? "☠ EJERCICIO FINALIZADO · BUQUE PERDIDO" : "Ejercicio de entrenamiento detenido · amenazas retiradas",
      }).then();
    }
    if (!lost) toast.info("Entrenamiento detenido · amenazas retiradas");
  };
  endTrainingRef.current = endTraining;

  const rearm = () => {
    setWeapons(INITIAL_WEAPONS);
    setSensors(INITIAL_SENSORS);
    setShip((s) => ({ ...INITIAL_SHIP, alert_level: s.alert_level, cms_status: s.cms_status }));
    setStats({ kills: 0, impacts: 0, waves: 0, shots: 0 });
    toast.success("Pañoles reabastecidos · daños reparados");
  };

  fireRef.current = fireWeapon;
  setAlertRef.current = (l, f) => { setAlertLevel(l, f); };
  rearmRef.current = rearm;

  // Any station may request fire; the command station executes it so ammo stays consistent
  const requestFire = async (w: Weapon, c: Contact) => {
    if (isCommand) return fireWeapon(w, c);
    const myDomain = link?.station === "aaw" ? "air" : link?.station === "asuw" ? "surface" : link?.station === "asw" ? "subsurface" : "electronic";
    if (w.domain !== myDomain) return toast.warning("Su puesto solo controla las armas de su guerra");
    // Station fires directly; the command station is notified to keep the shared magazine count
    fireWeapon(w, c);
  };

  const shadow = async (c: Contact) => {
    const next = c.status === "shadow" ? "tracking" : "shadow";
    await supabase.from("contacts").update({ status: next }).eq("id", c.id);
    await supabase.from("tactical_events").insert({
      scenario_id: c.scenario_id,
      contact_id: c.id,
      event_type: "shadow",
      domain: c.domain,
      severity: "info",
      message: next === "shadow"
        ? `Track ${c.track_id} en SHADOW · seguimiento prioritario`
        : `Track ${c.track_id} fuera de SHADOW`,
    });
    toast.success(next === "shadow" ? `${c.track_id} en SHADOW` : `${c.track_id} liberado`);
  };

  const jam = async (c: Contact) => {
    if (c.domain !== "electronic" && c.domain !== "air") {
      toast.warning("JAM solo aplica a emisores aéreos/electrónicos");
      return;
    }
    await supabase.from("tactical_events").insert({
      scenario_id: c.scenario_id,
      contact_id: c.id,
      event_type: "jamming",
      domain: c.domain,
      severity: "warning",
      message: `EW activa jamming sobre ${c.track_id} · degradando guidance`,
    });
    // simulate effect: reduce speed/heading deviation
    await supabase.from("contacts").update({
      speed_kts: Math.max(0, (c.speed_kts ?? 0) * 0.6),
      heading: ((c.heading ?? 0) + 45) % 360,
      status: "jammed",
    }).eq("id", c.id);
    toast.success(`Jamming activo sobre ${c.track_id}`);
  };

  const classifyAll = async () => {
    const unknowns = contacts.filter((c) => c.classification === "unknown");
    if (unknowns.length === 0) {
      toast.info("No hay contactos sin clasificar");
      return;
    }
    toast.info(`Clasificando ${unknowns.length} contactos...`);
    for (const c of unknowns) {
      await classify(c);
    }
  };

  const toggleSensor = (id: string) => {
    setSensors((ss) => ss.map((s) => {
      if (s.id !== id) return s;
      const next = s.status === "online" ? "standby" : "online";
      if (s.status === "degraded" || s.status === "offline") toast.success(`${s.acronym} reparado · en servicio`);
      return { ...s, status: next };
    }));
  };

  const setAlertLevel = async (lvl: ShipSystem["alert_level"], fromStation = false) => {
    if (!isCommandRef.current && link && unit) {
      // Subordinate station: apply locally and order the command station to set the same condition
      setShip((s) => ({ ...s, alert_level: lvl }));
      supabase.from("exercise_commands").insert({ exercise_id: unit.exercise_id, unit_id: link.unitId, command_type: "alert", payload: { level: lvl }, created_by: user!.id }).then();
      toast.success(`Condición ${lvl === "red" ? "I" : lvl === "yellow" ? "II" : "III"} ordenada para todo el buque`);
      return;
    }
    if (fromStation && shipRef.current.alert_level === lvl) return;
    setShip((s) => ({ ...s, alert_level: lvl, cms_status: lvl === "red" ? "battle" : lvl === "yellow" ? "degraded" : "nominal" }));
    if (activeScenario) {
      await supabase.from("tactical_events").insert({
        scenario_id: activeScenario,
        event_type: "battle_stations",
        domain: "mixed",
        severity: lvl === "red" ? "critical" : "info",
        message: `BATTLE STATIONS · CONDICIÓN ${lvl === "white" ? "III" : lvl === "yellow" ? "II" : "I"}`,
      });
    }
    toast[lvl === "red" ? "error" : "success"](`Condición de alerta ${lvl.toUpperCase()}`);
  };

  const [radarRange, setRadarRange] = useState<number>(40);
  const [showWeaponRings, setShowWeaponRings] = useState(true);
  const [viewMode, setViewMode] = useState<"ppi" | "chart">("ppi");

  const displayContacts = useMemo<Contact[]>(() => {
    if (!link || !fleet.length) return contacts;
    const { x, y } = { x: Number(unit?.pos_x_nm ?? 0), y: Number(unit?.pos_y_nm ?? 0) };
    const local = integrated ? contacts.map((c) => relativeTo(c, x, y)) : contacts;
    const ships = fleet.filter((u) => u.id !== unit?.id).map((u) => {
      const rel = relativeTo({ range_nm: Math.hypot(Number(u.pos_x_nm), Number(u.pos_y_nm)), bearing: ((Math.atan2(Number(u.pos_x_nm), Number(u.pos_y_nm)) * 180) / Math.PI + 360) % 360 }, x, y);
      return {
        id: `unit-${u.id}`, scenario_id: exercise?.scenario_id ?? null, track_id: u.name, domain: "surface", classification: "friend",
        platform_type: u.status === "sunk" ? "frigate · HUNDIDO" : "frigate · FLOTA", bearing: rel.bearing, range_nm: rel.range_nm,
        speed_kts: 0, altitude_ft: 0, heading: 0, ai_confidence: 1, ai_reasoning: `Unidad propia de la flota · casco ${Math.round(Number(u.hull_integrity))}%`,
        status: u.status === "sunk" ? "sunk" : "fleet", created_at: u.created_at, updated_at: u.updated_at,
      } as Contact;
    });
    return [...local, ...ships];
  }, [contacts, integrated, link, fleet, unit?.id, unit?.pos_x_nm, unit?.pos_y_nm, exercise?.scenario_id]);
  displayRef.current = displayContacts;
  const visibleContacts = useMemo(() => displayContacts.filter((c) => c.status === "fleet" || c.status === "sunk" || isDetected(c, sensors)), [displayContacts, sensors]);
  const selected = useMemo(() => visibleContacts.find((c) => c.id === selectedId) ?? null, [visibleContacts, selectedId]);
  const filteredContacts = tab === "ALL" ? visibleContacts : visibleContacts.filter((c) => c.domain === tab);

  const now = new Date().toLocaleTimeString("es-CO", { hour12: false });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-hud-bg/80 backdrop-blur sticky top-0 z-20">
        <div className="container py-2 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-8 bg-gradient-amber shadow-glow-amber" />
            <div>
              <h1 className="font-display text-base text-primary glow-amber">SISTEMA TCM · ARC FRIGATA</h1>
              <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-accent/80">
                Tactical Combat Manager · AAW · ASuW · ASW · EW · IA Llama+YOLO
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 font-mono text-xs">
            {user && (
              <UnitLinkBar userId={user.id} link={link} unitName={unit?.name} exerciseName={exerciseName}
                onLink={(l) => { setLink(l); if (!l) { setActiveScenario(null); setTab("ALL"); } }} />
            )}
            {isInstructor && <Link to="/master" className="text-primary hover:underline">Puesto Maestro</Link>}
            <button onClick={signOut} className="text-muted-foreground hover:text-accent">Salir</button>
            <div className="text-muted-foreground">
              UTC <span className="text-foreground">{now}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-threat-friend animate-pulse" />
              <span className="text-threat-friend">SYS NOMINAL</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-4 space-y-3">
        {link && unit?.status === "sunk" && (
          <div className="hud-panel p-2 text-center font-mono text-xs text-destructive border-destructive animate-blink-alert">☠ {unit.name} HUNDIDO · FUERA DEL EJERCICIO</div>
        )}
        {link && !isCommand && (
          <div className="hud-panel p-2 font-mono text-[11px] text-muted-foreground">Puesto subordinado · la simulación la controla el puesto de Mando de {unit?.name}. Sus órdenes de fuego se envían al Mando.</div>
        )}
        {link && integrated && (
          <div className="hud-panel p-2 font-mono text-[11px] text-accent">Ejercicio INTEGRADO · {fleet.length} buques en el mismo mar · las amenazas las lanza el instructor. Puede defender a otros buques si la amenaza está a su alcance.</div>
        )}
        {isCommand && !integrated && <ScenarioBar
          scenarios={link ? (unitScenario ? [unitScenario] : []) : scenarios}
          activeId={activeScenario}
          onActivate={activateScenario}
          onStop={stop}
          onAddContact={addManualContact}
          onClassifyAll={classifyAll}
          running={!!activeScenario}
        />}

        <DomainStatus contacts={visibleContacts} />

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
          <aside className="xl:col-span-2 space-y-3">
            {isCommand && <TrainingPanel
              training={training}
              autoDefense={autoDefense}
              difficulty={difficulty}
              stats={stats}
              running={!!activeScenario}
              sunk={ship.hull_integrity <= 0}
              onToggleTraining={() => {
                if (training) return endTraining();
                if (integrated) return toast.info("En ejercicio integrado los ataques los lanza el instructor");
                if (ship.hull_integrity <= 0) return toast.error("Buque perdido · pulse 'Reabastecer y reparar' primero");
                setTraining(true);
                toast.error("⚠ ENTRENAMIENTO · Amenazas inbound");
              }}
              onToggleAuto={() => setAutoDefense((a) => !a)}
              onDifficulty={setDifficulty}
              onRearm={rearm}
            />}
            <ShipStatusPanel ship={ship} onAlertChange={setAlertLevel} />
            <SensorsPanel sensors={sensors} onToggle={toggleSensor} />
            <div className="hud-panel p-2 text-[10px] font-mono text-muted-foreground">
              Tracks sostenidos: <span className="text-accent">{visibleContacts.length}</span> / {contacts.length}
            </div>
          </aside>

          <section className="xl:col-span-8">
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
              <TabsList className="bg-card/60 border border-border h-auto p-1 flex-wrap">
                {TAB_DOMAINS.map((t) => {
                  const Icon = t.icon;
                  return (
                    <TabsTrigger
                      key={t.key}
                      value={t.key}
                      className="font-mono uppercase text-xs tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-glow-amber"
                    >
                      <Icon className="w-3.5 h-3.5 mr-1.5" />
                      {t.label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {TAB_DOMAINS.map((t) => (
                <TabsContent key={t.key} value={t.key} className="mt-3">
                  <div className="space-y-3">
                    {/* View toggle */}
                    <div className="flex justify-center">
                      <div className="hud-panel inline-flex p-1 gap-1">
                        <button
                          onClick={() => setViewMode("ppi")}
                          className={`px-3 py-1 text-[11px] font-mono uppercase tracking-wider rounded ${viewMode === "ppi" ? "bg-primary text-primary-foreground shadow-glow-amber" : "text-muted-foreground hover:text-accent"}`}
                        >
                          PPI · Radar Táctico
                        </button>
                        <button
                          onClick={() => setViewMode("chart")}
                          className={`px-3 py-1 text-[11px] font-mono uppercase tracking-wider rounded ${viewMode === "chart" ? "bg-primary text-primary-foreground shadow-glow-amber" : "text-muted-foreground hover:text-accent"}`}
                        >
                          Carta Náutica Global
                        </button>
                      </div>
                    </div>

                    {/* Radar / Chart centered & large */}
                    <div className="flex justify-center">
                      <div className="w-full max-w-[820px]">
                        {viewMode === "ppi" ? (
                          <TacticalRadar
                            contacts={visibleContacts}
                            filterDomain={t.key === "ALL" ? "all" : t.key}
                            selectedId={selectedId}
                            onSelect={setSelectedId}
                            rangeNm={radarRange}
                            onRangeChange={setRadarRange}
                            weapons={weapons}
                            showWeaponRings={showWeaponRings}
                            onToggleWeaponRings={() => setShowWeaponRings((v) => !v)}
                          />
                        ) : (
                          <NauticalChart
                            contacts={visibleContacts}
                            filterDomain={t.key === "ALL" ? "all" : t.key}
                            selectedId={selectedId}
                            onSelect={setSelectedId}
                            weapons={weapons}
                            showWeaponRings={showWeaponRings}
                          />
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
                      <div className="xl:col-span-4">
                        <ContactList
                          contacts={filteredContacts}
                          selectedId={selectedId}
                          onSelect={setSelectedId}
                          onClassify={classify}
                          classifyingId={classifyingId}
                        />
                      </div>
                      <div className="xl:col-span-4">
                        <ContactDetail
                          contact={selected}
                          onEngage={openEngage}
                          onShadow={shadow}
                          onJam={jam}
                          onClassify={classify}
                          classifying={classifyingId === selected?.id}
                        />
                      </div>
                      <div className="xl:col-span-4">
                        <EventLog events={t.key === "ALL" ? events : events.filter((e) => e.domain === t.key)} />
                      </div>
                    </div>

                    <VisualIntelPanel
                      contacts={visibleContacts}
                      onSelectTrack={setSelectedId}
                      onApplyClassification={async (trackId, det) => {
                        const c = contacts.find((x) => x.track_id === trackId);
                        if (!c) return;
                        await supabase.from("contacts").update({
                          classification: det.classification,
                          platform_type: det.label,
                          ai_confidence: det.confidence,
                          ai_reasoning: `Visual ID (Gemini 2.5 Pro): ${det.behavior ?? det.label}. ${det.recommended_action}`,
                        }).eq("id", c.id);
                        await supabase.from("tactical_events").insert({
                          scenario_id: c.scenario_id,
                          contact_id: c.id,
                          event_type: "visual_id",
                          domain: c.domain,
                          severity: det.classification === "hostile" ? "critical" : "info",
                          message: `📷 VISUAL ID · ${c.track_id} → ${det.label} (${det.classification.toUpperCase()}) conf ${(det.confidence*100).toFixed(0)}%`,
                        });
                        toast.success(`${c.track_id} actualizado por Visual ID`);
                      }}
                    />
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </section>

          <aside className="xl:col-span-2">
            <WeaponsPanel
              weapons={weapons}
              filter={tab === "ALL" ? "all" : tab}
              onSelect={(w) => {
                if (!selected) return toast.warning("Seleccione un contacto antes de disparar");
                if (w.domain !== selected.domain) return toast.warning(`${w.acronym} no aplica a dominio ${selected.domain}`);
                if (w.ammo <= 0) return toast.error(`${w.acronym} sin munición`);
                if ((selected.range_nm ?? 0) > w.range_nm) return toast.warning(`${selected.track_id} fuera de alcance (${(selected.range_nm ?? 0).toFixed(1)} > ${w.range_nm} NM)`);
                requestFire(w, selected);
              }}
            />
          </aside>
        </div>

        <EngagementDialog
          open={engageOpen}
          contact={engageContact}
          weapons={weapons}
          onClose={() => setEngageOpen(false)}
          onFire={requestFire}
        />

        <footer className="text-center text-[10px] font-mono uppercase tracking-[0.3em] text-muted-foreground pt-4">
          ARMADA NACIONAL DE COLOMBIA · DEMOSTRADOR · NO APTO PARA OPERACIONES REALES
        </footer>
      </main>
    </div>
  );
};

export default Index;
