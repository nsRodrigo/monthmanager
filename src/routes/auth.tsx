import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/store/auth";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Wallet, Eye, EyeOff, Fingerprint } from "lucide-react";
import {
  isWebAuthnSupported,
  isPlatformAuthenticatorAvailable,
  browserStartAuthentication,
} from "@/lib/passkeys";
import {
  startAuthentication as srvStartAuth,
  finishAuthentication as srvFinishAuth,
} from "@/server/webauthn";
import { reportPendingSignup, flushPendingNotifications } from "@/server/access-requests.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — Gestão Financeira" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/" });
  },
  component: AuthPage,
});

function AuthPage() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot" | "request">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [bioAvailable, setBioAvailable] = useState(false);

  useEffect(() => {
    if (isWebAuthnSupported()) {
      isPlatformAuthenticatorAvailable().then(setBioAvailable);
    }
  }, []);

  // Detecta erro vindo do callback OAuth (Google) — quando o trigger bloqueia
  // o signup, o Supabase redireciona com #error=...&error_description=...
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || !hash.includes("error")) return;
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const desc = (params.get("error_description") ?? "").toLowerCase();
    if (!desc) return;
    const isPending =
      desc.includes("pending_approval") ||
      desc.includes("não está autorizado") ||
      desc.includes("nao esta autorizado") ||
      desc.includes("database error saving new user") ||
      desc.includes("database error");
    if (isPending) {
      // Tenta recuperar o email do provedor a partir do id_token, se houver
      const idToken = params.get("id_token") ?? params.get("provider_token");
      let providerEmail: string | undefined;
      try {
        if (idToken) {
          const payload = JSON.parse(atob(idToken.split(".")[1] ?? ""));
          providerEmail = payload?.email;
        }
      } catch (_) {}
      if (providerEmail) {
        reportPendingSignup({ data: { email: providerEmail } }).catch(() => {});
      }
      setInfo(
        "Solicitação enviada para aprovação. Você será notificado quando o administrador aprovar — tente entrar novamente depois.",
      );
      setError(null);
    } else {
      setError(decodeURIComponent(params.get("error_description") ?? "Erro ao entrar"));
    }
    // limpa o hash da URL
    history.replaceState(null, "", window.location.pathname + window.location.search);
    // Garante que admins recebam push para QUALQUER solicitação pendente sem notificação
    // (ex.: signup via Google em que o callback não trouxe id_token com email)
    flushPendingNotifications({}).catch(() => {});
  }, []);

  // No primeiro carregamento da tela de auth, sempre tenta esvaziar a fila de
  // solicitações pendentes não notificadas — cobre o bug do callback do Google.
  useEffect(() => {
    flushPendingNotifications({}).catch(() => {});
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    if (mode === "request") {
      try {
        if (!email.includes("@")) throw new Error("Informe um e-mail válido.");
        await reportPendingSignup({ data: { email } });
        setInfo("Solicitação enviada! O administrador vai receber uma notificação.");
      } catch (err: any) {
        setError(err?.message ?? "Não foi possível enviar a solicitação.");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (mode === "forgot") {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setLoading(false);
      if (err) {
        setError(err.message);
        return;
      }
      setInfo("Enviamos um link para redefinir sua senha. Verifique seu email.");
      return;
    }

    const fn = mode === "signin" ? signIn : signUp;
    const { error: err } = await fn(email, password);
    setLoading(false);
    if (err) {
      const msg = err.toLowerCase();
      if (
        mode === "signup" &&
        (msg.includes("pending_approval") ||
          msg.includes("não está autorizado") ||
          msg.includes("nao esta autorizado") ||
          msg.includes("database error saving new user"))
      ) {
        try {
          await reportPendingSignup({ data: { email } });
        } catch (_) {}
        setInfo(
          "Solicitação enviada para aprovação. Você será notificado quando o administrador aprovar — tente cadastrar novamente depois.",
        );
        setError(null);
        return;
      }
      if (mode === "signup" && msg.includes("bloquead")) {
        setError("Este e-mail foi bloqueado. Entre em contato com o administrador.");
        return;
      }
      setError(err);
      return;
    }
    if (mode === "signup") setInfo("Conta criada! Você já pode usar o app.");
    navigate({ to: "/" });
  };

  const signInGoogle = async () => {
    setError(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setError(
        "Digite seu e-mail Google acima antes de continuar — assim conseguimos avisar o administrador caso precise de aprovação.",
      );
      return;
    }
    setLoading(true);
    const { data: allowed } = await supabase.rpc("is_email_whitelisted", { _email: normalizedEmail });
    if (!allowed) {
      try {
        await reportPendingSignup({ data: { email: normalizedEmail } });
        setInfo(
          "Solicitação enviada! O administrador foi notificado. Tente entrar novamente após a aprovação.",
        );
      } catch (err: any) {
        setError(err?.message ?? "Não foi possível enviar a solicitação.");
      } finally {
        setLoading(false);
      }
      return;
    }
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
      extraParams: { login_hint: normalizedEmail },
    });
    if (result.error) {
      setLoading(false);
      const rawMsg = (result.error as Error)?.message ?? "Erro ao entrar com Google";
      const msg = rawMsg.toLowerCase();
      const isPending =
        msg.includes("pending_approval") ||
        msg.includes("database error") ||
        msg.includes("failed to sign in with vendor") ||
        msg.includes("vendor") ||
        msg.includes("não está autorizado") ||
        msg.includes("nao esta autorizado");
      if (isPending) {
        const normalized = email ? email.trim().toLowerCase() : "";
        if (normalized) {
          try { await reportPendingSignup({ data: { email: normalized } }); } catch (_) {}
        }
        // Cobre o caso em que o callback do Google não traz id_token com email:
        // o trigger já persistiu via dblink, então só precisamos disparar o push.
        try { await flushPendingNotifications({}); } catch (_) {}
        setInfo(
          "Solicitação enviada para aprovação. Você será notificado quando o administrador aprovar — tente entrar novamente depois.",
        );
        setError(null);
        return;
      }
      setError(rawMsg);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/" });
  };

  const startAuthFn = useServerFn(srvStartAuth);
  const finishAuthFn = useServerFn(srvFinishAuth);

  const signInBio = async () => {
    if (!email) {
      setError("Digite seu email primeiro");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      if (!isWebAuthnSupported()) throw new Error("Seu navegador não suporta biometria");
      const options = await startAuthFn({ data: { email } });
      const response = await browserStartAuthentication({ optionsJSON: options as any });
      const result = (await finishAuthFn({ data: { email, response } })) as {
        success: boolean;
        tokenHash: string;
      };
      const { error: vErr } = await supabase.auth.verifyOtp({
        type: "magiclink",
        token_hash: result.tokenHash,
      });
      if (vErr) throw vErr;
      navigate({ to: "/" });
    } catch (e: any) {
      setError(e?.message ?? "Falha no login com biometria");
    } finally {
      setLoading(false);
    }
  };

  const title =
    mode === "signin"
      ? "Entre na sua conta"
      : mode === "signup"
        ? "Crie sua conta"
        : mode === "request"
          ? "Solicitar acesso"
          : "Recuperar senha";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow">
            <Wallet className="h-6 w-6 text-primary-foreground" aria-hidden="true" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold">Gestão Financeira</h1>
            <p className="text-sm text-muted-foreground">{title}</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3 rounded-2xl border border-border bg-card p-6">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-input bg-input px-3 py-2.5 text-sm outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>

          {mode !== "forgot" && mode !== "request" && (
            <label className="block">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Senha</span>
                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("forgot");
                      setError(null);
                      setInfo(null);
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    Esqueci minha senha
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  required
                  minLength={6}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-input bg-input px-3 py-2.5 pr-10 text-sm outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  aria-label={showPwd ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>
          )}

          {error && <p className="rounded-lg bg-destructive/10 p-2 text-xs text-destructive" role="alert">{error}</p>}
          {info && <p className="rounded-lg bg-success/10 p-2 text-xs text-success" role="status">{info}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {loading
              ? "Aguarde…"
              : mode === "signin"
                ? "Entrar"
                : mode === "signup"
                  ? "Criar conta"
                  : mode === "request"
                    ? "Enviar solicitação"
                    : "Enviar link"}
          </button>

          {mode !== "forgot" && mode !== "request" && (
            <>
              <div className="relative my-1 flex items-center">
                <div className="flex-1 border-t border-border" />
                <span className="px-2 text-[10px] uppercase tracking-wider text-muted-foreground">ou</span>
                <div className="flex-1 border-t border-border" />
              </div>
              <button
                type="button"
                onClick={signInGoogle}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-input bg-background py-2.5 text-sm font-medium text-foreground hover:bg-secondary disabled:opacity-50"
              >
                <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
                  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                  <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 34.9 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z"/>
                  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.2 5.2C41.4 35.6 44 30.3 44 24c0-1.3-.1-2.4-.4-3.5z"/>
                </svg>
                Continuar com Google
              </button>
              {mode === "signin" && bioAvailable && (
                <button
                  type="button"
                  onClick={signInBio}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-input bg-background py-2.5 text-sm font-medium text-foreground hover:bg-secondary disabled:opacity-50"
                >
                  <Fingerprint className="h-4 w-4 text-primary" aria-hidden="true" />
                  Entrar com biometria
                </button>
              )}
            </>
          )}

          {mode === "signin" && (
            <>
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError(null);
                  setInfo(null);
                }}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
              >
                Não tem conta? Criar agora
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("request");
                  setError(null);
                  setInfo(null);
                }}
                className="w-full text-center text-xs text-primary hover:underline"
              >
                Solicitar acesso ao administrador
              </button>
            </>
          )}
          {mode === "signup" && (
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setError(null);
                setInfo(null);
              }}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
            >
              Já tem conta? Entrar
            </button>
          )}
          {(mode === "forgot" || mode === "request") && (
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setError(null);
                setInfo(null);
              }}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
            >
              Voltar para entrar
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
