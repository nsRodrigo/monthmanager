import { useEffect, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Fingerprint, LogOut } from "lucide-react";
import { useAuth } from "@/store/auth";
import {
  isWebAuthnSupported,
  isInIframe,
  browserStartAuthentication,
} from "@/lib/passkeys";
import {
  startAuthentication as srvStartAuth,
  finishAuthentication as srvFinishAuth,
  listPasskeys as srvList,
} from "@/server/webauthn";
import { supabase } from "@/integrations/supabase/client";

const IDLE_MS = 5 * 60 * 1000; // 5 min

/**
 * Bloqueia a UI quando:
 *  - o app é reaberto (visibilitychange voltou para "visible" e estava oculto)
 *  - o usuário ficou inativo por mais de IDLE_MS
 *
 * Só ativa se houver passkey cadastrada para o usuário e o ambiente
 * suportar WebAuthn (sem iframe / preview do editor).
 */
export function BiometricLock({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const startAuthFn = useServerFn(srvStartAuth);
  const finishAuthFn = useServerFn(srvFinishAuth);
  const listFn = useServerFn(srvList);

  const [enabled, setEnabled] = useState(false);
  const [locked, setLocked] = useState(false);
  const [authing, setAuthing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasHidden = useRef(false);

  // Detect: user has passkeys + supported environment
  useEffect(() => {
    if (!user) {
      setEnabled(false);
      setLocked(false);
      return;
    }
    if (typeof window === "undefined") return;
    if (isInIframe() || !isWebAuthnSupported()) return;
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (!token) return;
        const list = (await listFn({ data: { accessToken: token } })) as Array<unknown>;
        if (Array.isArray(list) && list.length > 0) setEnabled(true);
      } catch {
        // silently disabled
      }
    })();
  }, [user, listFn]);

  // Idle + visibility tracking
  useEffect(() => {
    if (!enabled || !user) return;

    const resetIdle = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => setLocked(true), IDLE_MS);
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        wasHidden.current = true;
      } else if (document.visibilityState === "visible" && wasHidden.current) {
        wasHidden.current = false;
        setLocked(true);
      }
    };

    const events: Array<keyof DocumentEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
    ];
    events.forEach((e) => document.addEventListener(e, resetIdle, { passive: true }));
    document.addEventListener("visibilitychange", onVisibility);

    resetIdle();

    return () => {
      events.forEach((e) => document.removeEventListener(e, resetIdle));
      document.removeEventListener("visibilitychange", onVisibility);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [enabled, user]);

  const unlock = async () => {
    if (!user?.email) return;
    setErr(null);
    setAuthing(true);
    try {
      const options = await startAuthFn({ data: { email: user.email } });
      const response = await browserStartAuthentication({ optionsJSON: options as any });
      const result = (await finishAuthFn({
        data: { email: user.email, response },
      })) as { success: boolean };
      if (!result.success) throw new Error("Falha na verificação");
      setLocked(false);
    } catch (e: any) {
      setErr(e?.message ?? "Falha na biometria");
    } finally {
      setAuthing(false);
    }
  };

  return (
    <>
      {children}
      {locked && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-md p-5"
          role="dialog"
          aria-modal="true"
          aria-label="App bloqueado"
        >
          <div className="w-full max-w-sm text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow">
              <Fingerprint className="h-8 w-8 text-primary-foreground" aria-hidden="true" />
            </div>
            <h2 className="text-xl font-bold">App bloqueado</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Use sua biometria para continuar.
            </p>
            <button
              type="button"
              onClick={unlock}
              disabled={authing}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-60"
            >
              <Fingerprint className="h-4 w-4" />
              {authing ? "Autenticando…" : "Desbloquear com biometria"}
            </button>
            {err && (
              <p role="alert" className="mt-3 rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
                {err}
              </p>
            )}
            <button
              type="button"
              onClick={async () => {
                await signOut();
                setLocked(false);
              }}
              className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" /> Sair da conta
            </button>
          </div>
        </div>
      )}
    </>
  );
}
