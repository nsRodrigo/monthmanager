import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { reportPendingSignup } from "@/server/access-requests.functions";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  pendingMessage: string | null;
  clearPendingMessage: () => void;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const checkingRef = useRef<string | null>(null);

  // Validates the signed-in user's email against the whitelist. If not allowed,
  // registers a pending access request (notifying admins) and signs the user
  // out so no session is established for unauthorized accounts.
  const enforceWhitelist = async (s: Session | null) => {
    const email = s?.user?.email?.toLowerCase();
    if (!s || !email) return;
    if (checkingRef.current === email) return;
    checkingRef.current = email;
    try {
      const { data: allowed } = await supabase.rpc("is_email_whitelisted", { _email: email });
      if (allowed) return;
      // Não autorizado — registra solicitação, notifica admin e desloga.
      try {
        await reportPendingSignup({ data: { email } });
      } catch (_) {}
      await supabase.auth.signOut();
      setPendingMessage(
        "Sua solicitação de acesso foi enviada ao administrador. Aguarde aprovação para acessar o aplicativo.",
      );
    } finally {
      checkingRef.current = null;
    }
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      // valida em segundo plano
      enforceWhitelist(s);
    });
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
      await enforceWhitelist(data.session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };
  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    return { error: error?.message ?? null };
  };
  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <Ctx.Provider
      value={{
        user,
        session,
        loading,
        pendingMessage,
        clearPendingMessage: () => setPendingMessage(null),
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be inside AuthProvider");
  return c;
}
