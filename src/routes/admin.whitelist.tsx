import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trash2, Plus, ShieldCheck, ShieldOff, UserX, Users, Check, X, Bell, Clock } from "lucide-react";
import { HeaderBand } from "@/components/HeaderBand";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useIsAdmin, useMyRoles, useWhitelist, useAddToWhitelist, useRemoveFromWhitelist } from "@/store/roles";
import { listUsers, deleteUser, setUserAdmin, type AdminUser } from "@/lib/admin-users.functions";
import {
  listPendingRequests,
  approveRequest,
  rejectRequest,
} from "@/lib/access-requests.functions";
import { getVapidPublicKey, saveSubscription } from "@/lib/push.functions";
import { subscribeToPush, isPushSupported } from "@/lib/push";
import { supabase } from "@/integrations/supabase/client";
import { useConfirm } from "@/store/confirm";

export const Route = createFileRoute("/admin/whitelist")({
  head: () => ({ meta: [{ title: "Whitelist — Admin" }] }),
  component: WhitelistAdmin,
});

function WhitelistAdmin() {
  const confirmDialog = useConfirm();
  const { isLoading } = useMyRoles();
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const goBack = () => navigate({ to: "/" });
  const { data: whitelistData, isLoading: loadingList } = useWhitelist();
  const list = Array.isArray(whitelistData) ? whitelistData : [];
  const addMut = useAddToWhitelist();
  const removeMut = useRemoveFromWhitelist();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const listUsersFn = useServerFn(listUsers);
  const deleteUserFn = useServerFn(deleteUser);
  const setUserAdminFn = useServerFn(setUserAdmin);
  const qc = useQueryClient();

  const usersQ = useQuery({
    queryKey: ["admin-users"],
    enabled: isAdmin,
    queryFn: () => listUsersFn(),
  });
  // Defesa extra: nunca deixa a lista quebrar o .map() caso o servidor
  // devolva algo que não seja um array (ex.: erro serializado como objeto).
  const usersList = Array.isArray(usersQ.data) ? usersQ.data : [];

  const revokeMut = useMutation({
    mutationFn: (vars: { userId: string; alsoRemoveWhitelist: boolean }) =>
      deleteUserFn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["whitelist"] });
    },
  });

  const setAdminMut = useMutation({
    mutationFn: (vars: { userId: string; isAdmin: boolean }) => setUserAdminFn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  // Pending requests
  const listPendingFn = useServerFn(listPendingRequests);
  const approveFn = useServerFn(approveRequest);
  const rejectFn = useServerFn(rejectRequest);
  const pendingQ = useQuery({
    queryKey: ["access-requests-pending"],
    enabled: isAdmin,
    queryFn: () => listPendingFn(),
    refetchInterval: 30000,
  });
  const pendingList = Array.isArray(pendingQ.data) ? pendingQ.data : [];
  const approveMut = useMutation({
    mutationFn: (id: string) => approveFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["access-requests-pending"] });
      qc.invalidateQueries({ queryKey: ["whitelist"] });
    },
  });
  const rejectMut = useMutation({
    mutationFn: (id: string) => rejectFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["access-requests-pending"] }),
  });

  // Push notifications
  const getVapidFn = useServerFn(getVapidPublicKey);
  const saveSubFn = useServerFn(saveSubscription);
  const [pushStatus, setPushStatus] = useState<string | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const enablePush = async () => {
    setPushStatus(null);
    setPushBusy(true);
    try {
      if (!isPushSupported()) throw new Error("Navegador não suporta notificações push.");
      const { key } = await getVapidFn();
      const sub = (await subscribeToPush(key)) as any;
      await saveSubFn({
        data: {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
          userAgent: navigator.userAgent,
        },
      });
      setPushStatus("✓ Notificações ativadas neste dispositivo.");
    } catch (e: any) {
      setPushStatus(e?.message ?? "Erro ao ativar notificações.");
    } finally {
      setPushBusy(false);
    }
  };

  useEffect(() => {
    if (!isLoading && !isAdmin) navigate({ to: "/" });
  }, [isLoading, isAdmin, navigate]);

  // Realtime: refetch pending requests when access_requests changes
  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel("admin-access-requests")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "access_requests" },
        () => {
          qc.invalidateQueries({ queryKey: ["access-requests-pending"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, qc]);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!isAdmin) return null;

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.includes("@")) {
      setError("Informe um e-mail válido.");
      return;
    }
    try {
      await addMut.mutateAsync(email);
      setEmail("");
    } catch (err: any) {
      setError(err?.message ?? "Erro ao adicionar.");
    }
  };

  const onRevoke = async (u: AdminUser) => {
    const ok = await confirmDialog({
      title: "Revogar acesso",
      description: `Revogar acesso de ${u.email}? Isso vai apagar a conta, todos os dados e remover o e-mail da whitelist.`,
      variant: "destructive",
      confirmLabel: "Revogar",
    });
    if (!ok) return;
    revokeMut.mutate({ userId: u.id, alsoRemoveWhitelist: true });
  };

  const onToggleAdmin = async (u: AdminUser) => {
    const nextIsAdmin = !u.is_admin;
    const ok = await confirmDialog({
      title: nextIsAdmin ? "Conceder admin" : "Remover admin",
      description: nextIsAdmin
        ? `Dar acesso de administrador para ${u.email}? A pessoa poderá gerenciar a whitelist, usuários e permissões de admin.`
        : `Remover o acesso de administrador de ${u.email}?`,
      variant: nextIsAdmin ? "default" : "destructive",
      confirmLabel: nextIsAdmin ? "Conceder" : "Remover",
    });
    if (!ok) return;
    setAdminMut.mutate({ userId: u.id, isAdmin: nextIsAdmin });
  };

  return (
    <div>
      <div className="sticky top-0 z-10">
        <HeaderBand
          title="Administração"
          subtitle="Whitelist de cadastros e usuários ativos."
          onBack={goBack}
        />
      </div>
      <div className="mx-auto max-w-3xl px-5 pb-8 md:pb-12">
      <div className="space-y-6 pt-6 pb-20">

      {/* Push notifications */}
      <section className="rounded-xl border border-border bg-card/40 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Notificações push</span>
          </div>
          <button
            onClick={enablePush}
            disabled={pushBusy}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
          >
            {pushBusy ? "Ativando…" : "Ativar neste dispositivo"}
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Receba alerta quando alguém solicitar acesso. Funciona melhor no app instalado (PWA).
        </p>
        {pushStatus && <p className="mt-2 text-xs">{pushStatus}</p>}
      </section>

      {/* Pending requests */}
      <section className="rounded-xl border border-border bg-card/40 p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Clock className="h-4 w-4 text-primary" /> Solicitações pendentes
          {pendingList.length > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
              {pendingList.length}
            </span>
          )}
        </h2>
        {pendingQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : pendingQ.error ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            Erro ao carregar solicitações: {(pendingQ.error as Error).message}
          </p>
        ) : pendingList.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-background/50 p-6 text-center text-sm text-muted-foreground">
            Nenhuma solicitação pendente.
          </p>
        ) : (
          <div className="space-y-2">
            {pendingList.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.requested_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                <button
                  onClick={() => approveMut.mutate(r.id)}
                  disabled={approveMut.isPending || rejectMut.isPending}
                  className="inline-flex items-center gap-1 rounded-lg bg-success/15 px-3 py-2 text-xs font-semibold text-success hover:bg-success/25 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" /> Aprovar
                </button>
                <button
                  onClick={() => rejectMut.mutate(r.id)}
                  disabled={approveMut.isPending || rejectMut.isPending}
                  className="inline-flex items-center gap-1 rounded-lg border border-destructive/30 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  <X className="h-4 w-4" /> Recusar
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card/40 p-4">
        <h2 className="mb-3 text-sm font-semibold">Whitelist</h2>
        <form onSubmit={onAdd} className="flex gap-2 rounded-lg border border-border bg-background p-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@dominio.com"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={addMut.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            <Plus className="h-4 w-4" /> Adicionar
          </button>
        </form>
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

        <div className="mt-4 space-y-2">
          {loadingList ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : list.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-background/50 p-6 text-center text-sm text-muted-foreground">
              Nenhum e-mail na whitelist ainda.
            </p>
          ) : (
            list.map((w) => (
              <div key={w.id} className="flex items-center justify-between rounded-lg border border-border bg-background p-3">
                <span className="truncate text-sm">{w.email}</span>
                <button
                  onClick={() => removeMut.mutate(w.id)}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Remover"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card/40 p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Users className="h-4 w-4 text-primary" /> Usuários cadastrados
        </h2>

        {usersQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando usuários…</p>
        ) : usersQ.error ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            Erro ao carregar usuários: {(usersQ.error as Error).message}
          </p>
        ) : usersList.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-background/50 p-6 text-center text-sm text-muted-foreground">
            Nenhum usuário cadastrado ainda.
          </p>
        ) : (
          <div className="space-y-2">
            {usersList.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{u.email ?? "(sem email)"}</p>
                    {u.is_admin && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                        Admin
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Último acesso: {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString("pt-BR") : "nunca"}
                  </p>
                </div>
                <button
                  onClick={() => onToggleAdmin(u)}
                  disabled={setAdminMut.isPending}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50 ${
                    u.is_admin
                      ? "border-border text-muted-foreground hover:bg-secondary"
                      : "border-primary/30 text-primary hover:bg-primary/10"
                  }`}
                >
                  {u.is_admin ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                  {u.is_admin ? "Remover admin" : "Tornar admin"}
                </button>
                <button
                  onClick={() => onRevoke(u)}
                  disabled={revokeMut.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
                  aria-label="Revogar acesso"
                >
                  <UserX className="h-4 w-4" /> Revogar
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
      </div>
      </div>
    </div>
  );
}
