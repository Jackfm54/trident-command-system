import { useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Contact } from "@/types/tactical";
import { toast } from "sonner";
import { Camera, Upload, Eye, Crosshair, Loader2, Sparkles, AlertTriangle } from "lucide-react";

interface Detection {
  label: string;
  domain: "air" | "surface" | "subsurface" | "electronic";
  classification: "hostile" | "friend" | "neutral" | "suspect" | "unknown" | "assumed_friend";
  confidence: number;
  visible_armament?: string;
  estimated_length_m?: number;
  flag_or_markings?: string;
  behavior?: string;
  bbox_norm?: number[];
  correlated_track_id?: string;
  correlation_reasoning?: string;
  threat_score: number;
  recommended_action: string;
}

interface VisualReport {
  scene_summary: string;
  sea_state?: string;
  detections: Detection[];
  overall_threat_level: "low" | "medium" | "high" | "critical";
  recommended_alert_condition: "white" | "yellow" | "red";
}

interface Props {
  contacts: Contact[];
  onSelectTrack?: (id: string) => void;
  onApplyClassification?: (track_id: string, det: Detection) => void;
}

const CLASS_COLOR: Record<string, string> = {
  hostile: "text-threat-hostile border-threat-hostile",
  friend: "text-threat-friend border-threat-friend",
  neutral: "text-threat-neutral border-threat-neutral",
  suspect: "text-orange-400 border-orange-400",
  unknown: "text-muted-foreground border-muted-foreground",
  assumed_friend: "text-green-400 border-green-400",
};

const SENSORS = ["EO/IR Bow", "EO/IR Mast", "SAR Strip", "ISAR", "Periscope EO"];

export function VisualIntelPanel({ contacts, onSelectTrack, onApplyClassification }: Props) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgB64, setImgB64] = useState<string | null>(null);
  const [imgMime, setImgMime] = useState<string>("image/jpeg");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<VisualReport | null>(null);
  const [sensor, setSensor] = useState(SENSORS[0]);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    setReport(null);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImgUrl(dataUrl);
      setImgMime(f.type || "image/jpeg");
      setImgB64(dataUrl.split(",")[1] ?? null);
    };
    reader.readAsDataURL(f);
  };

  const analyze = async () => {
    if (!imgB64) {
      toast.warning("Carga una imagen del sensor primero");
      return;
    }
    setLoading(true);
    setReport(null);
    try {
      const { data, error } = await supabase.functions.invoke("visual-detect", {
        body: {
          image_base64: imgB64,
          mime_type: imgMime,
          sensor,
          contacts: contacts.map((c) => ({
            track_id: c.track_id,
            domain: c.domain,
            bearing: c.bearing,
            range_nm: c.range_nm,
            speed_kts: c.speed_kts,
            heading: c.heading,
            classification: c.classification,
            platform_type: c.platform_type,
          })),
        },
      });
      if (error) throw error;
      const r = data?.result as VisualReport;
      if (!r) throw new Error("Sin reporte");
      setReport(r);
      toast.success(`Visual ID · ${r.detections.length} detecciones · ${r.overall_threat_level.toUpperCase()}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Error de IA visual");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="hud-panel p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-primary glow-amber" />
          <span className="hud-label">VISUAL ID · Gemini 2.5 Pro Vision</span>
        </div>
        <Badge variant="outline" className="font-mono text-[9px] border-accent text-accent">
          <Sparkles className="w-3 h-3 mr-1" />MULTIMODAL AI
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={sensor}
          onChange={(e) => setSensor(e.target.value)}
          className="bg-card border border-border rounded px-2 py-1 text-xs font-mono text-foreground"
        >
          {SENSORS.map((s) => <option key={s}>{s}</option>)}
        </select>
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} className="h-7 text-xs">
          <Upload className="w-3 h-3 mr-1" /> Cargar imagen
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <Button size="sm" onClick={analyze} disabled={!imgB64 || loading} className="h-7 text-xs bg-primary text-primary-foreground">
          {loading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Eye className="w-3 h-3 mr-1" />}
          {loading ? "Analizando..." : "Analizar con IA"}
        </Button>
      </div>

      {/* Image with bbox overlay */}
      <div className="relative rounded border border-border overflow-hidden bg-black/40 aspect-video flex items-center justify-center">
        {imgUrl ? (
          <>
            <img src={imgUrl} alt="sensor" className="absolute inset-0 w-full h-full object-contain" />
            {report?.detections.map((d, i) => {
              if (!d.bbox_norm || d.bbox_norm.length !== 4) return null;
              const [x, y, w, h] = d.bbox_norm;
              const color =
                d.classification === "hostile" ? "hsl(var(--threat-hostile))" :
                d.classification === "friend" ? "hsl(var(--threat-friend))" :
                d.classification === "suspect" ? "#fb923c" :
                "hsl(var(--threat-neutral))";
              return (
                <div
                  key={i}
                  className="absolute border-2 font-mono text-[10px] font-bold"
                  style={{
                    left: `${x * 100}%`,
                    top: `${y * 100}%`,
                    width: `${w * 100}%`,
                    height: `${h * 100}%`,
                    borderColor: color,
                    boxShadow: `0 0 8px ${color}`,
                  }}
                >
                  <div
                    className="absolute -top-5 left-0 px-1.5 py-0.5 whitespace-nowrap"
                    style={{ background: color, color: "#000" }}
                  >
                    {d.label} · {(d.confidence * 100).toFixed(0)}%
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          <div className="text-center text-muted-foreground text-xs font-mono p-6">
            <Camera className="w-10 h-10 mx-auto mb-2 opacity-40" />
            Carga imagen EO/IR/SAR para análisis IA
          </div>
        )}
      </div>

      {report && (
        <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
          <div className="hud-panel p-2 text-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="hud-label">SCENE INTEL</span>
              <Badge
                variant="outline"
                className={`font-mono text-[10px] ${
                  report.overall_threat_level === "critical" ? "border-threat-hostile text-threat-hostile" :
                  report.overall_threat_level === "high" ? "border-orange-400 text-orange-400" :
                  report.overall_threat_level === "medium" ? "border-threat-neutral text-threat-neutral" :
                  "border-threat-friend text-threat-friend"
                }`}
              >
                <AlertTriangle className="w-3 h-3 mr-1" />
                {report.overall_threat_level.toUpperCase()} · COND {report.recommended_alert_condition.toUpperCase()}
              </Badge>
            </div>
            <p className="text-foreground/90">{report.scene_summary}</p>
            {report.sea_state && (
              <p className="text-muted-foreground text-[10px] mt-1">{report.sea_state}</p>
            )}
          </div>

          {report.detections.map((d, i) => {
            const correlated = d.correlated_track_id && contacts.find((c) => c.track_id === d.correlated_track_id);
            return (
              <div key={i} className={`hud-panel p-2 border-l-2 ${CLASS_COLOR[d.classification]}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-foreground">{d.label}</span>
                      <Badge variant="outline" className={`text-[9px] font-mono ${CLASS_COLOR[d.classification]}`}>
                        {d.classification.toUpperCase()}
                      </Badge>
                      <span className="text-[9px] font-mono text-muted-foreground uppercase">{d.domain}</span>
                      <span className="text-[9px] font-mono text-accent">conf {(d.confidence * 100).toFixed(0)}%</span>
                      <span className={`text-[9px] font-mono ${d.threat_score >= 7 ? "text-threat-hostile" : d.threat_score >= 4 ? "text-orange-400" : "text-threat-friend"}`}>
                        T{d.threat_score.toFixed(1)}
                      </span>
                    </div>
                    {(d.visible_armament || d.estimated_length_m || d.flag_or_markings) && (
                      <div className="text-[10px] font-mono text-muted-foreground mt-1 space-x-2">
                        {d.estimated_length_m && <span>L≈{d.estimated_length_m}m</span>}
                        {d.visible_armament && <span>· ARM: {d.visible_armament}</span>}
                        {d.flag_or_markings && <span>· {d.flag_or_markings}</span>}
                      </div>
                    )}
                    {d.behavior && (
                      <div className="text-[10px] font-mono text-foreground/80 mt-0.5">→ {d.behavior}</div>
                    )}
                    <div className="text-[10px] font-mono text-primary mt-1">
                      ROE: {d.recommended_action}
                    </div>
                    {correlated ? (
                      <button
                        onClick={() => onSelectTrack?.(correlated.id)}
                        className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border border-accent text-accent hover:bg-accent hover:text-background"
                      >
                        <Crosshair className="w-3 h-3" />
                        MATCH → {correlated.track_id}
                      </button>
                    ) : d.correlated_track_id ? (
                      <div className="text-[10px] font-mono text-muted-foreground mt-1">
                        Sugerido: {d.correlated_track_id} (sin match en CMS)
                      </div>
                    ) : (
                      <div className="text-[10px] font-mono text-muted-foreground mt-1">
                        Sin correlación con tracks activos
                      </div>
                    )}
                    {d.correlation_reasoning && (
                      <div className="text-[10px] font-mono text-muted-foreground/80 italic mt-0.5">
                        {d.correlation_reasoning}
                      </div>
                    )}
                  </div>
                  {correlated && onApplyClassification && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] font-mono"
                      onClick={() => onApplyClassification(correlated.track_id, d)}
                    >
                      Aplicar
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
