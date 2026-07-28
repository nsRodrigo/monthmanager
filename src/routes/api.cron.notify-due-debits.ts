import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { notifyUsers } from "@/server/push.server";

// Endpoint chamado 1x/dia pelo pg_cron do Supabase (via pg_net) — ver
// supabase/migrations/20260728000000_due_debit_notifications.sql.
// Protegido por um segredo compartilhado (header x-cron-secret) em vez de
// autenticação de usuário, já que quem chama é o próprio banco de dados.

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Diferença em dias (dateStr - todayStr), positivo = no futuro. */
function daysUntil(dateStr: string, todayStr: string): number {
  const [y1, m1, d1] = dateStr.slice(0, 10).split("-").map(Number);
  const [y2, m2, d2] = todayStr.slice(0, 10).split("-").map(Number);
  const a = Date.UTC(y1, (m1 || 1) - 1, d1 || 1);
  const b = Date.UTC(y2, (m2 || 1) - 1, d2 || 1);
  return Math.round((a - b) / 86400000);
}

export const Route = createFileRoute("/api/cron/notify-due-debits")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        if (!secret) {
          return new Response("CRON_SECRET não configurado no servidor.", { status: 500 });
        }
        if (request.headers.get("x-cron-secret") !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { data: debits, error } = await supabaseAdmin
          .from("debits")
          .select("id,user_id,description,amount,date,notify_days_before")
          .eq("paid", false)
          .is("due_notified_at", null)
          .not("notify_days_before", "is", null);
        if (error) {
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        const today = todayISO();
        const due = (debits ?? []).filter(
          (d) => daysUntil(d.date, today) <= (d.notify_days_before ?? 0),
        );

        if (due.length === 0) {
          return Response.json({ ok: true, checked: 0, notified: 0 });
        }

        const byUser = new Map<string, typeof due>();
        for (const d of due) {
          const list = byUser.get(d.user_id) ?? [];
          list.push(d);
          byUser.set(d.user_id, list);
        }

        const notifiedIds: string[] = [];
        for (const [userId, items] of byUser) {
          const fmt = (v: number) =>
            v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
          const body =
            items.length === 1
              ? `${items[0].description} (${fmt(items[0].amount)}) vence em ${new Date(
                  `${items[0].date}T00:00:00`,
                ).toLocaleDateString("pt-BR")}`
              : `${items.length} contas a vencer: ${items.map((i) => i.description).join(", ")}`;
          const result = await notifyUsers([userId], {
            title: items.length === 1 ? "Conta a vencer" : "Contas a vencer",
            body,
            url: "/",
          });
          if (result.sent > 0) notifiedIds.push(...items.map((i) => i.id));
        }

        if (notifiedIds.length > 0) {
          await supabaseAdmin
            .from("debits")
            .update({ due_notified_at: new Date().toISOString() })
            .in("id", notifiedIds);
        }

        return Response.json({ ok: true, checked: due.length, notified: notifiedIds.length });
      },
    },
  },
});
