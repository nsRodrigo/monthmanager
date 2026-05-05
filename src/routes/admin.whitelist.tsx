import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, Trash2, Plus, ShieldCheck, UserX, Users, Check, X, Bell, Clock } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useIsAdmin, useMyRoles, useWhitelist, useAddToWhitelist, useRemoveFromWhitelist } from "@/store/roles";
import { listUsers, deleteUser, type AdminUser } from "@/server/admin-users.functions";
import {
  listPendingRequests,
  approveRequest,
  rejectRequest,
} from "@/server/access-requests.functions";
import { getVapidPublicKey, saveSubscription } from "@/server/push.functions";
import { subscribeToPush, isPushSupported } from "@/lib/push";

export const Route = createFileRoute("/admin/whitelist")({
  head: () => ({ meta: [{ title: "Whitelist — Admin" }] }),
  component: WhitelistAdmin,
});

function WhitelistAdmin() {
  const { isLoading } = useMyRoles();
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const { data: list = [], isLoading: loadingList } = useWhitelist();
  const addMut = useAddToWhitelist();
  const removeMut = useRemoveFromWhitelist();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const listUsersFn = useServerFn(listUsers);
  const deleteUserFn = useServerFn(deleteUser);
  const qc = useQueryClient();

  const usersQ = useQuery({
    queryKey: ["admin-users"],
    enabled: isAdmin,
    queryFn: () => listUsersFn(),
  });

  const revokeMut = useMutation({
    mutationFn: (vars: { userId: string; alsoRemoveWhitelist: boolean }) =>
      deleteUserFn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["whitelist"] });
    },
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

  const onRevoke = (u: AdminUser) => {
    if (!confirm(`Revogar acesso de ${u.email}?\n\nIsso vai apagar a conta, todos os dados e remover o e-mail da whitelist. Ação irreversível.`)) return;
    revokeMut.mutate({ userId: u.id, alsoRemoveWhitelist: true });
  };

  return (
    <div className="mx-auto max-w-2xl px-5 py-8 md:py-12">
      <Link to="/" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Home
      </Link>

      <header className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Administração</h1>
          <p className="text-sm text-muted-foreground">Whitelist de cadastros e usuários ativos.</p>
        </div>
      </header>

      {/* Push notifications */}
      <section className="mb-6 rounded-2xl border border-border bg-card p-4">
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
      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Clock className="h-4 w-4" /> Solicitações pendentes
          {(pendingQ.data?.length ?? 0) > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
              {pendingQ.data!.length}
            </span>
          )}
        </h2>
        {pendingQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (pendingQ.data ?? []).length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
            Nenhuma solicitação pendente.
          </p>
        ) : (
          <div className="space-y-2">
            {(pendingQ.data ?? []).map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3">
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

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Whitelist</h2>
        <form onSubmit={onAdd} className="flex gap-2 rounded-2xl border border-border bg-card p-3">
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
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-60"
          >
            <Plus className="h-4 w-4" /> Adicionar
          </button>
        </form>
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

        <div className="mt-4 space-y-2">
          {loadingList ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : list.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
              Nenhum e-mail na whitelist ainda.
            </p>
          ) : (
            list.map((w) => (
              <div key={w.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
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

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Users className="h-4 w-4" /> Usuários cadastrados
        </h2>

        {usersQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando usuários…</p>
        ) : usersQ.error ? (
          <p className="text-sm text-destructive">Erro: {(usersQ.error as Error).message}</p>
        ) : (
          <div className="space-y-2">
            {(usersQ.data ?? []).map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
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
  );
}
