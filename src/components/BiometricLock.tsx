import { useEffect, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Fingerprint, LogOut, ShieldCheck } from "lucide-react";
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
} from "@/lib/webauthn.functions";
import { supabase } from "@/integrations/supabase/client";

const IDLE_MS = 10 * 60 * 1000; // 10 min de inatividade com app aberto
const BG_MS = 5 * 60 * 1000; // 5 min em segundo plano antes de exigir biometria

/**
 * Bloqueia a UI quando:
 *  - o app é reaberto (visibilitychange voltou para "visible")
 *    e ficou >= BG_MS oculto
 *  - o usuário ficou inativo por mais de IDLE_MS
 *
 * Na tela bloqueada, QUALQUER toque/clique dispara automaticamente o prompt
 * biométrico nativo (WebAuthn exige user gesture — não dá pra disparar
 * sem interação do usuário). Sem botão intermediário.
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
  // While we don't know yet whether the user has passkeys, render a splash
  // so the home screen never flashes before the biometric prompt appears.
  const [checking, setChecking] = useState(false);

  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hiddenAt = useRef<number | null>(null);
  const autoTriggered = useRef(false);
  const initialLockDone = useRef(false);

  // Detect: user has passkeys + supported environment
  useEffect(() => {
    if (!user) {
      setEnabled(false);
      setLocked(false);
      setChecking(false);
      initialLockDone.current = false;
      return;
    }
    if (typeof window === "undefined") return;
    if (isInIframe() || !isWebAuthnSupported()) {
      setChecking(false);
      return;
    }
    if (!initialLockDone.current) {
      setChecking(true);
    }
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (!token) {
          setChecking(false);
          return;
        }
        const list = (await listFn({ data: { accessToken: token } })) as Array<unknown>;
        if (Array.isArray(list) && list.length > 0) {
          setEnabled(true);
          if (!initialLockDone.current) {
            initialLockDone.current = true;
            setLocked(true);
          }
        }
      } catch {
        // silently disabled
      } finally {
        setChecking(false);
      }
    })();
  }, [user, listFn]);

  // Idle + visibility tracking
  useEffect(() => {
    if (!enabled || !user) return;

    const resetIdle = () => {
      if (locked) return; // não resetar timer enquanto está bloqueado
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => setLocked(true), IDLE_MS);
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
      } else if (document.visibilityState === "visible") {
        const elapsed = hiddenAt.current ? Date.now() - hiddenAt.current : 0;
        hiddenAt.current = null;
        // Em segundo plano: exige biometria após o timeout configurado.
        if (elapsed >= BG_MS) {
          setLocked(true);
        } else {
          resetIdle();
        }
      }
    };

    // pageshow detecta retorno via bfcache (PWA reaberto)
    const onPageShow = () => setLocked(true);
    const onPageHide = () => setLocked(true);

    const events: Array<keyof DocumentEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
    ];
    events.forEach((e) => document.addEventListener(e, resetIdle, { passive: true }));
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("pagehide", onPageHide);

    resetIdle();

    return () => {
      events.forEach((e) => document.removeEventListener(e, resetIdle));
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("pagehide", onPageHide);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [enabled, user, locked]);

  const unlock = async () => {
    if (!user?.email) return;
    if (authing) return;
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
      autoTriggered.current = false;
    } catch (e: any) {
      setErr(e?.message ?? "Falha na biometria");
      // Permite nova tentativa via toque
      autoTriggered.current = false;
    } finally {
      setAuthing(false);
    }
  };

  // Auto-trigger biométrico no primeiro evento de interação após o lock.
  // WebAuthn EXIGE user gesture — não há como disparar sem interação.
  useEffect(() => {
    if (!locked) {
      autoTriggered.current = false;
      return;
    }
    const handler = () => {
      if (autoTriggered.current || authing) return;
      autoTriggered.current = true;
      unlock();
    };
    // O próprio touchstart/pointerdown na overlay conta como gesture
    window.addEventListener("pointerdown", handler, { once: false });
    window.addEventListener("touchstart", handler, { once: false, passive: true });
    window.addEventListener("keydown", handler, { once: false });
    return () => {
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("touchstart", handler);
      window.removeEventListener("keydown", handler);
    };
  }, [locked, authing]);

  return (
    <>
      {children}
      {checking && !locked && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background"
          role="status"
          aria-label="Verificando sessão"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-primary shadow-glow">
            <Fingerprint className="h-10 w-10 text-primary-foreground" aria-hidden="true" />
          </div>
        </div>
      )}
      {locked && (
        <div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/98 backdrop-blur-md p-5"
          role="dialog"
          aria-modal="true"
          aria-label="App bloqueado — toque para autenticar"
        >
          <div className="w-full max-w-sm text-center">
            <div
              className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-primary shadow-glow ${
                authing ? "animate-pulse" : ""
              }`}
            >
              <Fingerprint className="h-10 w-10 text-primary-foreground" aria-hidden="true" />
            </div>
            <h2 className="text-2xl font-bold">App bloqueado</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {authing
                ? "Aguardando autenticação…"
                : "Toque na tela para autenticar com biometria."}
            </p>

            {err && (
              <p
                role="alert"
                className="mt-5 rounded-lg bg-destructive/10 p-3 text-xs text-destructive"
              >
                {err}
                <br />
                <span className="text-muted-foreground">Toque novamente para tentar.</span>
              </p>
            )}

            <div className="mt-8 flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              <ShieldCheck className="h-3 w-3" />
              Verificação obrigatória
            </div>

            <button
              type="button"
              onClick={async (e) => {
                e.stopPropagation();
                await signOut();
                setLocked(false);
              }}
              className="mt-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" /> Sair da conta
            </button>
          </div>
        </div>
      )}
    </>
  );
}
