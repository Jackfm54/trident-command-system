import { LanguageSelector } from "@/components/LanguageSelector";
import { t as tr, useLanguage } from "@/lib/i18n";
import logoAsset from "@/assets/poseidon.jpeg.asset.json";
import { useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function Auth() {
  useLanguage();
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
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success(
          tr(
            "Cuenta creada. Revise su correo para confirmarla y luego ingrese.",
          ),
        );
        setMode("in");
      }
    } catch (err: any) {
      toast.error(err?.message ?? tr("Error de autenticación"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="hud-panel p-6 w-full max-w-sm space-y-3"
      >
        <div className="flex justify-end">
          <LanguageSelector />
        </div>
        <img
          src={logoAsset.url}
          alt={tr("Logo Poseidón")}
          className="w-40 h-40 mx-auto rounded-full border border-primary/60 shadow-glow-amber object-cover"
        />
        <h1 className="font-display text-primary glow-amber text-lg text-center">
          {tr("SISTEMA TCM POSEIDÓN · ACCESO")}
        </h1>
        <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-accent/80">
          {mode === "in"
            ? tr("Ingreso de operador / instructor")
            : tr("Registro de nuevo operador")}
        </p>
        {mode === "up" && (
          <Input
            placeholder={tr("Nombre / grado (ej. TF Pérez)")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}
        <Input
          type="email"
          placeholder={tr("Correo")}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          type="password"
          placeholder={tr("Contraseña")}
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button
          type="submit"
          disabled={busy}
          className="w-full font-mono uppercase"
        >
          {mode === "in" ? tr("Ingresar") : tr("Crear cuenta")}
        </Button>
        <button
          type="button"
          onClick={() => setMode(mode === "in" ? "up" : "in")}
          className="w-full text-xs font-mono text-muted-foreground hover:text-accent"
        >
          {mode === "in"
            ? tr("¿No tiene cuenta? Regístrese")
            : tr("¿Ya tiene cuenta? Ingrese")}
        </button>
      </form>
    </div>
  );
}
