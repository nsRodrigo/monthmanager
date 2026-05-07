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
  const validationRunRef = useRef(0);
  const initialValidationDoneRef = useRef(false);

  // Validates the signed-in user's email against the whitelist.
  // - On the very first session resolution we BLOCK (loading=true) so that
  //   protected pages don't flash before redirect.
  // - On subsequent auth events (e.g. token refresh) we validate in the
  //   background WITHOUT toggling loading, so the UI never flickers.
  // If the user is unauthorized, we still register a pending request and
  // sign out silently.
  const enforceWhitelist = async (s: Session | null, isInitial: boolean) => {
    const runId = ++validationRunRef.current;
    const email = s?.user?.email?.toLowerCase();

    if (isInitial) setLoading(true);

    if (!s || !email) {
      setSession(null);
      setUser(null);
      if (isInitial) setLoading(false);
      return;
    }

    // Optimistic: if we already have this user logged in, set state immediately
    // so the UI stays put while we re-validate in the background.
    setSession(s);
    setUser(s.user);
    if (isInitial) setLoading(false);

    try {
      const { data: allowed, error } = await supabase.rpc("is_email_whitelisted", { _email: email });
      if (validationRunRef.current !== runId) return;
      if (error) throw error;
      if (allowed) return;

      // Não autorizado — registra solicitação, notifica admin e desloga silenciosamente.
      let message = "Sua solicitação de acesso foi registrada. Aguarde aprovação para acessar o aplicativo.";
      try {
        const result = await reportPendingSignup({ data: { email } });
        if ((result?.notifiedCount ?? 0) > 0) {
          message = "Sua solicitação de acesso foi enviada ao administrador. Aguarde aprovação para acessar o aplicativo.";
        }
      } catch (_) {
        message = "Não foi possível registrar sua solicitação agora. Tente novamente em instantes.";
      }
      if (validationRunRef.current !== runId) return;
      setSession(null);
      setUser(null);
      setPendingMessage(message);
      await supabase.auth.signOut();
    } catch (_) {
      // Falha de rede em validação background — mantém sessão atual silenciosamente.
      // Nova tentativa virá no próximo evento de auth.
    }
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      const isInitial = !initialValidationDoneRef.current;
      void enforceWhitelist(s, isInitial);
    });
    supabase.auth.getSession().then(({ data }) => {
      initialValidationDoneRef.current = true;
      void enforceWhitelist(data.session, true).finally(() => {
        // marca após a primeira resolução
      });
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setLoading(false);
    return { error: error?.message ?? null };
  };
  const signUp = async (email: string, password: string) => {
    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    const { data: allowed, error: whitelistError } = await supabase.rpc("is_email_whitelisted", {
      _email: normalizedEmail,
    });
    if (whitelistError) {
      setLoading(false);
      return { error: "Não foi possível validar seu acesso. Tente novamente." };
    }
    if (!allowed) {
      try {
        await reportPendingSignup({ data: { email: normalizedEmail } });
      } catch (_) {
        setLoading(false);
        return { error: "Não foi possível registrar sua solicitação agora. Tente novamente." };
      }
      setLoading(false);
      return { error: "pending_approval" };
    }
    const { error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    if (error) setLoading(false);
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
