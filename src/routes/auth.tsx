import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/store/auth";
import { supabase } from "@/integrations/supabase/client";
import { Check, Eye, EyeOff } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Sparkline } from "@/components/Sparkline";
import { APP_VERSION } from "@/lib/version";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — Gestão Financeira" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { signIn, signUp, user, loading: authLoading, pendingMessage, clearPendingMessage } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && user) navigate({ to: "/" });
  }, [user, authLoading, navigate]);

  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (pendingMessage) {
      setInfo(pendingMessage);
      setError(null);
      clearPendingMessage();
    }
  }, [pendingMessage, clearPendingMessage]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

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
        setInfo(
          "Solicitação enviada para o administrador. Você será notificado quando seu acesso for aprovado.",
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
  };

  const signInGoogle = async () => {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
          queryParams:
            normalizedEmail && normalizedEmail.includes("@")
              ? { login_hint: normalizedEmail }
              : undefined,
        },
      });
      if (err) {
        setError(err.message ?? "Erro ao entrar com Google");
        setLoading(false);
        return;
      }
      // Sucesso: o navegador já foi redirecionado para o Google.
    } catch (err: any) {
      setError(err?.message ?? "Erro ao entrar com Google");
      setLoading(false);
    }
  };

  const title =
    mode === "signin"
      ? "Bem-vindo de volta"
      : mode === "signup"
        ? "Crie sua conta"
        : "Recuperar senha";
  const subtitle =
    mode === "signin"
      ? "Entre para ver como está o seu mês."
      : mode === "signup"
        ? "Só e-mails aprovados conseguem se cadastrar."
        : "Informe seu e-mail e enviaremos um link para redefinir a senha.";

  const switchMode = (m: "signin" | "signup" | "forgot") => {
    setMode(m);
    setError(null);
    setInfo(null);
  };

  const fieldCls =
    "w-full rounded-xl border border-border bg-input px-3.5 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus-visible:ring-2 focus-visible:ring-ring/40";

  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[1.1fr_1fr]">
      {/* Painel da marca — só em tela larga */}
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-gradient-hero p-12 lg:flex">
        <div className="flex items-center gap-3">
          <Logo size="sm" />
          <span className="font-display text-lg font-semibold tracking-tight">Gestão Financeira</span>
        </div>

        <div>
          <h2 className="max-w-[12ch] font-display text-5xl leading-[1.05] font-semibold tracking-tight">
            Seu mês, numa tela só.
          </h2>
          <p className="mt-4 max-w-[38ch] text-[15px] text-muted-foreground">
            Contas, cartões e parcelas em um painel — do saldo de hoje à previsão do fim do ano.
          </p>
          <ul className="mt-7 space-y-3 text-sm text-muted-foreground">
            {[
              "Saldo previsto e vencimentos do mês",
              "Cartões, parcelas e recorrências sob controle",
              "Vários dispositivos, sempre sincronizados",
            ].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        {/* Ilustração — sem números reais */}
        <div className="max-w-sm rounded-2xl border border-border bg-background/60 p-4 backdrop-blur" aria-hidden="true">
          <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            Saldo previsto · ilustração
          </p>
          <div className="mt-3 h-6 w-40 rounded-md bg-secondary" />
          <Sparkline points={[4.1, 4.4, 4.9, 5.3, 5.9, 6.3, 6.8]} className="mt-3" />
        </div>
      </aside>

      {/* Formulário */}
      <main className="flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-sm space-y-5">
          <div className="flex items-center gap-3 lg:hidden">
            <Logo size="sm" />
            <span className="font-display text-lg font-semibold tracking-tight">Gestão Financeira</span>
          </div>

          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>

          {mode !== "forgot" && (
            <div
              role="tablist"
              aria-label="Entrar ou criar conta"
              className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-card p-1"
            >
              {(
                [
                  ["signin", "Entrar"],
                  ["signup", "Criar conta"],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => switchMode(m)}
                  className={`rounded-lg py-2 text-sm font-medium transition-colors ${
                    mode === m ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">E-mail</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                className={fieldCls}
              />
            </label>

            {mode !== "forgot" && (
              <label className="block">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Senha</span>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => switchMode("forgot")}
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
                    className={`${fieldCls} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    aria-label={showPwd ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>
            )}

            {error && (
              <p className="rounded-xl bg-destructive/10 p-3 text-xs text-destructive" role="alert">
                {error}
              </p>
            )}
            {info && (
              <p className="rounded-xl bg-success/10 p-3 text-xs text-success" role="status">
                {info}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading
                ? "Aguarde…"
                : mode === "signin"
                  ? "Entrar"
                  : mode === "signup"
                    ? "Criar conta"
                    : "Enviar link"}
            </button>

            {mode !== "forgot" && (
              <>
                <div className="relative flex items-center">
                  <div className="flex-1 border-t border-border" />
                  <span className="px-3 text-[10px] tracking-wider text-muted-foreground uppercase">ou</span>
                  <div className="flex-1 border-t border-border" />
                </div>
                <button
                  type="button"
                  onClick={signInGoogle}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-card py-3 text-sm font-medium text-foreground hover:bg-secondary disabled:opacity-50"
                >
                  <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
                    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
                    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 34.9 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z"/>
                    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.2 5.2C41.4 35.6 44 30.3 44 24c0-1.3-.1-2.4-.4-3.5z"/>
                  </svg>
                  Continuar com Google
                </button>
              </>
            )}

            {mode === "forgot" && (
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
              >
                Voltar para entrar
              </button>
            )}
          </form>

          <p className="pt-2 text-center text-[11px] text-muted-foreground/70">
            <button type="button" onClick={() => navigate({ to: "/sobre" })} className="underline hover:text-foreground">
              Sobre
            </button>
            {" · "}
            <button type="button" onClick={() => navigate({ to: "/privacidade" })} className="underline hover:text-foreground">
              Privacidade
            </button>
            {" · "}v{APP_VERSION}
          </p>
        </div>
      </main>
    </div>
  );
}
