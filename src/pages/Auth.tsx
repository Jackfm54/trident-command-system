import logoAsset from "@/assets/poseidon.jpeg.asset.json";
import { useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function Auth() {
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { display_name: name || email.split("@")[0] } },
        });
        if (error) throw error;
        toast.success("Cuenta creada. Revise su correo para confirmarla y luego ingrese.");
        setMode("in");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Error de autenticación");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <form onSubmit={submit} className="hud-panel p-6 w-full max-w-sm space-y-3">
        <img src={logoAsset.url} alt="Logo Poseidón" className="w-28 h-28 mx-auto rounded-full border border-primary/60 shadow-glow-amber object-cover" />
        <h1 className="font-display text-primary glow-amber text-lg text-center">SISTEMA TCM · ACCESO</h1>
        <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-accent/80">
          {mode === "in" ? "Ingreso de operador / instructor" : "Registro de nuevo operador"}
        </p>
        {mode === "up" && <Input placeholder="Nombre / grado (ej. TF Pérez)" value={name} onChange={(e) => setName(e.target.value)} />}
        <Input type="email" placeholder="Correo" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input type="password" placeholder="Contraseña" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" disabled={busy} className="w-full font-mono uppercase">{mode === "in" ? "Ingresar" : "Crear cuenta"}</Button>
        <button type="button" onClick={() => setMode(mode === "in" ? "up" : "in")} className="w-full text-xs font-mono text-muted-foreground hover:text-accent">
          {mode === "in" ? "¿No tiene cuenta? Regístrese" : "¿Ya tiene cuenta? Ingrese"}
        </button>
      </form>
    </div>
  );
}
