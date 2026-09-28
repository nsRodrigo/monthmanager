import { useState } from "react";
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

type NotifFilter = "all" | "unread" | "due" | "acc";

function NotificationsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<NotifFilter>("all");
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

  const isAccessKind = (k: string) => k === "access_request" || k === "signup_request";
  const FILTERS: { key: NotifFilter; label: string; test: (n: AppNotification) => boolean }[] = [
    { key: "all", label: "Todas", test: () => true },
    { key: "unread", label: "Não lidas", test: (n) => !n.read },
    { key: "due", label: "Vencimentos e avisos", test: (n) => !isAccessKind(n.kind) },
    { key: "acc", label: "Acessos", test: (n) => isAccessKind(n.kind) },
  ];
  const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];
  const visible = notifications.filter(active.test);

  /** Agrupa por idade: Hoje · Ontem · Esta semana · Anteriores (ordem de chegada preservada). */
  const groupOf = (iso: string) => {
    const d = new Date(iso);
    const t0 = new Date();
    t0.setHours(0, 0, 0, 0);
    const days = Math.floor((t0.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86_400_000);
    if (days <= 0) return "Hoje";
    if (days === 1) return "Ontem";
    if (days < 7) return "Esta semana";
    return "Anteriores";
  };
  const groups = ["Hoje", "Ontem", "Esta semana", "Anteriores"]
    .map((g) => ({ g, items: visible.filter((n) => groupOf(n.createdAt) === g) }))
    .filter((x) => x.items.length > 0);

  return (
    <div>
      <div className="sticky top-0 z-10">
        <HeaderBand
          title="Notificações"
          subtitle={unreadCount > 0 ? `${unreadCount} não lida${unreadCount === 1 ? "" : "s"}` : "Tudo em dia"}
          onBack={goBack}
        />
      </div>

      <div className="mx-auto max-w-3xl px-4 pt-5 pb-24 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <div
            role="group"
            aria-label="Filtrar notificações"
            className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-xl border border-border bg-card p-[3px]"
          >
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors ${
                  filter === f.key ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
                {f.key === "unread" && unreadCount > 0 && (
                  <span className="rounded-full bg-primary/15 px-1.5 py-px text-[10.5px] font-semibold text-primary">
                    {unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>
          <span className="flex-1" />
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAllRead.mutate()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-semibold hover:bg-muted"
            >
              <Check className="h-3.5 w-3.5" /> Marcar todas como lidas
            </button>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
              <BellOff className="h-7 w-7 text-muted-foreground" />
              <p className="text-sm font-semibold">Nenhuma notificação aqui</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Avisos de vencimento, pedidos de acesso e novidades do app aparecem neste lugar.
              </p>
            </div>
          ) : (
            groups.map(({ g, items }) => (
              <div key={g}>
                <p className="px-4 pt-3.5 pb-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  {g}
                </p>
                {items.map((n) => {
                  const Icon = KIND_ICON[n.kind] ?? Bell;
                  const grant =
                    n.kind === "access_request" && n.relatedId
                      ? incomingGrants.find((gr) => gr.id === n.relatedId)
                      : undefined;
                  const showAccessActions = n.kind === "access_request" && grant?.status === "pending";
                  const showSignupActions =
                    n.kind === "signup_request" && n.relatedId && pendingSignupIds.has(n.relatedId);

                  return (
                    <div
                      key={n.id}
                      className={`flex gap-3.5 border-t border-border p-4 first:border-t-0 ${
                        n.read ? "" : "bg-gradient-to-r from-primary/[0.08] to-transparent"
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                          n.kind === "access_request"
                            ? "bg-invest/20 text-invest"
                            : n.kind === "signup_request"
                              ? "bg-primary/15 text-primary"
                              : n.read
                                ? "bg-secondary text-muted-foreground"
                                : "bg-debit/20 text-debit"
                        }`}
                      >
                        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => openNotification(n)}
                            className="min-w-0 text-left"
                          >
                            <span className="block text-sm font-semibold">{n.title}</span>
                            <span className="mt-0.5 block text-sm text-muted-foreground">{n.body}</span>
                            <span className="mt-1.5 block text-xs text-muted-foreground/80">{timeAgo(n.createdAt)}</span>
                          </button>
                          <div className="flex shrink-0 items-center gap-1">
                            {!n.read && (
                              <button
                                type="button"
                                onClick={() => markRead.mutate(n.id)}
                                aria-label="Marcar como lida"
                                title="Marcar como lida"
                                className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-secondary"
                              >
                                <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => deleteNotification.mutate(n.id)}
                              aria-label="Remover notificação"
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {showAccessActions && (
                          <div className="mt-2.5 flex gap-2">
                            <button
                              onClick={() => decideGrant.mutate({ id: grant!.id, approve: true })}
                              disabled={decideGrant.isPending}
                              className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
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
                          <div className="mt-2.5 flex gap-2">
                            <button
                              onClick={() => approveSignup(n.relatedId!)}
                              className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
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
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
