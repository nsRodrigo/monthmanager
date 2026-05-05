import { useState, useEffect } from "react";
import { Modal, Field, inputClass } from "./Modal";
import { useProfile, useUpdateProfile } from "@/store/profile";
import { useTheme, type Theme } from "@/store/theme";
import { useAuth } from "@/store/auth";
import { User, Sun, Moon, Contrast, Check, KeyRound, Eye, EyeOff } from "lucide-react";
import { PasskeyManager } from "./PasskeyManager";
import { supabase } from "@/integrations/supabase/client";

export function ProfileDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const update = useUpdateProfile();
  const { theme, setTheme } = useTheme();


  const [name, setName] = useState("");

  // Identifica se o usuário tem login por email/senha (e não só OAuth Google)
  const identities = (user?.identities ?? []) as Array<{ provider: string }>;
  const hasPasswordLogin =
    identities.some((i) => i.provider === "email") ||
    (identities.length === 0 && !!user?.email); // fallback

  const [showPwd, setShowPwd] = useState(false);
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdVisible, setPwdVisible] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [pwdSaving, setPwdSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(profile?.displayName ?? "");
      setShowPwd(false);
      setNewPwd("");
      setConfirmPwd("");
      setPwdMsg(null);
    }
  }, [open, profile]);

  const save = () => {
    update.mutate(
      { displayName: name.trim() || null },
      { onSuccess: () => onClose() },
    );
  };

  const changePassword = async () => {
    setPwdMsg(null);
    if (newPwd.length < 6) {
      setPwdMsg({ type: "err", text: "A senha deve ter pelo menos 6 caracteres." });
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdMsg({ type: "err", text: "As senhas não coincidem." });
      return;
    }
    setPwdSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    setPwdSaving(false);
    if (error) {
      setPwdMsg({ type: "err", text: error.message });
      return;
    }
    setPwdMsg({ type: "ok", text: "Senha alterada com sucesso!" });
    setNewPwd("");
    setConfirmPwd("");
    setTimeout(() => setShowPwd(false), 1200);
  };

  const initials = (name || profile?.displayName || user?.email || "?")
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const themes: { value: Theme; label: string; icon: typeof Sun; description: string }[] = [
    { value: "light", label: "Claro", icon: Sun, description: "Fundo branco" },
    { value: "dark", label: "Escuro", icon: Moon, description: "Padrão" },
    { value: "high-contrast", label: "Alto contraste", icon: Contrast, description: "WCAG AAA" },
  ];

  return (
    <Modal open={open} onClose={onClose} title="Meu perfil">
      <div className="space-y-5">
        {/* Avatar + email */}
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-primary text-xl font-bold text-primary-foreground shadow-glow">
            {profile?.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt=""
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              initials || <User className="h-7 w-7" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{profile?.displayName ?? "Sem nome"}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        <Field label="Nome de exibição">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Como devemos te chamar?"
            className={inputClass}
            maxLength={80}
          />
        </Field>

        {/* Tema */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tema do app
          </p>
          <div role="radiogroup" aria-label="Tema do app" className="grid grid-cols-3 gap-2">
            {themes.map((t) => {
              const Icon = t.icon;
              const active = theme === t.value;
              return (
                <button
                  key={t.value}
                  role="radio"
                  aria-checked={active}
                  onClick={() => setTheme(t.value)}
                  className={`relative flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition-all ${
                    active
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  {active && (
                    <Check className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-primary" />
                  )}
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <span>{t.label}</span>
                  <span className="text-[10px] text-muted-foreground">{t.description}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Segurança / Biometria */}
        <div className="border-t border-border pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Segurança
          </p>
          <PasskeyManager />
        </div>

        {/* Alterar senha (apenas se tiver login por senha) */}
        {hasPasswordLogin && (
          <div className="border-t border-border pt-4">
            <button
              type="button"
              onClick={() => setShowPwd((v) => !v)}
              className="flex w-full items-center justify-between rounded-lg border border-border bg-card p-3 text-left hover:bg-secondary/50"
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <KeyRound className="h-4 w-4 text-primary" /> Alterar senha
              </span>
              <span className="text-xs text-muted-foreground">{showPwd ? "Fechar" : "Abrir"}</span>
            </button>

            {showPwd && (
              <div className="mt-3 space-y-2 rounded-lg border border-border bg-card p-3">
                <Field label="Nova senha">
                  <div className="relative">
                    <input
                      type={pwdVisible ? "text" : "password"}
                      value={newPwd}
                      onChange={(e) => setNewPwd(e.target.value)}
                      className={inputClass}
                      autoComplete="new-password"
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setPwdVisible((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-secondary"
                      aria-label={pwdVisible ? "Ocultar" : "Mostrar"}
                    >
                      {pwdVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Field>
                <Field label="Confirmar nova senha">
                  <input
                    type={pwdVisible ? "text" : "password"}
                    value={confirmPwd}
                    onChange={(e) => setConfirmPwd(e.target.value)}
                    className={inputClass}
                    autoComplete="new-password"
                    minLength={6}
                  />
                </Field>

                {pwdMsg && (
                  <p
                    className={`rounded-lg p-2 text-xs ${
                      pwdMsg.type === "ok"
                        ? "bg-success/10 text-success"
                        : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {pwdMsg.text}
                  </p>
                )}

                <button
                  onClick={changePassword}
                  disabled={pwdSaving || !newPwd || !confirmPwd}
                  className="w-full rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {pwdSaving ? "Salvando…" : "Atualizar senha"}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={update.isPending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {update.isPending ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function AdminSection() {
  const { data: list = [] } = useWhitelist();
  const add = useAddToWhitelist();
  const remove = useRemoveFromWhitelist();
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const v = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      setErr("E-mail inválido.");
      return;
    }
    add.mutate(v, {
      onSuccess: () => setEmail(""),
      onError: (e: any) => setErr(e?.message ?? "Erro ao adicionar."),
    });
  };

  return (
    <div className="border-t border-border pt-4">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Administrador
      </p>
      <div className="rounded-lg border border-border bg-card p-3 space-y-3">
        <p className="text-xs text-muted-foreground">
          Apenas e-mails na whitelist podem se cadastrar no app.
        </p>
        <form onSubmit={submit} className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@exemplo.com"
            className={inputClass}
          />
          <button
            type="submit"
            disabled={add.isPending}
            className="flex items-center gap-1 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </form>
        {err && <p className="text-xs text-destructive">{err}</p>}
        <ul className="max-h-48 overflow-y-auto divide-y divide-border rounded-lg border border-border">
          {list.length === 0 && (
            <li className="p-2 text-center text-xs text-muted-foreground">
              Nenhum e-mail na whitelist.
            </li>
          )}
          {list.map((w) => (
            <li key={w.id} className="flex items-center justify-between gap-2 p-2 text-xs">
              <span className="truncate">{w.email}</span>
              <button
                onClick={() => {
                  if (confirm(`Remover ${w.email} da whitelist?`)) remove.mutate(w.id);
                }}
                className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label="Remover"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
