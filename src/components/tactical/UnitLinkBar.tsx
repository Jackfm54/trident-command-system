import { t as tr, translateText, locale, useLanguage } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Link2, Unlink } from "lucide-react";

export type UnitLink = { unitId: string; station: string };
export const STATIONS = [
  { key: "command", label: "Mando · controla el buque completo" },
  { key: "aaw", label: "AAW · Antiaérea" },
  { key: "asuw", label: "ASuW · Superficie" },
  { key: "asw", label: "ASW · Submarina" },
  { key: "ew", label: "EW · Electrónica" },
];

interface Props {
  userId: string;
  link: UnitLink | null;
  unitName?: string;
  exerciseName?: string;
  onLink: (l: UnitLink | null) => void;
}

export function UnitLinkBar({ userId, link, unitName, exerciseName, onLink }: Props) {
  useLanguage();
  const [open, setOpen] = useState(false);
  const [exercises, setExercises] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [exId, setExId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [station, setStation] = useState("command");

  useEffect(() => {
    if (!open) return;
    supabase.from("exercises").select("*").neq("status", "ended").order("created_at", { ascending: false }).then(({ data }) => {
      setExercises(data ?? []);
      if (data?.length) setExId((x) => x || data[0].id);
    });
  }, [open]);

  useEffect(() => {
    if (!exId) return;
    supabase.from("exercise_units").select("*").eq("exercise_id", exId).order("created_at").then(({ data }) => {
      setUnits(data ?? []);
      setUnitId(data?.[0]?.id ?? "");
    });
  }, [exId]);

  const join = async () => {
    if (!unitId) return toast.warning(tr("Seleccione un buque"));
    const { error } = await supabase.from("unit_members").upsert({ unit_id: unitId, user_id: userId, station }, { onConflict: "unit_id,user_id" });
    if (error) return toast.error(error.message);
    onLink({ unitId, station });
    setOpen(false);
    toast.success(tr("Consola enlazada al ejercicio"));
  };

  const leave = async () => {
    if (link) await supabase.from("unit_members").delete().eq("unit_id", link.unitId).eq("user_id", userId);
    onLink(null);
    toast.info(tr("Consola desenlazada · modo individual"));
  };

  const sel = "w-full bg-input border border-border rounded px-2 py-2 text-xs font-mono";

  return (
    <>
       {link ? (
        <div className="flex items-center gap-2">
           <span className="text-accent">{exerciseName} · {unitName} · {STATIONS.find((s) => s.key === link.station)?.label.split(" ·")[0]}</span>
           <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={leave}><Unlink className="w-3 h-3 mr-1" />{tr("Salir")}</Button>
         </div>
      ) : (
        <Button size="sm" variant="outline" className="h-7 text-xs font-mono" onClick={() => setOpen(true)}><Link2 className="w-3 h-3 mr-1" />{tr("Unirse a ejercicio")}</Button>
      )}
       <Dialog open={open} onOpenChange={setOpen}>
         <DialogContent>
           <DialogHeader><DialogTitle className="font-display text-primary">{tr("Unirse a ejercicio")}</DialogTitle></DialogHeader>
           {exercises.length === 0 ? (
            <p className="text-xs font-mono text-muted-foreground">{tr("No hay ejercicios abiertos. El instructor debe crearlos en el Puesto Maestro.")}</p>
          ) : (
            <div className="space-y-3">
               <select className={sel} value={exId} onChange={(e) => setExId(e.target.value)}>
                 {exercises.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
               </select>
               <select className={sel} value={unitId} onChange={(e) => setUnitId(e.target.value)}>
                 {units.length === 0 && <option value="">{tr("Sin buques")}</option>}
                 {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
               </select>
               <select className={sel} value={station} onChange={(e) => setStation(e.target.value)}>
                 {STATIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
               </select>
               <p className="text-[10px] font-mono text-muted-foreground">{tr("Cada buque necesita un puesto de Mando: es el que mueve la simulación. Los demás puestos ven el mismo buque y disparan las armas de su guerra.")}</p>
               <Button className="w-full font-mono" onClick={join}>{tr("Enlazar consola")}</Button>
             </div>
          )}
         </DialogContent>
       </Dialog>
     </>
  );
}
