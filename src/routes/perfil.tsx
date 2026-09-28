import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Field, inputClass } from "@/components/Modal";
import { useProfile, useUpdateProfile } from "@/store/profile";
import { useAuth } from "@/store/auth";
import { useIsAdmin } from "@/store/roles";
import { useAccounts } from "@/store/finance";
import { User, Check, KeyRound, Eye, EyeOff, Camera, Users, Clock, X, ShieldCheck, Sliders, ChevronRight, Info, Lock } from "lucide-react";
import { PasskeyManager } from "@/components/PasskeyManager";
import { supabase } from "@/integrations/supabase/client";
import { HeaderBand } from "@/components/HeaderBand";
import { AccountSwitcher } from "@/components/AccountSwitcher";
import { useIncomingGrants, useDecideGrant, useRevokeGrant } from "@/store/account-access";

export const Route = createFileRoute("/perfil")({
  head: () => ({ meta: [{ title: "Meu perfil — Finanças" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const update = useUpdateProfile();
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const { data: accounts = [] } = useAccounts();
  const { data: incomingGrants = [] } = useIncomingGrants();
  const decideGrant = useDecideGrant();
  const revokeGrant = useRevokeGrant();
  const pendingIncoming = incomingGrants.filter((g) => g.status === "pending");
  const activeIncoming = incomingGrants.filter((g) => g.status === "active");

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

  const cardCls = "rounded-2xl border border-border bg-card p-5";
  const SectionTitle = ({ icon: Icon, children }: { icon: typeof User; children: React.ReactNode }) => (
    <div className="mb-4 flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <h2 className="font-display text-[15px] font-semibold">{children}</h2>
    </div>
  );

  return (
    <div>
      <div className="sticky top-0 z-10">
        <HeaderBand
          title="Meu perfil"
          subtitle="Dados pessoais, aparência e segurança."
          onBack={goBack}
        />
      </div>

      <div className="mx-auto max-w-4xl px-4 pt-5 pb-24 sm:px-6">
        <div className="space-y-4">
          {/* Identidade */}
          <section className={`${cardCls} flex items-center gap-4 sm:gap-5`}>
            <div className="relative shrink-0">
              <div className="flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-full bg-gradient-primary text-2xl font-bold text-primary-foreground">
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
                className="absolute -right-1 -bottom-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground hover:opacity-90"
                title="Trocar foto"
                aria-label="Trocar foto de perfil"
              >
                <Camera className="h-3.5 w-3.5" />
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
              <p className="truncate font-display text-xl font-semibold tracking-tight">
                {profile?.displayName ?? "Sem nome"}
              </p>
              <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {isAdmin && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                    <ShieldCheck className="h-3 w-3" /> Administrador
                  </span>
                )}
                <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  {accounts.length} {accounts.length === 1 ? "conta" : "contas"}
                </span>
              </div>
              {avatarError && <p className="mt-1.5 text-xs text-destructive">{avatarError}</p>}
            </div>
          </section>

          <div className="grid gap-4 md:grid-cols-2 md:items-start">
            <div className="space-y-4">
              <section className={cardCls}>
                <SectionTitle icon={User}>Dados pessoais</SectionTitle>
                <Field label="Nome de exibição">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Como devemos te chamar?"
                    className={inputClass}
                    maxLength={80}
                  />
                </Field>
              </section>

              <section className={cardCls}>
                <SectionTitle icon={KeyRound}>Segurança</SectionTitle>

                <PasskeyManager />

                {hasPasswordLogin && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => setShowPwd((v) => !v)}
                      className="flex w-full items-center justify-between rounded-xl border border-border bg-background p-3 text-left hover:bg-secondary/50"
                    >
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <KeyRound className="h-4 w-4 text-primary" /> Alterar senha
                      </span>
                      <span className="text-xs text-muted-foreground">{showPwd ? "Fechar" : "Abrir"}</span>
                    </button>

                    {showPwd && (
                      <div className="mt-3 space-y-2 rounded-xl border border-border bg-background p-3">
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
              </section>

            </div>

            <div className="space-y-4">
              <section className={cardCls}>
                <SectionTitle icon={Users}>Contas</SectionTitle>
                <AccountSwitcher variant="inline" />
              </section>
            </div>
          </div>

          {pendingIncoming.length > 0 && (
            <section className={cardCls}>
              <SectionTitle icon={Clock}>
                Pedidos recebidos{" "}
                <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                  {pendingIncoming.length}
                </span>
              </SectionTitle>
              <div className="space-y-2">
                {pendingIncoming.map((g) => (
                  <div
                    key={g.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{g.requesterEmail}</p>
                      <p className="text-xs text-muted-foreground">
                        Pediu acesso de leitura e escrita à sua conta
                      </p>
                    </div>
                    <button
                      onClick={() => decideGrant.mutate({ id: g.id, approve: true })}
                      disabled={decideGrant.isPending}
                      className="inline-flex items-center gap-1 rounded-lg bg-success/15 px-3 py-2 text-xs font-semibold text-success hover:bg-success/25 disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" /> Permitir
                    </button>
                    <button
                      onClick={() => decideGrant.mutate({ id: g.id, approve: false })}
                      disabled={decideGrant.isPending}
                      className="inline-flex items-center gap-1 rounded-lg border border-destructive/30 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
                    >
                      <X className="h-4 w-4" /> Recusar
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeIncoming.length > 0 && (
            <section className={cardCls}>
              <SectionTitle icon={ShieldCheck}>Acessos que você concedeu</SectionTitle>
              <div className="space-y-2">
                {activeIncoming.map((g) => (
                  <div
                    key={g.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{g.requesterEmail}</p>
                      <p className="text-xs text-muted-foreground">
                        Pode ver e editar sua conta — revogue quando quiser
                      </p>
                    </div>
                    <button
                      onClick={() => revokeGrant.mutate(g.id)}
                      disabled={revokeGrant.isPending}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
                    >
                      <X className="h-4 w-4" /> Revogar
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Atalhos e páginas informativas */}
          <section className="overflow-hidden rounded-2xl border border-border bg-card">
            {[
              {
                icon: Sliders,
                title: "Personalizar menu flutuante",
                desc: "Ícone e atalhos do botão de cada tela (só no celular)",
                to: "/personalizar-menu" as const,
              },
              { icon: Info, title: "Sobre o app", desc: "Versão e novidades", to: "/sobre" as const },
              {
                icon: Lock,
                title: "Privacidade",
                desc: "Como seus dados são guardados",
                to: "/privacidade" as const,
              },
            ].map((l) => (
              <button
                key={l.to}
                type="button"
                onClick={() => navigate({ to: l.to })}
                className="flex w-full items-center gap-3 border-t border-border px-4 py-3.5 text-left first:border-t-0 hover:bg-secondary/40"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                  <l.icon className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{l.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{l.desc}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </section>

          <div className="flex gap-2">
            <button
              onClick={goBack}
              className="flex-1 rounded-xl border border-border bg-card py-3 text-sm font-semibold hover:bg-secondary"
            >
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={update.isPending}
              className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {update.isPending ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
