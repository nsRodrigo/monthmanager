import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Field, inputClass } from "@/components/Modal";
import { useProfile, useUpdateProfile } from "@/store/profile";
import { useTheme, type Theme } from "@/store/theme";
import { useAuth } from "@/store/auth";
import { User, Sun, Moon, Contrast, Check, KeyRound, Eye, EyeOff, Palette, Camera } from "lucide-react";
import { PasskeyManager } from "@/components/PasskeyManager";
import { supabase } from "@/integrations/supabase/client";
import { HeaderBand } from "@/components/HeaderBand";

export const Route = createFileRoute("/perfil")({
  head: () => ({ meta: [{ title: "Meu perfil — Finanças" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const update = useUpdateProfile();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const [name, setName] = useState(profile?.displayName ?? "");
  useEffect(() => {
    setName(profile?.displayName ?? "");
  }, [profile?.displayName]);

  // Identifica se o usuário tem login por email/senha (e não só OAuth Google)
  const identities = (user?.identities ?? []) as Array<{ provider: string }>;
  const hasPasswordLogin =
    identities.some((i) => i.provider === "email") || (identities.length === 0 && !!user?.email); // fallback

  const [showPwd, setShowPwd] = useState(false);
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdVisible, setPwdVisible] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [pwdSaving, setPwdSaving] = useState(false);

  const goBack = () => navigate({ to: "/" });

  const save = () => {
    update.mutate({ displayName: name.trim() || null }, { onSuccess: goBack });
  };

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const handleAvatarFile = async (file: File | undefined) => {
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      setAvatarError("Escolha um arquivo de imagem.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError("Imagem muito grande (máx. 5 MB).");
      return;
    }
    setAvatarError(null);
    setAvatarUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      await update.mutateAsync({ avatarUrl: data.publicUrl });
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Erro ao enviar a foto.");
    } finally {
      setAvatarUploading(false);
    }
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
    <div>
      <div className="sticky top-0 z-10">
        <HeaderBand
          compact
          title="Meu perfil"
          subtitle="Dados pessoais, tema e segurança."
          onBack={goBack}
        />
      </div>

      <div className="mx-auto max-w-3xl px-5 pb-8 md:pb-12">
      <div className="space-y-6 pt-6 pb-20">
        <div className="grid gap-6 md:grid-cols-[1.3fr_1fr] md:items-start">
          <div className="space-y-6">
            <section className="rounded-xl border border-border bg-card/40 p-4">
              <div className="mb-3 flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Dados pessoais</h2>
              </div>

              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-gradient-primary text-xl font-bold text-primary-foreground shadow-glow">
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
                    {avatarUploading && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      </div>
                    )}
                  </div>
                  <label
                    className="absolute -right-1 -bottom-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow-sm hover:opacity-90"
                    title="Trocar foto"
                    aria-label="Trocar foto de perfil"
                  >
                    <Camera className="h-3 w-3" />
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      disabled={avatarUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        handleAvatarFile(file);
                      }}
                    />
                  </label>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {profile?.displayName ?? "Sem nome"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                  {avatarError && <p className="mt-1 text-xs text-destructive">{avatarError}</p>}
                </div>
              </div>

              <div className="mt-4">
                <Field label="Nome de exibição">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Como devemos te chamar?"
                    className={inputClass}
                    maxLength={80}
                  />
                </Field>
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card/40 p-4">
              <div className="mb-3 flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Segurança</h2>
              </div>

              <PasskeyManager />

              {hasPasswordLogin && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="flex w-full items-center justify-between rounded-lg border border-border bg-background p-3 text-left hover:bg-secondary/50"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <KeyRound className="h-4 w-4 text-primary" /> Alterar senha
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {showPwd ? "Fechar" : "Abrir"}
                    </span>
                  </button>

                  {showPwd && (
                    <div className="mt-3 space-y-2 rounded-lg border border-border bg-background p-3">
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
                            {pwdVisible ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
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
            </section>
          </div>

          <section className="rounded-xl border border-border bg-card/40 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Palette className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Tema do app</h2>
            </div>
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
                    className={`relative flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs font-medium transition-all ${
                      active
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
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
          </section>
        </div>

        <div className="flex gap-2">
          <button
            onClick={goBack}
            className="flex-1 rounded-lg border border-border bg-background py-2.5 text-sm font-semibold hover:bg-secondary"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={update.isPending}
            className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {update.isPending ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
