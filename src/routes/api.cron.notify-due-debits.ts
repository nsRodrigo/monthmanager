import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { notifyUsers } from "@/server/push.server";

// Endpoint chamado 1x/dia pelo pg_cron do Supabase (via pg_net) — ver
// supabase/migrations/20260728000000_due_debit_notifications.sql e
// 20260826010000_income_card_due_notifications.sql.
// Protegido por um segredo compartilhado (header x-cron-secret) em vez de
// autenticação de usuário, já que quem chama é o próprio banco de dados.
//
// Cobre 3 tipos de aviso de vencimento: débitos, recebimentos (ambos
// avulsos, notificados uma única vez via due_notified_at) e faturas de
// cartão (recorrentes mês a mês — due_notified_at é comparado contra o
// início do mês corrente pra permitir 1 aviso por fatura/mês).

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

const fmtCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (dateStr: string) => new Date(`${dateStr}T00:00:00`).toLocaleDateString("pt-BR");

async function notifyDueDebits(): Promise<{ checked: number; notified: number }> {
  const { data: debits, error } = await supabaseAdmin
    .from("debits")
    .select("id,user_id,description,amount,date,notify_days_before")
    .eq("paid", false)
    .is("due_notified_at", null)
    .not("notify_days_before", "is", null);
  if (error) throw new Error(error.message);

  const today = todayISO();
  const due = (debits ?? []).filter((d) => daysUntil(d.date, today) <= (d.notify_days_before ?? 0));
  if (due.length === 0) return { checked: 0, notified: 0 };

  const byUser = new Map<string, typeof due>();
  for (const d of due) byUser.set(d.user_id, [...(byUser.get(d.user_id) ?? []), d]);

  const notifiedIds: string[] = [];
  for (const [userId, items] of byUser) {
    const body =
      items.length === 1
        ? `${items[0].description} (${fmtCurrency(items[0].amount)}) vence em ${fmtDate(items[0].date)}`
        : `${items.length} contas a vencer: ${items.map((i) => i.description).join(", ")}`;
    const result = await notifyUsers([userId], {
      title: items.length === 1 ? "Conta a vencer" : "Contas a vencer",
      body,
      url: "/",
    });
    if (result.sent > 0) notifiedIds.push(...items.map((i) => i.id));
  }

  if (notifiedIds.length > 0) {
    await supabaseAdmin.from("debits").update({ due_notified_at: new Date().toISOString() }).in("id", notifiedIds);
  }
  return { checked: due.length, notified: notifiedIds.length };
}

async function notifyDueIncomes(): Promise<{ checked: number; notified: number }> {
  const { data: incomes, error } = await supabaseAdmin
    .from("incomes")
    .select("id,user_id,description,amount,date,notify_days_before")
    .eq("received", false)
    .is("due_notified_at", null)
    .not("notify_days_before", "is", null);
  if (error) throw new Error(error.message);

  const today = todayISO();
  const due = (incomes ?? []).filter((d) => daysUntil(d.date, today) <= (d.notify_days_before ?? 0));
  if (due.length === 0) return { checked: 0, notified: 0 };

  const byUser = new Map<string, typeof due>();
  for (const d of due) byUser.set(d.user_id, [...(byUser.get(d.user_id) ?? []), d]);

  const notifiedIds: string[] = [];
  for (const [userId, items] of byUser) {
    const body =
      items.length === 1
        ? `${items[0].description} (${fmtCurrency(items[0].amount)}) previsto em ${fmtDate(items[0].date)}`
        : `${items.length} recebimentos previstos: ${items.map((i) => i.description).join(", ")}`;
    const result = await notifyUsers([userId], {
      title: items.length === 1 ? "Recebimento a vencer" : "Recebimentos a vencer",
      body,
      url: "/",
    });
    if (result.sent > 0) notifiedIds.push(...items.map((i) => i.id));
  }

  if (notifiedIds.length > 0) {
    await supabaseAdmin.from("incomes").update({ due_notified_at: new Date().toISOString() }).in("id", notifiedIds);
  }
  return { checked: due.length, notified: notifiedIds.length };
}

/** Compras recorrentes (assinaturas) no cartão — cada ocorrência é uma linha própria em `purchases`, com uma parcela (installments) paga/não paga. */
async function notifyDuePurchases(): Promise<{ checked: number; notified: number }> {
  const { data: purchases, error } = await supabaseAdmin
    .from("purchases")
    .select("id,user_id,description,total_amount,purchase_date,notify_days_before")
    .is("due_notified_at", null)
    .not("notify_days_before", "is", null);
  if (error) throw new Error(error.message);
  if (!purchases || purchases.length === 0) return { checked: 0, notified: 0 };

  const today = todayISO();
  const candidates = purchases.filter((p) => daysUntil(p.purchase_date, today) <= (p.notify_days_before ?? 0));
  if (candidates.length === 0) return { checked: 0, notified: 0 };

  const { data: insts, error: instError } = await supabaseAdmin
    .from("installments")
    .select("parent_id,paid")
    .eq("parent_type", "purchase")
    .in("parent_id", candidates.map((p) => p.id));
  if (instError) throw new Error(instError.message);
  const paidByPurchaseId = new Map((insts ?? []).map((i) => [i.parent_id, i.paid]));
  const due = candidates.filter((p) => paidByPurchaseId.get(p.id) !== true);
  if (due.length === 0) return { checked: 0, notified: 0 };

  const byUser = new Map<string, typeof due>();
  for (const p of due) byUser.set(p.user_id, [...(byUser.get(p.user_id) ?? []), p]);

  const notifiedIds: string[] = [];
  for (const [userId, items] of byUser) {
    const body =
      items.length === 1
        ? `${items[0].description} (${fmtCurrency(items[0].total_amount)}) vence em ${fmtDate(items[0].purchase_date)}`
        : `${items.length} assinaturas a vencer: ${items.map((i) => i.description).join(", ")}`;
    const result = await notifyUsers([userId], {
      title: items.length === 1 ? "Assinatura a vencer" : "Assinaturas a vencer",
      body,
      url: "/",
    });
    if (result.sent > 0) notifiedIds.push(...items.map((i) => i.id));
  }

  if (notifiedIds.length > 0) {
    await supabaseAdmin.from("purchases").update({ due_notified_at: new Date().toISOString() }).in("id", notifiedIds);
  }
  return { checked: due.length, notified: notifiedIds.length };
}

/** Faturas de cartão: recorrente mês a mês — due_notified_at só bloqueia reenvio dentro do mesmo mês. */
async function notifyCardInvoices(): Promise<{ checked: number; notified: number }> {
  const { data: cards, error } = await supabaseAdmin
    .from("cards")
    .select("id,user_id,name,due_day,notify_days_before,due_notified_at")
    .not("notify_days_before", "is", null);
  if (error) throw new Error(error.message);
  if (!cards || cards.length === 0) return { checked: 0, notified: 0 };

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthStartISO = new Date(year, month, 1).toISOString();
  const today = todayISO();
  const lastDay = new Date(year, month + 1, 0).getDate();

  const due: Array<{ id: string; user_id: string; name: string; dueDateStr: string }> = [];
  for (const c of cards) {
    if (c.due_notified_at && c.due_notified_at >= monthStartISO) continue; // já avisado este mês
    const day = Math.min(c.due_day ?? 5, lastDay);
    const dueDateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (daysUntil(dueDateStr, today) > (c.notify_days_before ?? 0)) continue;

    const { data: payment } = await supabaseAdmin
      .from("card_payments")
      .select("paid")
      .eq("card_id", c.id)
      .eq("year", year)
      .eq("month", month)
      .maybeSingle();
    if (payment?.paid) continue;

    due.push({ id: c.id, user_id: c.user_id, name: c.name, dueDateStr });
  }
  if (due.length === 0) return { checked: 0, notified: 0 };

  const byUser = new Map<string, typeof due>();
  for (const c of due) byUser.set(c.user_id, [...(byUser.get(c.user_id) ?? []), c]);

  const notifiedIds: string[] = [];
  for (const [userId, items] of byUser) {
    const body =
      items.length === 1
        ? `Fatura do ${items[0].name} vence em ${fmtDate(items[0].dueDateStr)}`
        : `${items.length} faturas a vencer: ${items.map((i) => i.name).join(", ")}`;
    const result = await notifyUsers([userId], {
      title: items.length === 1 ? "Fatura a vencer" : "Faturas a vencer",
      body,
      url: "/",
    });
    if (result.sent > 0) notifiedIds.push(...items.map((i) => i.id));
  }

  if (notifiedIds.length > 0) {
    await supabaseAdmin.from("cards").update({ due_notified_at: new Date().toISOString() }).in("id", notifiedIds);
  }
  return { checked: due.length, notified: notifiedIds.length };
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

        try {
          const [debits, incomes, purchases, cards] = await Promise.all([
            notifyDueDebits(),
            notifyDueIncomes(),
            notifyDuePurchases(),
            notifyCardInvoices(),
          ]);
          return Response.json({ ok: true, debits, incomes, purchases, cards });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
