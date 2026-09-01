import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff } from "lucide-react";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Redefinir senha — Gestão Financeira" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase processa o token do hash automaticamente e dispara PASSWORD_RECOVERY.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setInfo("Senha redefinida! Redirecionando…");
    setTimeout(() => navigate({ to: "/" }), 1200);
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-band px-5">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-elevated sm:p-8">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Logo size="md" />
          <div className="text-center">
            <h1 className="text-2xl font-bold">Gestão Financeira</h1>
            <p className="text-sm text-muted-foreground">Defina uma nova senha</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {!ready && (
            <p className="rounded-lg bg-warning/10 p-2 text-xs text-warning-foreground">
              Aguardando link de recuperação… Se você não veio por um link de email, peça um novo em "Esqueci minha senha".
            </p>
          )}

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Nova senha</span>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                required
                minLength={6}
                autoComplete="new-password"
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

          {error && <p className="rounded-lg bg-destructive/10 p-2 text-xs text-destructive" role="alert">{error}</p>}
          {info && <p className="rounded-lg bg-success/10 p-2 text-xs text-success" role="status">{info}</p>}

          <button
            type="submit"
            disabled={loading || !ready || password.length < 6}
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Salvando…" : "Salvar nova senha"}
          </button>
        </form>
      </div>
    </div>
  );
}
