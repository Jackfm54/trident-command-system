import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthCtx {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isInstructor: boolean;
  rolesReady: boolean;
  displayName: string;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({ session: null, user: null, loading: true, isInstructor: false, rolesReady: false, displayName: "", signOut: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInstructor, setIsInstructor] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [rolesReady, setRolesReady] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) { setIsInstructor(false); setDisplayName(""); setRolesReady(true); return; }
    setRolesReady(false);
    setTimeout(async () => {
      const [{ data: roles }, { data: prof }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", uid),
        supabase.from("profiles").select("display_name").eq("id", uid).maybeSingle(),
      ]);
      setIsInstructor(!!roles?.some((r) => r.role === "instructor"));
      setDisplayName(prof?.display_name ?? session?.user?.email ?? "");
      setRolesReady(true);
    }, 0);
  }, [session?.user?.id]);

  return (
    <Ctx.Provider value={{ session, user: session?.user ?? null, loading, isInstructor, rolesReady, displayName, signOut: async () => { await supabase.auth.signOut(); } }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
