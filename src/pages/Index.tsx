import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Contact, Scenario, TacticalEvent, Domain, DOMAIN_META } from "@/types/tactical";
import { advanceContact, generateRandomContact } from "@/lib/simulator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TacticalRadar } from "@/components/tactical/TacticalRadar";
import { ContactList } from "@/components/tactical/ContactList";
import { ContactDetail } from "@/components/tactical/ContactDetail";
import { EventLog } from "@/components/tactical/EventLog";
import { ScenarioBar } from "@/components/tactical/ScenarioBar";
import { DomainStatus } from "@/components/tactical/DomainStatus";
import { toast } from "sonner";
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
  const simRef = useRef<number | null>(null);

  // Load scenarios once
  useEffect(() => {
    supabase.from("scenarios").select("*").order("created_at").then(({ data }) => {
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

  // Simulation loop — advance positions locally + occasional spawn
  useEffect(() => {
    if (!activeScenario) {
      if (simRef.current) window.clearInterval(simRef.current);
      simRef.current = null;
      return;
    }
    simRef.current = window.setInterval(() => {
      setContacts((cs) =>
        cs.map((c) => {
          const upd = advanceContact(c);
          return { ...c, ...upd };
        })
      );
    }, 1500) as unknown as number;
    return () => {
      if (simRef.current) window.clearInterval(simRef.current);
    };
  }, [activeScenario]);

  const activateScenario = async (id: string) => {
    setActiveScenario(id);
    setSelectedId(null);
    // Clear previous contacts for this scenario
    await supabase.from("contacts").delete().eq("scenario_id", id);
    await supabase.from("tactical_events").delete().eq("scenario_id", id);
    const scn = scenarios.find((s) => s.id === id);
    const dom = (scn?.domain && scn.domain !== "mixed" ? (scn.domain as Domain) : undefined);
    // seed initial contacts based on threat level
    const count = scn?.threat_level === "critical" ? 8 : scn?.threat_level === "high" ? 6 : 4;
    const seeds = Array.from({ length: count }, () => generateRandomContact(id, dom));
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

  const engage = async (c: Contact) => {
    await supabase.from("contacts").update({ status: "engaged" }).eq("id", c.id);
    await supabase.from("tactical_events").insert({
      scenario_id: c.scenario_id,
      contact_id: c.id,
      event_type: "engagement",
      domain: c.domain,
      severity: "critical",
      message: `WEAPONS RELEASE sobre ${c.track_id} (${c.platform_type})`,
    });
    toast.error(`Engaged ${c.track_id}`);
  };

  const selected = useMemo(() => contacts.find((c) => c.id === selectedId) ?? null, [contacts, selectedId]);
  const filteredContacts = tab === "ALL" ? contacts : contacts.filter((c) => c.domain === tab);

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
        <ScenarioBar
          scenarios={scenarios}
          activeId={activeScenario}
          onActivate={activateScenario}
          onStop={stop}
          onAddContact={addManualContact}
          running={!!activeScenario}
        />

        <DomainStatus contacts={contacts} />

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
                <div className="xl:col-span-5">
                  <TacticalRadar
                    contacts={contacts}
                    filterDomain={t.key === "ALL" ? "all" : t.key}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                  />
                </div>
                <div className="xl:col-span-3 flex flex-col gap-3">
                  <ContactDetail contact={selected} onEngage={engage} />
                </div>
              </div>
              <div className="mt-3">
                <EventLog events={t.key === "ALL" ? events : events.filter((e) => e.domain === t.key)} />
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <footer className="text-center text-[10px] font-mono uppercase tracking-[0.3em] text-muted-foreground pt-4">
          ARMADA NACIONAL DE COLOMBIA · DEMOSTRADOR · NO APTO PARA OPERACIONES REALES
        </footer>
      </main>
    </div>
  );
};

export default Index;
