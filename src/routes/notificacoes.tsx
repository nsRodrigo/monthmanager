import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Check,
  X,
  Clock,
  ShieldCheck,
  Trash2,
  KeyRound,
  BellOff,
} from "lucide-react";
import { HeaderBand } from "@/components/HeaderBand";
import { useIsAdmin } from "@/store/roles";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDeleteNotification,
  type AppNotification,
} from "@/store/notifications";
import { useIncomingGrants, useDecideGrant } from "@/store/account-access";
import { listPendingRequests, approveRequest, rejectRequest } from "@/lib/access-requests.functions";

export const Route = createFileRoute("/notificacoes")({
  head: () => ({ meta: [{ title: "Notificações — Finanças" }] }),
  component: NotificationsPage,
});

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d atrás`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

const KIND_ICON: Record<string, typeof Bell> = {
  access_request: KeyRound,
  signup_request: Clock,
  generic: Bell,
};

function NotificationsPage() {
  const navigate = useNavigate();
  const goBack = () => navigate({ to: "/" });
  const isAdmin = useIsAdmin();

  const { data: notifications = [], isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const deleteNotification = useDeleteNotification();
  const unreadCount = notifications.filter((n) => !n.read).length;

  const { data: incomingGrants = [] } = useIncomingGrants();
  const decideGrant = useDecideGrant();

  const listPendingFn = useServerFn(listPendingRequests);
  const approveFn = useServerFn(approveRequest);
  const rejectFn = useServerFn(rejectRequest);
  const qc = useQueryClient();
  const pendingSignupsQ = useQuery({
    queryKey: ["access-requests-pending"],
    enabled: isAdmin,
    queryFn: () => listPendingFn(),
  });
  const pendingSignupIds = new Set((pendingSignupsQ.data ?? []).map((r) => r.id));

  function openNotification(n: AppNotification) {
    if (!n.read) markRead.mutate(n.id);
    if (n.url) navigate({ to: n.url });
  }

  async function approveSignup(id: string) {
    await approveFn({ data: { id } });
    qc.invalidateQueries({ queryKey: ["access-requests-pending"] });
  }
  async function rejectSignup(id: string) {
    await rejectFn({ data: { id } });
    qc.invalidateQueries({ queryKey: ["access-requests-pending"] });
  }

  return (
    <div>
      <div className="sticky top-0 z-10">
        <HeaderBand
          compact
          title="Notificações"
          subtitle={unreadCount > 0 ? `${unreadCount} não lida${unreadCount === 1 ? "" : "s"}` : "Tudo em dia"}
          onBack={goBack}
          right={
            unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25"
              >
                Marcar todas como lidas
              </button>
            ) : undefined
          }
        />
      </div>

      <div className="mx-auto max-w-2xl px-5 pb-8 md:pb-12">
        <div className="space-y-2 pt-6 pb-20">
          {isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
              <BellOff className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">Nenhuma notificação ainda</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Avisos de vencimento, pedidos de acesso e novidades do app aparecem aqui.
              </p>
            </div>
          ) : (
            notifications.map((n) => {
              const Icon = KIND_ICON[n.kind] ?? Bell;
              const grant = n.kind === "access_request" && n.relatedId
                ? incomingGrants.find((g) => g.id === n.relatedId)
                : undefined;
              const showAccessActions = n.kind === "access_request" && grant?.status === "pending";
              const showSignupActions =
                n.kind === "signup_request" && n.relatedId && pendingSignupIds.has(n.relatedId);

              return (
                <div
                  key={n.id}
                  className={`rounded-xl border p-3 transition-colors ${
                    n.read ? "border-border bg-card/40" : "border-primary/30 bg-primary/[0.04]"
                  }`}
                >
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => openNotification(n)}
                      className="flex min-w-0 flex-1 items-start gap-3 text-left"
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                          n.read ? "bg-secondary text-muted-foreground" : "bg-primary/15 text-primary"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className={`truncate text-sm ${n.read ? "font-medium" : "font-semibold"}`}>
                            {n.title}
                          </span>
                          {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{n.body}</span>
                        <span className="mt-1 block text-[10px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteNotification.mutate(n.id)}
                      aria-label="Remover notificação"
                      className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {showAccessActions && (
                    <div className="mt-2.5 flex gap-2 pl-12">
                      <button
                        onClick={() => decideGrant.mutate({ id: grant!.id, approve: true })}
                        disabled={decideGrant.isPending}
                        className="inline-flex items-center gap-1 rounded-lg bg-success/15 px-3 py-1.5 text-xs font-semibold text-success hover:bg-success/25 disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" /> Permitir
                      </button>
                      <button
                        onClick={() => decideGrant.mutate({ id: grant!.id, approve: false })}
                        disabled={decideGrant.isPending}
                        className="inline-flex items-center gap-1 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" /> Recusar
                      </button>
                    </div>
                  )}

                  {showSignupActions && (
                    <div className="mt-2.5 flex gap-2 pl-12">
                      <button
                        onClick={() => approveSignup(n.relatedId!)}
                        className="inline-flex items-center gap-1 rounded-lg bg-success/15 px-3 py-1.5 text-xs font-semibold text-success hover:bg-success/25"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" /> Aprovar
                      </button>
                      <button
                        onClick={() => rejectSignup(n.relatedId!)}
                        className="inline-flex items-center gap-1 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10"
                      >
                        <X className="h-3.5 w-3.5" /> Recusar
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
