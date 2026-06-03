import { useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";
import { history } from "./history";

// =======================
// Types (camelCase domain)
// =======================
export type AccountType = "corrente" | "digital" | "carteira" | "investimento";

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  color: string;
  initialBalance: number;
};

export type Card = {
  id: string;
  accountId: string;
  name: string;
  color: string;
  closingDay: number;
  dueDay: number;
  startYear: number | null;
  startMonth: number | null;
  endYear: number | null;
  endMonth: number | null;
  excludedMonths: string[]; // ["YYYY-MM"]
  position: number;
};

/**
 * Visibility scope for card mutations (add/edit/delete).
 * - 'all'    → applies globally for the account (no time window)
 * - 'period' → applies only between [startYM, endYM]
 * - 'month'  → applies only to the single given year/month
 */
export type CardScope =
  | { kind: "all" }
  | { kind: "period"; startYear: number; startMonth: number; endYear: number; endMonth: number }
  | { kind: "month"; year: number; month: number };

function ymKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

/** Returns true when a card should be visible in the given year/month. */
export function isCardVisibleInMonth(card: Card, year: number, month: number): boolean {
  const ym = year * 12 + month;
  if (card.startYear != null && card.startMonth != null) {
    if (ym < card.startYear * 12 + card.startMonth) return false;
  }
  if (card.endYear != null && card.endMonth != null) {
    if (ym > card.endYear * 12 + card.endMonth) return false;
  }
  if (card.excludedMonths?.includes(ymKey(year, month))) return false;
  return true;
}


function scopeToWindow(scope: CardScope): {
  start_year: number | null;
  start_month: number | null;
  end_year: number | null;
  end_month: number | null;
} {
  if (scope.kind === "all") {
    return { start_year: null, start_month: null, end_year: null, end_month: null };
  }
  if (scope.kind === "month") {
    return {
      start_year: scope.year,
      start_month: scope.month,
      end_year: scope.year,
      end_month: scope.month,
    };
  }
  return {
    start_year: scope.startYear,
    start_month: scope.startMonth,
    end_year: scope.endYear,
    end_month: scope.endMonth,
  };
}

export type Purchase = {
  id: string;
  cardId: string;
  description: string;
  totalAmount: number;
  date: string;
  installmentsCount: number;
};

export type ParentType = "purchase" | "debit" | "income";

export type Installment = {
  id: string;
  parentType: ParentType;
  parentId: string;
  purchaseId: string | null;
  number: number;
  total: number;
  amount: number;
  dueDate: string;
  year: number;
  month: number;
  paid: boolean;
};

export type Debit = {
  id: string;
  accountId: string;
  description: string;
  amount: number;
  date: string;
  required: boolean;
  paid: boolean;
  autoDebit: boolean;
  autoDebitDay: number | null;
  installmentsCount: number;
  isParent: boolean;
  /** Group id linking all monthly occurrences of a recurring series. */
  recurrenceGroupId: string | null;
};

export type Income = {
  id: string;
  accountId: string;
  description: string;
  amount: number;
  date: string;
  received: boolean;
  installmentsCount: number;
  isParent: boolean;
  /** Group id linking all monthly occurrences of a recurring series. */
  recurrenceGroupId: string | null;
};

export type Investment = {
  id: string;
  accountId: string;
  type: string;
  amount: number;
  percentage: number;
  date: string;
};

// =======================
// Helpers
// =======================
const round2 = (n: number) => Math.round(n * 100) / 100;

async function fetchAllRows<T>(
  queryFactory: (signal?: AbortSignal) => any,
  pageSize = 1000,
  signal?: AbortSignal,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    if (signal?.aborted) throw new DOMException("Query cancelled", "AbortError");
    const { data, error } = await queryFactory(signal).range(from, from + pageSize - 1);
    if (error) throw error;
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

function uniqueById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

/**
 * Compute the invoice (fatura) month/year for a credit-card purchase.
 *
 * Rule: a purchase made before or on `closingDay` belongs to the invoice
 * that closes in the *current* month and is due in the *next* month.
 * A purchase made after `closingDay` rolls over to the *next* invoice
 * (closes next month, due in two months).
 *
 * Returns the year + month (0-indexed) of the invoice's DUE date — that
 * is the month the user actually pays, and the month we want all UI to
 * group the installment under.
 */
export function getInvoiceMonth(
  purchaseDate: string | Date,
  closingDay: number,
  dueDay: number,
): { year: number; month: number; dueDate: string } {
  // Parse "YYYY-MM-DD" como data local (sem shift de fuso UTC).
  const parsed =
    typeof purchaseDate === "string"
      ? (() => {
          const [yy, mm, dd] = purchaseDate.slice(0, 10).split("-").map(Number);
          return { y: yy, m: (mm || 1) - 1, d: dd || 1 };
        })()
      : { y: purchaseDate.getFullYear(), m: purchaseDate.getMonth(), d: purchaseDate.getDate() };
  const purchaseDay = parsed.d;
  // If purchase happens AFTER the closing day, the invoice closes next month
  // and is due the month after. Otherwise it closes this month and is due next.
  const monthsAhead = purchaseDay > closingDay ? 2 : 1;
  const target = new Date(parsed.y, parsed.m + monthsAhead, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const day = Math.min(dueDay, lastDay);
  const due = new Date(target.getFullYear(), target.getMonth(), day);
  return {
    year: due.getFullYear(),
    month: due.getMonth(),
    dueDate: fmtLocalDate(due.getFullYear(), due.getMonth(), due.getDate()),
  };
}

export function buildInstallments(
  parentId: string,
  parentType: ParentType,
  userId: string,
  totalAmount: number,
  installmentsCount: number,
  startDate: string,
  paid = false,
) {
  const count = Math.max(1, installmentsCount);
  const base = round2(totalAmount / count);
  // Parse "YYYY-MM-DD" como data local (sem shift de fuso UTC).
  const [sY, sM, sD] = startDate.slice(0, 10).split("-").map(Number);
  const start = new Date(sY, (sM || 1) - 1, sD || 1);
  const dayOfMonth = start.getDate();
  let accum = 0;
  const items: Array<{
    user_id: string;
    parent_id: string;
    parent_type: ParentType;
    purchase_id: string | null;
    number: number;
    total: number;
    amount: number;
    due_date: string;
    year: number;
    month: number;
    paid: boolean;
  }> = [];
  for (let i = 0; i < count; i++) {
    const target = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    const day = Math.min(dayOfMonth, lastDay);
    const d = new Date(target.getFullYear(), target.getMonth(), day);
    const amount = i === count - 1 ? round2(totalAmount - accum) : base;
    accum += amount;
    items.push({
      user_id: userId,
      parent_id: parentId,
      parent_type: parentType,
      purchase_id: parentType === "purchase" ? parentId : null,
      number: i + 1,
      total: count,
      amount,
      due_date: fmtLocalDate(d.getFullYear(), d.getMonth(), d.getDate()),
      year: d.getFullYear(),
      month: d.getMonth(),
      paid,
    });
  }
  return items;
}

/**
 * Build installments for a credit-card purchase using the INVOICE-MONTH rule.
 *
 * The first installment goes into the month that the next invoice is due
 * (based on closingDay/dueDay), and subsequent installments fall on the same
 * dueDay each following month. The purchase date itself is informational only.
 */
export function buildInstallmentsForPurchase(
  purchaseId: string,
  userId: string,
  totalAmount: number,
  installmentsCount: number,
  purchaseDate: string,
  closingDay: number,
  dueDay: number,
) {
  const count = Math.max(1, installmentsCount);
  const base = round2(totalAmount / count);
  const first = getInvoiceMonth(purchaseDate, closingDay, dueDay);
  let accum = 0;
  const items: Array<{
    user_id: string;
    parent_id: string;
    parent_type: ParentType;
    purchase_id: string | null;
    number: number;
    total: number;
    amount: number;
    due_date: string;
    year: number;
    month: number;
    paid: boolean;
  }> = [];
  for (let i = 0; i < count; i++) {
    const target = new Date(first.year, first.month + i, 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    const day = Math.min(dueDay, lastDay);
    const d = new Date(target.getFullYear(), target.getMonth(), day);
    const amount = i === count - 1 ? round2(totalAmount - accum) : base;
    accum += amount;
    items.push({
      user_id: userId,
      parent_id: purchaseId,
      parent_type: "purchase",
      purchase_id: purchaseId,
      number: i + 1,
      total: count,
      amount,
      due_date: fmtLocalDate(d.getFullYear(), d.getMonth(), d.getDate()),
      year: d.getFullYear(),
      month: d.getMonth(),
      paid: false,
    });
  }
  return items;
}

/**
 * Build installments anchored at a known position.
 * Used by CSV import where one line represents an existing installment plan
 * already in progress (e.g. "parcela 5 de 12, vence em 2026-05-01").
 *
 * - The anchor installment lands on `anchorDate` month/day.
 * - Earlier installments roll back month-by-month and are marked PAID.
 * - Later installments roll forward month-by-month, not paid.
 */
export function buildInstallmentsAnchored(
  parentId: string,
  userId: string,
  totalAmount: number,
  installmentsCount: number,
  anchorNumber: number,
  anchorDate: string,
  parentType: ParentType = "purchase",
  paidPast = true,
) {
  const count = Math.max(1, installmentsCount);
  const anchor = Math.min(Math.max(1, anchorNumber), count);
  const base = round2(totalAmount / count);
  const [ay, am, ad] = anchorDate
    .slice(0, 10)
    .split("-")
    .map((n) => parseInt(n, 10));
  const anchorYear = ay;
  const anchorMonth = (am || 1) - 1;
  const anchorDay = ad || 1;
  let accum = 0;
  const items: Array<{
    user_id: string;
    parent_id: string;
    parent_type: ParentType;
    purchase_id: string | null;
    number: number;
    total: number;
    amount: number;
    due_date: string;
    year: number;
    month: number;
    paid: boolean;
  }> = [];
  for (let i = 1; i <= count; i++) {
    const monthOffset = i - anchor;
    const target = new Date(anchorYear, anchorMonth + monthOffset, 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    const day = Math.min(anchorDay, lastDay);
    const d = new Date(target.getFullYear(), target.getMonth(), day);
    const amount = i === count ? round2(totalAmount - accum) : base;
    accum += amount;
    items.push({
      user_id: userId,
      parent_id: parentId,
      parent_type: parentType,
      purchase_id: parentType === "purchase" ? parentId : null,
      number: i,
      total: count,
      amount,
      due_date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      year: d.getFullYear(),
      month: d.getMonth(),
      paid: paidPast ? i < anchor : false,
    });
  }
  return items;
}

const num = (v: number | string) => (typeof v === "number" ? v : parseFloat(v));

// =======================
// Queries
// =======================
export function useAccounts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["accounts", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Account[]> => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id,name,type,color,initial_balance")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type as AccountType,
        color: a.color,
        initialBalance: num(a.initial_balance as number | string),
      }));
    },
  });
}

export function useCards() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["cards", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Card[]> => {
      const { data, error } = await supabase
        .from("cards")
        .select(
          "id,account_id,name,color,closing_day,due_day,start_year,start_month,end_year,end_month,excluded_months,position,created_at",
        )
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((c: any) => ({
        id: c.id,
        accountId: c.account_id,
        name: c.name,
        color: c.color,
        closingDay: c.closing_day,
        dueDay: c.due_day,
        startYear: c.start_year ?? null,
        startMonth: c.start_month ?? null,
        endYear: c.end_year ?? null,
        endMonth: c.end_month ?? null,
        excludedMonths: (c.excluded_months ?? []) as string[],
        position: (c.position as number) ?? 0,
      }));
    },
  });
}

export function usePurchases() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["purchases", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Purchase[]> => {
      const data = await fetchAllRows<{
        id: string;
        card_id: string;
        description: string;
        total_amount: number | string;
        purchase_date: string;
        installments_count: number;
      }>(() =>
        supabase
          .from("purchases")
          .select("id,card_id,description,total_amount,purchase_date,installments_count"),
      );
      return data.map((p) => ({
        id: p.id,
        cardId: p.card_id,
        description: p.description,
        totalAmount: num(p.total_amount as number | string),
        date: p.purchase_date,
        installmentsCount: p.installments_count,
      }));
    },
  });
}

export function useInstallments() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["installments", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Installment[]> => {
      const data = await fetchAllRows<{
        id: string;
        parent_type: string;
        parent_id: string | null;
        purchase_id: string | null;
        number: number;
        total: number;
        amount: number | string;
        due_date: string;
        year: number;
        month: number;
        paid: boolean;
      }>(() =>
        supabase
          .from("installments")
          .select(
            "id,parent_type,parent_id,purchase_id,number,total,amount,due_date,year,month,paid",
          )
          .order("year", { ascending: true })
          .order("month", { ascending: true })
          .order("number", { ascending: true })
          // Tiebreaker estável: sem isso, parcelas com (year, month, number)
          // iguais (ex.: #4 de várias compras no mesmo mês) podem cair em
          // ordem não-determinística entre páginas de 1000 linhas e algumas
          // somem do resultado paginado. Ordenar por id garante paginação
          // estável e impede que parcelas "desapareçam" da tela.
          .order("id", { ascending: true }),
      );
      return uniqueById(data).map((i) => ({
        id: i.id,
        parentType: i.parent_type as ParentType,
        parentId: i.parent_id ?? "",
        purchaseId: i.purchase_id,
        number: i.number,
        total: i.total,
        amount: num(i.amount as number | string),
        dueDate: i.due_date,
        year: i.year,
        month: i.month,
        paid: i.paid,
      }));
    },
  });
}

export function useDebits() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["debits", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }): Promise<Debit[]> => {
      const data = await fetchAllRows<{
        id: string;
        account_id: string;
        description: string;
        amount: number | string;
        date: string;
        required: boolean;
        paid: boolean;
        auto_debit: boolean;
        auto_debit_day: number | null;
        installments_count: number;
        is_parent: boolean;
        recurrence_group_id: string | null;
      }>(
        (abortSignal) => {
          const query = supabase
            .from("debits")
            .select(
              "id,account_id,description,amount,date,required,paid,auto_debit,auto_debit_day,installments_count,is_parent,recurrence_group_id",
            )
            .order("date", { ascending: true })
            .order("id", { ascending: true });
          return abortSignal ? query.abortSignal(abortSignal) : query;
        },
        1000,
        signal,
      );
      return uniqueById(
        data.map((d) => ({
          id: d.id,
          accountId: d.account_id,
          description: d.description,
          amount: num(d.amount as number | string),
          date: d.date,
          required: d.required,
          paid: d.paid,
          autoDebit: d.auto_debit,
          autoDebitDay: d.auto_debit_day,
          installmentsCount: d.installments_count,
          isParent: d.is_parent,
          recurrenceGroupId: d.recurrence_group_id ?? null,
        })),
      );
    },
  });
}

export function useIncomes() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["incomes", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Income[]> => {
      const data = await fetchAllRows<{
        id: string;
        account_id: string;
        description: string;
        amount: number | string;
        date: string;
        received: boolean;
        installments_count: number;
        is_parent: boolean;
        recurrence_group_id: string | null;
      }>(() =>
        supabase
          .from("incomes")
          .select(
            "id,account_id,description,amount,date,received,installments_count,is_parent,recurrence_group_id",
          )
          .order("date", { ascending: true }),
      );
      return data.map((d) => ({
        id: d.id,
        accountId: d.account_id,
        description: d.description,
        amount: num(d.amount as number | string),
        date: d.date,
        received: d.received,
        installmentsCount: d.installments_count,
        isParent: d.is_parent,
        recurrenceGroupId: d.recurrence_group_id ?? null,
      }));
    },
  });
}

export function useInvestments() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["investments", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Investment[]> => {
      const data = await fetchAllRows<{
        id: string;
        account_id: string;
        type: string;
        amount: number | string;
        percentage: number | string;
        date: string;
      }>(() => supabase.from("investments").select("id,account_id,type,amount,percentage,date"));
      return data.map((i) => ({
        id: i.id,
        accountId: i.account_id,
        type: i.type,
        amount: num(i.amount as number | string),
        percentage: num(i.percentage as number | string),
        date: i.date,
      }));
    },
  });
}

export function useCardPayments() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["card_payments", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const data = await fetchAllRows<{
        card_id: string;
        year: number;
        month: number;
        paid: boolean;
      }>(() => supabase.from("card_payments").select("card_id,year,month,paid"));
      const map: Record<string, boolean> = {};
      for (const r of data) {
        map[`${r.card_id}-${r.year}-${r.month}`] = r.paid;
      }
      return map;
    },
  });
}

// =======================
// Mutations — Accounts
// =======================
function useInvalidate() {
  const qc = useQueryClient();
  return (keys: string[]) =>
    keys.forEach((k) => qc.invalidateQueries({ queryKey: [k], refetchType: "active" }));
}

export function useAddAccount() {
  const { user } = useAuth();
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (a: Omit<Account, "id">) => {
      const { error } = await supabase.from("accounts").insert({
        user_id: user!.id,
        name: a.name,
        type: a.type,
        color: a.color,
        initial_balance: a.initialBalance,
      });
      if (error) throw error;
    },
    onSettled: () => inv(["accounts"]),
  });
}

export function useRemoveAccount() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      // Não há FK de cascade no schema. Precisamos remover EXPLICITAMENTE
      // todos os dependentes (cartões, compras, parcelas, débitos, recebimentos,
      // investimentos, pagamentos de fatura) antes de apagar a conta.

      // 1) Cartões da conta → compras → parcelas → card_payments
      const { data: cardRows } = await supabase
        .from("cards")
        .select("id")
        .eq("account_id", id);
      const cardIds = (cardRows ?? []).map((c) => c.id);
      if (cardIds.length > 0) {
        const { data: purs } = await supabase
          .from("purchases")
          .select("id")
          .in("card_id", cardIds);
        const purIds = (purs ?? []).map((p) => p.id);
        if (purIds.length > 0) {
          await supabase
            .from("installments")
            .delete()
            .in("parent_id", purIds)
            .eq("parent_type", "purchase");
          await supabase.from("purchases").delete().in("id", purIds);
        }
        await supabase.from("card_payments").delete().in("card_id", cardIds);
        await supabase.from("cards").delete().in("id", cardIds);
      }

      // 2) Débitos da conta + suas parcelas
      const { data: debs } = await supabase
        .from("debits")
        .select("id")
        .eq("account_id", id);
      const debIds = (debs ?? []).map((d) => d.id);
      if (debIds.length > 0) {
        await supabase
          .from("installments")
          .delete()
          .in("parent_id", debIds)
          .eq("parent_type", "debit");
        await supabase.from("debits").delete().in("id", debIds);
      }

      // 3) Recebimentos da conta + suas parcelas
      const { data: incs } = await supabase
        .from("incomes")
        .select("id")
        .eq("account_id", id);
      const incIds = (incs ?? []).map((i) => i.id);
      if (incIds.length > 0) {
        await supabase
          .from("installments")
          .delete()
          .in("parent_id", incIds)
          .eq("parent_type", "income");
        await supabase.from("incomes").delete().in("id", incIds);
      }

      // 4) Investimentos da conta
      await supabase.from("investments").delete().eq("account_id", id);

      // 5) Finalmente a conta
      const { error } = await supabase.from("accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () =>
      inv([
        "accounts",
        "cards",
        "purchases",
        "installments",
        "debits",
        "incomes",
        "investments",
        "card_payments",
      ]),
  });
}

export function useUpdateAccount() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (a: Partial<Account> & { id: string }) => {
      const patch: {
        name?: string;
        type?: string;
        color?: string;
        initial_balance?: number;
      } = {};
      if (a.name !== undefined) patch.name = a.name;
      if (a.type !== undefined) patch.type = a.type;
      if (a.color !== undefined) patch.color = a.color;
      if (a.initialBalance !== undefined) patch.initial_balance = a.initialBalance;
      const { error } = await supabase.from("accounts").update(patch).eq("id", a.id);
      if (error) throw error;
    },
    onSettled: () => inv(["accounts"]),
  });
}

// =======================
// Mutations — Cards / Purchases
// =======================
export function useAddCard() {
  const { user } = useAuth();
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (
      c: Omit<Card, "id" | "startYear" | "startMonth" | "endYear" | "endMonth" | "excludedMonths" | "position"> & {
        scope?: CardScope;
      },
    ) => {
      const win = scopeToWindow(c.scope ?? { kind: "all" });
      // Place at the end of the account's cards list
      const { data: maxRow } = await supabase
        .from("cards")
        .select("position")
        .eq("account_id", c.accountId)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextPosition = ((maxRow?.position as number | null) ?? 0) + 1;
      const { error } = await supabase.from("cards").insert({
        user_id: user!.id,
        account_id: c.accountId,
        name: c.name,
        color: c.color,
        closing_day: c.closingDay,
        due_day: c.dueDay,
        position: nextPosition,
        ...win,
      });
      if (error) throw error;
    },
    onSettled: () => inv(["cards"]),
  });
}

/**
 * Removes a card according to scope:
 * - 'all'    → permanently deletes the card and ALL its purchases/installments/payments.
 * - 'period' → keeps the card globally; restricts visibility window to OUTSIDE the period
 *              by deleting purchases/installments inside the period and shrinking the window.
 *              Simpler approach we use: clamp end_ym to (start_period - 1) when card window
 *              fully overlaps; if 'period' fully covers the card, falls back to full delete.
 *              Purchases whose due months fall in the period are removed.
 * - 'month'  → deletes purchases/installments tied to this single year/month for this card,
 *              leaving the card itself intact for other months.
 */
export function useRemoveCard() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (args: { id: string; scope?: CardScope }) => {
      const id = args.id;
      const scope: CardScope = args.scope ?? { kind: "all" };

      if (scope.kind === "all") {
        const { data: purs } = await supabase.from("purchases").select("id").eq("card_id", id);
        const ids = (purs ?? []).map((p) => p.id);
        if (ids.length > 0) {
          await supabase
            .from("installments")
            .delete()
            .in("parent_id", ids)
            .eq("parent_type", "purchase");
          await supabase.from("purchases").delete().in("id", ids);
        }
        await supabase.from("card_payments").delete().eq("card_id", id);
        const { error } = await supabase.from("cards").delete().eq("id", id);
        if (error) throw error;
        return;
      }

      // Period or single month → wipe installments/purchases inside window, restrict card visibility.
      const win = scopeToWindow(scope);
      const sYM = win.start_year! * 12 + win.start_month!;
      const eYM = win.end_year! * 12 + win.end_month!;

      // 1) Delete installments of THIS card whose (year,month) is inside the window.
      const { data: purs } = await supabase.from("purchases").select("id").eq("card_id", id);
      const purchaseIds = (purs ?? []).map((p: any) => p.id as string);
      if (purchaseIds.length > 0) {
        const { data: insts } = await supabase
          .from("installments")
          .select("id,parent_id,year,month")
          .in("parent_id", purchaseIds)
          .eq("parent_type", "purchase");
        const toDelete = (insts ?? []).filter((i: any) => {
          const ym = (i.year as number) * 12 + (i.month as number);
          return ym >= sYM && ym <= eYM;
        });
        if (toDelete.length > 0) {
          await supabase
            .from("installments")
            .delete()
            .in(
              "id",
              toDelete.map((i: any) => i.id),
            );
        }
        // Clean orphan purchases (no remaining installments)
        const remaining = (insts ?? []).filter(
          (i: any) => !toDelete.find((d: any) => d.id === i.id),
        );
        const stillUsed = new Set(remaining.map((i: any) => i.parent_id));
        const orphanIds = purchaseIds.filter((pid) => !stillUsed.has(pid));
        if (orphanIds.length > 0) {
          await supabase.from("purchases").delete().in("id", orphanIds);
        }
      }

      // 2) Delete card_payments inside window (filter by year+month, not just year)
      const { data: cps } = await supabase
        .from("card_payments")
        .select("id,year,month")
        .eq("card_id", id);
      const cpToDelete = (cps ?? []).filter((c: any) => {
        const ym = (c.year as number) * 12 + (c.month as number);
        return ym >= sYM && ym <= eYM;
      });
      if (cpToDelete.length > 0) {
        await supabase
          .from("card_payments")
          .delete()
          .in("id", cpToDelete.map((c: any) => c.id));
      }

      // 3) Esconde o cartão nos meses do escopo adicionando-os a excluded_months.
      //    O cartão continua existindo (e visível fora do escopo) — o usuário
      //    pode voltar a usá-lo em outros meses normalmente.
      const { data: cardRow } = await supabase
        .from("cards")
        .select("excluded_months")
        .eq("id", id)
        .maybeSingle();
      const current: string[] = (cardRow?.excluded_months ?? []) as string[];
      const toHide: string[] = [];
      for (let ym = sYM; ym <= eYM; ym++) {
        const y = Math.floor(ym / 12);
        const m = ym % 12;
        toHide.push(`${y}-${String(m + 1).padStart(2, "0")}`);
      }
      const merged = Array.from(new Set([...current, ...toHide]));
      await supabase.from("cards").update({ excluded_months: merged }).eq("id", id);
    },
    onSuccess: () => inv(["cards", "purchases", "installments", "card_payments"]),
  });
}

export function useUpdateCard() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (c: {
      id: string;
      name?: string;
      color?: string;
      closingDay?: number;
      dueDay?: number;
      scope?: CardScope;
    }) => {
      const patch: any = {};
      if (c.name !== undefined) patch.name = c.name;
      if (c.color !== undefined) patch.color = c.color;
      if (c.closingDay !== undefined) patch.closing_day = c.closingDay;
      if (c.dueDay !== undefined) patch.due_day = c.dueDay;
      if (c.scope) {
        const win = scopeToWindow(c.scope);
        patch.start_year = win.start_year;
        patch.start_month = win.start_month;
        patch.end_year = win.end_year;
        patch.end_month = win.end_month;
      }
      const { error } = await supabase.from("cards").update(patch).eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => inv(["cards"]),
  });
}

/**
 * Reordena os cartões de uma conta. Recebe a lista de ids na ordem desejada
 * e grava `position` sequencialmente (1, 2, 3, ...). Vale para a conta inteira
 * em todos os meses.
 */
export function useReorderCards() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (args: { accountId: string; orderedIds: string[] }) => {
      await Promise.all(
        args.orderedIds.map((id, idx) =>
          supabase.from("cards").update({ position: idx + 1 }).eq("id", id),
        ),
      );
    },
    onSuccess: () => inv(["cards"]),
  });
}



export function useDuplicateCard() {
  const { user } = useAuth();
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      // 1) Fetch source card
      const { data: src, error: e1 } = await supabase
        .from("cards")
        .select("name,color,closing_day,due_day,account_id")
        .eq("id", id)
        .single();
      if (e1 || !src) throw new Error(e1?.message ?? "Cartão não encontrado");

      // 2) Create clone
      const { data: created, error: e2 } = await supabase
        .from("cards")
        .insert({
          user_id: user!.id,
          account_id: src.account_id,
          name: `${src.name} (cópia)`,
          color: src.color,
          closing_day: src.closing_day,
          due_day: src.due_day,
        })
        .select("id")
        .single();
      if (e2 || !created) throw new Error(e2?.message ?? "Falha ao duplicar cartão");
      const newCardId = (created as { id: string }).id;

      // 3) Fetch all purchases of source card + their installments
      const { data: purs } = await supabase
        .from("purchases")
        .select("id,description,total_amount,purchase_date,installments_count")
        .eq("card_id", id);
      if (!purs || purs.length === 0) return;

      // Map old purchase id -> new purchase id
      const idMap = new Map<string, string>();
      for (const p of purs) {
        const { data: np, error: ep } = await supabase
          .from("purchases")
          .insert({
            user_id: user!.id,
            card_id: newCardId,
            description: p.description,
            total_amount: p.total_amount,
            purchase_date: p.purchase_date,
            installments_count: p.installments_count,
          })
          .select("id")
          .single();
        if (ep || !np) throw new Error(ep?.message ?? "Falha ao copiar compra");
        idMap.set(p.id as string, (np as { id: string }).id);
      }

      const oldIds = Array.from(idMap.keys());
      const { data: insts } = await supabase
        .from("installments")
        .select("parent_id,purchase_id,number,total,amount,due_date,year,month,paid,parent_type")
        .in("parent_id", oldIds)
        .eq("parent_type", "purchase");
      if (insts && insts.length > 0) {
        const rows = insts.map((i) => ({
          user_id: user!.id,
          parent_type: "purchase",
          parent_id: idMap.get(i.parent_id as string)!,
          purchase_id: idMap.get((i.purchase_id as string) ?? (i.parent_id as string)) ?? null,
          number: i.number,
          total: i.total,
          amount: i.amount,
          due_date: i.due_date,
          year: i.year,
          month: i.month,
          paid: i.paid,
        }));
        const { error: e3 } = await supabase.from("installments").insert(rows);
        if (e3) throw e3;
      }
    },
    onSuccess: () => inv(["cards", "purchases", "installments", "card_payments"]),
  });
}

export function useAddPurchase() {
  const { user } = useAuth();
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (p: Omit<Purchase, "id"> & { installmentNumber?: number; invoiceAnchorDate?: string }) => {
      const purchaseId = crypto.randomUUID();
      const { error } = await supabase
        .from("purchases")
        .insert({
          id: purchaseId,
          user_id: user!.id,
          card_id: p.cardId,
          description: p.description,
          total_amount: p.totalAmount,
          purchase_date: p.date,
          installments_count: p.installmentsCount,
        });
      if (error) throw error;
      const anchor = Math.max(1, Math.min(p.installmentsCount, p.installmentNumber ?? 1));
      const inst = buildInstallmentsAnchored(
        purchaseId,
        user!.id,
        p.totalAmount,
        p.installmentsCount,
        anchor,
        p.invoiceAnchorDate ?? p.date,
        "purchase",
        true,
      );
      const { error: e2 } = await supabase.from("installments").insert(inst);
      if (e2) throw e2;
      return { purchaseId, payload: p, installmentRows: inst };
    },
    onSuccess: (result, p) => {
      inv(["purchases", "installments", "card_payments"]);
      const { purchaseId, installmentRows } = result;
      const userId = user!.id;
      history.push({
        label: `Adicionar compra "${p.description}"`,
        undo: async () => {
          await supabase.from("installments").delete().eq("parent_id", purchaseId).eq("parent_type", "purchase");
          await supabase.from("purchases").delete().eq("id", purchaseId);
          inv(["purchases", "installments", "card_payments"]);
        },
        redo: async () => {
          await supabase.from("purchases").insert({
            id: purchaseId,
            user_id: userId,
            card_id: p.cardId,
            description: p.description,
            total_amount: p.totalAmount,
            purchase_date: p.date,
            installments_count: p.installmentsCount,
          });
          await supabase.from("installments").insert(installmentRows);
          inv(["purchases", "installments", "card_payments"]);
        },
      });
    },
  });
}

export function useRemovePurchase() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: purchaseRow } = await supabase.from("purchases").select("*").eq("id", id).maybeSingle();
      const { data: instRows } = await supabase
        .from("installments")
        .select("*")
        .eq("parent_id", id)
        .eq("parent_type", "purchase");
      await supabase.from("installments").delete().eq("parent_id", id).eq("parent_type", "purchase");
      const { error } = await supabase.from("purchases").delete().eq("id", id);
      if (error) throw error;
      return { id, purchaseRow, instRows: instRows ?? [] };
    },
    onSuccess: ({ id, purchaseRow, instRows }) => {
      inv(["purchases", "installments", "card_payments"]);
      if (!purchaseRow) return;
      history.push({
        label: `Remover compra "${(purchaseRow as { description?: string }).description ?? ""}"`,
        undo: async () => {
          await supabase.from("purchases").insert(purchaseRow as Record<string, unknown>);
          if (instRows.length) await supabase.from("installments").insert(instRows as Record<string, unknown>[]);
          inv(["purchases", "installments", "card_payments"]);
        },
        redo: async () => {
          await supabase.from("installments").delete().eq("parent_id", id).eq("parent_type", "purchase");
          await supabase.from("purchases").delete().eq("id", id);
          inv(["purchases", "installments", "card_payments"]);
        },
      });
    },
  });
}

// =======================
// Installments
// =======================
/**
 * Parse "YYYY-MM-DD" as a *local* calendar date (no timezone shift).
 * `new Date("2025-07-07")` interprets the string as UTC midnight, so in
 * negative offsets (e.g. America/Sao_Paulo, UTC-3) `.getDate()` returns 6.
 * We must read the components from the literal string instead.
 */
function parseLocalDate(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return { y, m: (m || 1) - 1, d: d || 1 };
}
function fmtLocalDate(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function useUpdateInstallment() {
  const inv = useInvalidate();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; amount?: number; dueDate?: string; paid?: boolean }) => {
      const patch: {
        amount?: number;
        due_date?: string;
        year?: number;
        month?: number;
        paid?: boolean;
      } = {};
      if (args.amount !== undefined) patch.amount = args.amount;
      if (args.dueDate !== undefined) {
        const { y, m } = parseLocalDate(args.dueDate);
        patch.due_date = args.dueDate;
        patch.year = y;
        patch.month = m;
      }
      if (args.paid !== undefined) patch.paid = args.paid;
      const { error } = await supabase.from("installments").update(patch).eq("id", args.id);
      if (error) throw error;
    },
    onMutate: async (args) => {
      await qc.cancelQueries({ queryKey: ["installments"] });
      const prev = qc.getQueriesData<Installment[]>({ queryKey: ["installments"] });
      qc.setQueriesData<Installment[]>({ queryKey: ["installments"] }, (old) => {
        if (!old) return old;
        return old.map((it) => {
          if (it.id !== args.id) return it;
          const next = { ...it };
          if (args.amount !== undefined) next.amount = args.amount;
          if (args.paid !== undefined) next.paid = args.paid;
          if (args.dueDate !== undefined) {
            const { y, m } = parseLocalDate(args.dueDate);
            next.dueDate = args.dueDate;
            next.year = y;
            next.month = m;
          }
          return next;
        });
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      ctx?.prev?.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSuccess: (_data, args) => {
      // Se só atualizou paid, não refaz fetch de installments para evitar
      // conflito de estado otimista — apenas invalida card_payments.
      if (args.paid !== undefined && args.amount === undefined && args.dueDate === undefined) {
        inv(["card_payments"]);
      } else {
        inv(["installments", "card_payments"]);
      }
    },
    onSettled: () => {},
  });
}

export function useShiftInstallmentDate() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (args: {
      installment: Installment;
      newDate: string;
      applyToFuture: boolean;
    }) => {
      const { y: ny, m: nm, d: nd } = parseLocalDate(args.newDate);
      const { error: eCur } = await supabase
        .from("installments")
        .update({ due_date: args.newDate, year: ny, month: nm })
        .eq("id", args.installment.id);
      if (eCur) throw eCur;

      if (args.applyToFuture) {
        const { data: rows, error } = await supabase
          .from("installments")
          .select("id,number")
          .eq("parent_id", args.installment.parentId)
          .eq("parent_type", args.installment.parentType)
          .gt("number", args.installment.number);
        if (error) throw error;
        for (const r of (rows ?? []) as Array<{ id: string; number: number }>) {
          const offset = r.number - args.installment.number;
          // Calendar arithmetic in local terms (avoid Date constructor for ISO).
          const targetMonthIdx = nm + offset;
          const targetY = ny + Math.floor(targetMonthIdx / 12);
          const targetM = ((targetMonthIdx % 12) + 12) % 12;
          const lastDay = new Date(targetY, targetM + 1, 0).getDate();
          const day = Math.min(nd, lastDay);
          const dueDate = fmtLocalDate(targetY, targetM, day);
          const { error: eUpd } = await supabase
            .from("installments")
            .update({ due_date: dueDate, year: targetY, month: targetM })
            .eq("id", r.id);
          if (eUpd) throw eUpd;
        }
      }
    },
    onSuccess: () => inv(["installments", "card_payments"]),
  });
}

/**
 * Antecipar parcelas: traz as N próximas parcelas (a partir da que serve de
 * âncora) para o mês/ano da âncora, marcando-as como pagas. Útil quando o
 * usuário quitou várias parcelas adiantadas dentro da mesma fatura.
 *
 * Regra:
 *   - Pega `count` parcelas com `number > installment.number` (as próximas).
 *   - Move cada uma para o mesmo mês/ano da âncora, usando o mesmo `due_date`.
 *   - Marca como `paid = true`.
 *   - Não mexe nas parcelas posteriores às antecipadas — elas continuam onde
 *     estão (apenas o "buraco" deixado fica visível e o usuário sabe que
 *     parcelas finais ainda existem).
 *
 * Retorna o número de parcelas efetivamente antecipadas.
 */
export function useAdvanceInstallments() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (args: { installment: Installment; count: number }) => {
      const anchor = args.installment;
      const count = Math.max(1, Math.floor(args.count));
      const { data: rows, error } = await supabase
        .from("installments")
        .select("id,number")
        .eq("parent_id", anchor.parentId)
        .eq("parent_type", anchor.parentType)
        .gt("number", anchor.number)
        .order("number", { ascending: true })
        .limit(count);
      if (error) throw error;
      const target = (rows ?? []) as Array<{ id: string; number: number }>;
      for (const r of target) {
        const { error: eUpd } = await supabase
          .from("installments")
          .update({
            due_date: anchor.dueDate,
            year: anchor.year,
            month: anchor.month,
            paid: true,
          })
          .eq("id", r.id);
        if (eUpd) throw eUpd;
      }
      // Marca a própria âncora como paga também (foi paga junto).
      const { error: eAnchor } = await supabase
        .from("installments")
        .update({ paid: true })
        .eq("id", anchor.id);
      if (eAnchor) throw eAnchor;
      return target.length;
    },
    onSuccess: () => inv(["installments", "card_payments"]),
  });
}

export function useToggleInstallmentPaid() {
  const upd = useUpdateInstallment();
  return (id: string, paid: boolean) => upd.mutate({ id, paid });
}

/** Apaga uma única parcela (mantém o pai e demais parcelas intactos). */
export function useDeleteSingleInstallment() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("installments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => inv(["installments", "card_payments"]),
  });
}

/**
 * Apaga o pai e todas as parcelas NÃO pagas. Parcelas já pagas (e o pai)
 * são preservadas se houver alguma paga; caso contrário apaga tudo.
 */
export function useDeleteParentKeepingPaid() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (args: { parentId: string; parentType: "purchase" | "debit" | "income" }) => {
      const { data: paidRows } = await supabase
        .from("installments")
        .select("id")
        .eq("parent_id", args.parentId)
        .eq("parent_type", args.parentType)
        .eq("paid", true);
      const hasPaid = (paidRows ?? []).length > 0;

      // Apaga todas as parcelas não pagas
      await supabase
        .from("installments")
        .delete()
        .eq("parent_id", args.parentId)
        .eq("parent_type", args.parentType)
        .eq("paid", false);

      if (!hasPaid) {
        // Sem parcelas pagas → remove o pai também
        const table =
          args.parentType === "purchase"
            ? "purchases"
            : args.parentType === "debit"
              ? "debits"
              : "incomes";
        const { error } = await supabase.from(table).delete().eq("id", args.parentId);
        if (error) throw error;
      }
    },
    onSuccess: () => inv(["installments", "purchases", "debits", "incomes", "card_payments"]),
  });
}

/**
 * Apaga um pai parcelado (purchase/debit/income) respeitando um CardScope:
 * - all    → apaga TODAS as parcelas + o pai
 * - month  → apaga apenas as parcelas daquele (ano, mês); se sobrar 0, apaga o pai
 * - period → apaga as parcelas dentro do intervalo; se sobrar 0, apaga o pai
 */
export function useDeleteParcelledByScope() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (args: {
      parentId: string;
      parentType: "purchase" | "debit" | "income";
      scope: CardScope;
    }) => {
      const table =
        args.parentType === "purchase"
          ? "purchases"
          : args.parentType === "debit"
            ? "debits"
            : "incomes";

      if (args.scope.kind === "all") {
        await supabase
          .from("installments")
          .delete()
          .eq("parent_id", args.parentId)
          .eq("parent_type", args.parentType);
        const { error } = await supabase.from(table).delete().eq("id", args.parentId);
        if (error) throw error;
        return;
      }

      const win =
        args.scope.kind === "month"
          ? { sy: args.scope.year, sm: args.scope.month, ey: args.scope.year, em: args.scope.month }
          : {
              sy: args.scope.startYear,
              sm: args.scope.startMonth,
              ey: args.scope.endYear,
              em: args.scope.endMonth,
            };
      const sYM = win.sy * 12 + win.sm;
      const eYM = win.ey * 12 + win.em;

      const { data: insts } = await supabase
        .from("installments")
        .select("id,year,month")
        .eq("parent_id", args.parentId)
        .eq("parent_type", args.parentType);
      const rows = (insts ?? []) as { id: string; year: number; month: number }[];
      const toDel = rows.filter((i) => {
        const ym = i.year * 12 + i.month;
        return ym >= sYM && ym <= eYM;
      });
      if (toDel.length > 0) {
        const ids = toDel.map((i) => i.id);
        for (let i = 0; i < ids.length; i += 200) {
          await supabase
            .from("installments")
            .delete()
            .in("id", ids.slice(i, i + 200));
        }
      }
      const remaining = rows.length - toDel.length;
      if (remaining === 0) {
        await supabase.from(table).delete().eq("id", args.parentId);
      }
    },
    onSuccess: () =>
      inv(["installments", "purchases", "debits", "incomes", "card_payments"]),
  });
}

/**
 * Apaga linhas de uma série recorrente (debits/incomes) por CardScope:
 * - all    → apaga toda a série (todos os meses)
 * - month  → apaga apenas a linha daquele mês para a série
 * - period → apaga linhas no intervalo
 */
export function useDeleteRecurringByScope() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (args: {
      kind: "debit" | "income";
      groupId: string;
      scope: CardScope;
    }) => {
      const table = args.kind === "debit" ? "debits" : "incomes";
      if (args.scope.kind === "all") {
        const { error } = await supabase
          .from(table)
          .delete()
          .eq("recurrence_group_id", args.groupId);
        if (error) throw error;
        return;
      }
      const sY =
        args.scope.kind === "month" ? args.scope.year : args.scope.startYear;
      const sM =
        args.scope.kind === "month" ? args.scope.month : args.scope.startMonth;
      const eY =
        args.scope.kind === "month" ? args.scope.year : args.scope.endYear;
      const eM =
        args.scope.kind === "month" ? args.scope.month : args.scope.endMonth;
      const start = `${sY}-${String(sM + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(eY, eM + 1, 0).getDate();
      const end = `${eY}-${String(eM + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      const { error } = await supabase
        .from(table)
        .delete()
        .eq("recurrence_group_id", args.groupId)
        .gte("date", start)
        .lte("date", end);
      if (error) throw error;
    },
    onSuccess: () => inv(["debits", "incomes"]),
  });
}

export function useSetCardPaid() {
  const { user } = useAuth();
  const inv = useInvalidate();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { cardId: string; year: number; month: number; paid: boolean }) => {
      const pursRaw = await fetchAllRows<{ id: string }>(() =>
        supabase.from("purchases").select("id").eq("card_id", args.cardId),
      );
      const purIds = pursRaw.map((p) => p.id);
      if (purIds.length > 0) {
        const purIdSet = new Set(purIds);
        const monthRows = await fetchAllRows<{
          id: string;
          parent_id: string | null;
          purchase_id: string | null;
        }>(() =>
          supabase
            .from("installments")
            .select("id,parent_id,purchase_id")
            .eq("parent_type", "purchase")
            .eq("year", args.year)
            .eq("month", args.month),
        );
        const targetIds = monthRows
          .filter((i) => purIdSet.has(i.parent_id ?? "") || purIdSet.has(i.purchase_id ?? ""))
          .map((i) => i.id);
        for (let i = 0; i < targetIds.length; i += 200) {
          const chunk = targetIds.slice(i, i + 200);
          const { error: e2 } = await supabase
            .from("installments")
            .update({ paid: args.paid })
            .in("id", chunk);
          if (e2) throw e2;
        }
      }
      const { error: e3 } = await supabase.from("card_payments").upsert(
        {
          user_id: user!.id,
          card_id: args.cardId,
          year: args.year,
          month: args.month,
          paid: args.paid,
        },
        { onConflict: "card_id,year,month" },
      );
      if (e3) throw e3;
    },
    onMutate: async (args) => {
      await qc.cancelQueries({ queryKey: ["card_payments"] });
      await qc.cancelQueries({ queryKey: ["installments"] });
      await qc.cancelQueries({ queryKey: ["purchases"] });
      const prevCp = qc.getQueriesData<Record<string, boolean>>({ queryKey: ["card_payments"] });
      const prevInst = qc.getQueriesData<Installment[]>({ queryKey: ["installments"] });
      const cachedPurchases = qc.getQueriesData<Purchase[]>({ queryKey: ["purchases"] });
      const prevPurchases = cachedPurchases.flatMap(([, data]) => data ?? []);
      const purIds = new Set(
        prevPurchases.filter((p) => p.cardId === args.cardId).map((p) => p.id),
      );
      qc.setQueriesData<Record<string, boolean>>({ queryKey: ["card_payments"] }, (old) => {
        if (!old) return old;
        return { ...old, [`${args.cardId}-${args.year}-${args.month}`]: args.paid };
      });
      qc.setQueriesData<Installment[]>({ queryKey: ["installments"] }, (old) => {
        if (!old) return old;
        return old.map((i) =>
          i.parentType === "purchase" &&
          i.year === args.year &&
          i.month === args.month &&
          (purIds.has(i.parentId) || (i.purchaseId ? purIds.has(i.purchaseId) : false))
            ? { ...i, paid: args.paid }
            : i,
        );
      });
      return { prevCp, prevInst };
    },
    onError: (_e, _v, ctx) => {
      ctx?.prevCp?.forEach(([k, d]) => qc.setQueryData(k, d));
      ctx?.prevInst?.forEach(([k, d]) => qc.setQueryData(k, d));
    },
    onSuccess: () => inv(["installments", "card_payments"]),
  });
}

// =======================
// Debits
// =======================
export function useAddDebit() {
  const { user } = useAuth();
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (d: {
      accountId: string;
      description: string;
      amount: number;
      date: string;
      required: boolean;
      autoDebit?: boolean;
      autoDebitDay?: number | null;
      installmentsCount?: number;
      installmentNumber?: number;
    }) => {
      const count = Math.max(1, d.installmentsCount ?? 1);
      const anchor = Math.max(1, Math.min(count, d.installmentNumber ?? 1));
      const isRecurring = d.required && count === 1;
      const groupId = isRecurring ? crypto.randomUUID() : null;
      const { data: ins, error } = await supabase
        .from("debits")
        .insert({
          user_id: user!.id,
          account_id: d.accountId,
          description: d.description,
          amount: d.amount,
          date: d.date,
          required: d.required,
          paid: false,
          auto_debit: d.autoDebit ?? false,
          auto_debit_day: d.autoDebitDay ?? null,
          installments_count: count,
          is_parent: count > 1,
          recurrence_group_id: groupId,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (count > 1) {
        const inst =
          anchor > 1
            ? buildInstallmentsAnchored(
                (ins as { id: string }).id,
                user!.id,
                d.amount,
                count,
                anchor,
                d.date,
                "debit",
                true,
              )
            : buildInstallments(
                (ins as { id: string }).id,
                "debit",
                user!.id,
                d.amount,
                count,
                d.date,
              );
        const { error: e2 } = await supabase.from("installments").insert(inst);
        if (e2) throw e2;
      } else if (isRecurring) {
        // Replicar como série recorrente: 24 meses à frente, cada mês é um
        // registro independente compartilhando recurrence_group_id. Sem
        // installments — recorrência NÃO é parcelamento.
        const RECUR_MONTHS = 24;
        // Parse local — evita shift de fuso ao replicar a série.
        const [_sy, _sm, _sd] = d.date.slice(0, 10).split("-").map(Number);
        const start = new Date(_sy, (_sm || 1) - 1, _sd || 1);
        const day = start.getDate();
        const rows = [];
        for (let i = 1; i <= RECUR_MONTHS; i++) {
          const target = new Date(start.getFullYear(), start.getMonth() + i, 1);
          const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
          const dd = Math.min(day, lastDay);
          const dateStr = fmtLocalDate(target.getFullYear(), target.getMonth(), dd);
          rows.push({
            user_id: user!.id,
            account_id: d.accountId,
            description: d.description,
            amount: d.amount,
            date: dateStr,
            required: true,
            paid: false,
            auto_debit: d.autoDebit ?? false,
            auto_debit_day: d.autoDebitDay ?? null,
            installments_count: 1,
            is_parent: false,
            recurrence_group_id: groupId,
          });
        }
        if (rows.length) {
          const { error: e3 } = await supabase.from("debits").insert(rows);
          if (e3) throw e3;
        }
      }
    },
    onSettled: () => inv(["debits", "installments"]),
  });
}

export function useToggleDebitPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; paid: boolean }) => {
      const { error } = await supabase.from("debits").update({ paid: args.paid }).eq("id", args.id);
      if (error) throw error;
    },
    onMutate: async (args) => {
      await qc.cancelQueries({ queryKey: ["debits"] });
      const prev = qc.getQueriesData<Debit[]>({ queryKey: ["debits"] });
      qc.setQueriesData<Debit[]>({ queryKey: ["debits"] }, (old) =>
        old ? uniqueById(old).map((d) => (d.id === args.id ? { ...d, paid: args.paid } : d)) : old,
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      ctx?.prev?.forEach(([k, d]) => qc.setQueryData(k, d));
    },
    onSuccess: (_data, args) => {
      // Keep the committed state in cache and avoid an immediate refetch.
      // Realtime/background invalidations can arrive right after the update;
      // the local patch prevents the just-toggled row from flashing/duplicating.
      qc.setQueriesData<Debit[]>({ queryKey: ["debits"] }, (old) =>
        old ? uniqueById(old).map((d) => (d.id === args.id ? { ...d, paid: args.paid } : d)) : old,
      );
    },
  });
}

export function useRemoveDebit() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("installments").delete().eq("parent_id", id).eq("parent_type", "debit");
      const { error } = await supabase.from("debits").delete().eq("id", id);
      if (error) throw error;
    },
    onSettled: () => inv(["debits", "installments"]),
  });
}

// =======================
// Incomes
// =======================
export function useAddIncome() {
  const { user } = useAuth();
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (i: {
      accountId: string;
      description: string;
      amount: number;
      date: string;
      installmentsCount?: number;
      installmentNumber?: number;
      recurring?: boolean;
    }) => {
      const count = Math.max(1, i.installmentsCount ?? 1);
      const anchor = Math.max(1, Math.min(count, i.installmentNumber ?? 1));
      const isRecurring = !!i.recurring && count === 1;
      const groupId = isRecurring ? crypto.randomUUID() : null;
      const { data: ins, error } = await supabase
        .from("incomes")
        .insert({
          user_id: user!.id,
          account_id: i.accountId,
          description: i.description,
          amount: i.amount,
          date: i.date,
          received: false,
          installments_count: count,
          is_parent: count > 1,
          recurrence_group_id: groupId,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (count > 1) {
        const inst =
          anchor > 1
            ? buildInstallmentsAnchored(
                (ins as { id: string }).id,
                user!.id,
                i.amount,
                count,
                anchor,
                i.date,
                "income",
                true,
              )
            : buildInstallments(
                (ins as { id: string }).id,
                "income",
                user!.id,
                i.amount,
                count,
                i.date,
              );
        const { error: e2 } = await supabase.from("installments").insert(inst);
        if (e2) throw e2;
      } else if (isRecurring) {
        // Série recorrente: 24 meses à frente, registros independentes
        // compartilhando recurrence_group_id. Sem installments.
        const RECUR_MONTHS = 24;
        // Parse local — evita shift de fuso ao replicar a série.
        const [_sy, _sm, _sd] = i.date.slice(0, 10).split("-").map(Number);
        const start = new Date(_sy, (_sm || 1) - 1, _sd || 1);
        const day = start.getDate();
        const rows = [];
        for (let k = 1; k <= RECUR_MONTHS; k++) {
          const target = new Date(start.getFullYear(), start.getMonth() + k, 1);
          const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
          const dd = Math.min(day, lastDay);
          rows.push({
            user_id: user!.id,
            account_id: i.accountId,
            description: i.description,
            amount: i.amount,
            date: fmtLocalDate(target.getFullYear(), target.getMonth(), dd),
            received: false,
            installments_count: 1,
            is_parent: false,
            recurrence_group_id: groupId,
          });
        }
        if (rows.length) {
          const { error: e3 } = await supabase.from("incomes").insert(rows);
          if (e3) throw e3;
        }
      }
    },
    onSettled: () => inv(["incomes", "installments"]),
  });
}

export function useToggleIncomeReceived() {
  const inv = useInvalidate();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; received: boolean }) => {
      const { error } = await supabase
        .from("incomes")
        .update({ received: args.received })
        .eq("id", args.id);
      if (error) throw error;
    },
    onMutate: async (args) => {
      await qc.cancelQueries({ queryKey: ["incomes"] });
      const prev = qc.getQueriesData<Income[]>({ queryKey: ["incomes"] });
      qc.setQueriesData<Income[]>({ queryKey: ["incomes"] }, (old) =>
        old ? old.map((i) => (i.id === args.id ? { ...i, received: args.received } : i)) : old,
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      ctx?.prev?.forEach(([k, d]) => qc.setQueryData(k, d));
    },
    onSettled: () => inv(["incomes"]),
  });
}

export function useRemoveIncome() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("installments").delete().eq("parent_id", id).eq("parent_type", "income");
      const { error } = await supabase.from("incomes").delete().eq("id", id);
      if (error) throw error;
    },
    onSettled: () => inv(["incomes", "installments"]),
  });
}

// =======================
// Investments
// =======================
export function useAddInvestment() {
  const { user } = useAuth();
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (i: Omit<Investment, "id">) => {
      const { error } = await supabase.from("investments").insert({
        user_id: user!.id,
        account_id: i.accountId,
        type: i.type,
        amount: i.amount,
        percentage: i.percentage,
        date: i.date,
      });
      if (error) throw error;
    },
    onSettled: () => inv(["investments"]),
  });
}

export function useRemoveInvestment() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("investments").delete().eq("id", id);
      if (error) throw error;
    },
    onSettled: () => inv(["investments"]),
  });
}

// =======================
// Duplicate any item over a scope (month / period / all)
// =======================
export type DuplicateSource =
  | { kind: "debit"; accountId: string; description: string; amount: number; date: string; required: boolean }
  | { kind: "income"; accountId: string; description: string; amount: number; date: string }
  | { kind: "investment"; accountId: string; type: string; amount: number; percentage: number; date: string }
  | { kind: "purchase"; cardId: string; description: string; totalAmount: number; date: string };

/** Resolve a CardScope into a list of {year, month} targets. */
function resolveScopeMonths(scope: CardScope, anchorYear: number, anchorMonth: number): Array<{ year: number; month: number }> {
  if (scope.kind === "month") return [{ year: scope.year, month: scope.month }];
  if (scope.kind === "period") {
    const out: Array<{ year: number; month: number }> = [];
    let y = scope.startYear, m = scope.startMonth;
    const endIdx = scope.endYear * 12 + scope.endMonth;
    while (y * 12 + m <= endIdx) {
      out.push({ year: y, month: m });
      m += 1;
      if (m > 11) { m = 0; y += 1; }
    }
    return out;
  }
  // 'all' → 24 meses a partir do mês âncora (inclusive)
  const out: Array<{ year: number; month: number }> = [];
  let y = anchorYear, m = anchorMonth;
  for (let i = 0; i < 24; i++) {
    out.push({ year: y, month: m });
    m += 1; if (m > 11) { m = 0; y += 1; }
  }
  return out;
}

export function useDuplicateOverScope() {
  const { user } = useAuth();
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (args: { source: DuplicateSource; scope: CardScope; anchorYear: number; anchorMonth: number }) => {
      const targets = resolveScopeMonths(args.scope, args.anchorYear, args.anchorMonth);
      if (targets.length === 0) return;
      const [, , _d] = args.source.date.slice(0, 10).split("-").map(Number);
      const srcDay = _d || 1;
      const dateFor = (y: number, m: number) => {
        const lastDay = new Date(y, m + 1, 0).getDate();
        return fmtLocalDate(y, m, Math.min(srcDay, lastDay));
      };
      const src = args.source;
      if (src.kind === "debit") {
        const rows = targets.map((t) => ({
          user_id: user!.id,
          account_id: src.accountId,
          description: src.description,
          amount: src.amount,
          date: dateFor(t.year, t.month),
          required: src.required,
          paid: false,
          installments_count: 1,
          is_parent: false,
        }));
        const { error } = await supabase.from("debits").insert(rows);
        if (error) throw error;
        inv(["debits"]);
      } else if (src.kind === "income") {
        const rows = targets.map((t) => ({
          user_id: user!.id,
          account_id: src.accountId,
          description: src.description,
          amount: src.amount,
          date: dateFor(t.year, t.month),
          received: false,
          installments_count: 1,
          is_parent: false,
        }));
        const { error } = await supabase.from("incomes").insert(rows);
        if (error) throw error;
        inv(["incomes"]);
      } else if (src.kind === "investment") {
        const rows = targets.map((t) => ({
          user_id: user!.id,
          account_id: src.accountId,
          type: src.type,
          amount: src.amount,
          percentage: src.percentage,
          date: dateFor(t.year, t.month),
        }));
        const { error } = await supabase.from("investments").insert(rows);
        if (error) throw error;
        inv(["investments"]);
      } else {
        // purchase → uma compra independente (1 parcela) por mês
        for (const t of targets) {
          const newDate = dateFor(t.year, t.month);
          const { data: p, error: e1 } = await supabase
            .from("purchases")
            .insert({
              user_id: user!.id,
              card_id: src.cardId,
              description: src.description,
              total_amount: src.totalAmount,
              purchase_date: newDate,
              installments_count: 1,
            })
            .select("id")
            .single();
          if (e1 || !p) throw e1 ?? new Error("Falha ao duplicar compra");
          const pid = (p as { id: string }).id;
          const { error: e2 } = await supabase.from("installments").insert({
            user_id: user!.id,
            parent_type: "purchase",
            parent_id: pid,
            purchase_id: pid,
            number: 1,
            total: 1,
            amount: src.totalAmount,
            due_date: newDate,
            year: t.year,
            month: t.month,
            paid: false,
          });
          if (e2) throw e2;
        }
        inv(["purchases", "installments"]);
      }
    },
  });
}

// =======================
// Delete any item over a scope (month / period / all)
// Finds matching single-payment rows in each target month and removes them.
// For recurring series, matches by recurrence_group_id within the target months.
// =======================
export type DeleteSource =
  | { kind: "debit"; accountId: string; description: string; amount: number; groupId?: string | null }
  | { kind: "income"; accountId: string; description: string; amount: number; groupId?: string | null }
  | { kind: "investment"; accountId: string; type: string; amount: number };

export function useDeleteOverScope() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (args: { source: DeleteSource; scope: CardScope; anchorYear: number; anchorMonth: number }) => {
      const targets = resolveScopeMonths(args.scope, args.anchorYear, args.anchorMonth);
      if (targets.length === 0) return;
      const src = args.source;
      for (const t of targets) {
        const start = fmtLocalDate(t.year, t.month, 1);
        const lastDay = new Date(t.year, t.month + 1, 0).getDate();
        const end = fmtLocalDate(t.year, t.month, lastDay);
        if (src.kind === "debit") {
          let q = supabase
            .from("debits")
            .select("id")
            .eq("account_id", src.accountId)
            .gte("date", start)
            .lte("date", end)
            .eq("installments_count", 1)
            .eq("is_parent", false);
          if (src.groupId) {
            q = q.eq("recurrence_group_id", src.groupId);
          } else {
            q = q.eq("description", src.description).eq("amount", src.amount);
          }
          const { data, error } = await q;
          if (error) throw error;
          const ids = (data ?? []).map((r: { id: string }) => r.id);
          if (ids.length) {
            await supabase.from("installments").delete().in("parent_id", ids).eq("parent_type", "debit");
            const { error: e2 } = await supabase.from("debits").delete().in("id", ids);
            if (e2) throw e2;
          }
        } else if (src.kind === "income") {
          let q = supabase
            .from("incomes")
            .select("id")
            .eq("account_id", src.accountId)
            .gte("date", start)
            .lte("date", end)
            .eq("installments_count", 1)
            .eq("is_parent", false);
          if (src.groupId) {
            q = q.eq("recurrence_group_id", src.groupId);
          } else {
            q = q.eq("description", src.description).eq("amount", src.amount);
          }
          const { data, error } = await q;
          if (error) throw error;
          const ids = (data ?? []).map((r: { id: string }) => r.id);
          if (ids.length) {
            await supabase.from("installments").delete().in("parent_id", ids).eq("parent_type", "income");
            const { error: e2 } = await supabase.from("incomes").delete().in("id", ids);
            if (e2) throw e2;
          }
        } else {
          const { data, error } = await supabase
            .from("investments")
            .select("id")
            .eq("account_id", src.accountId)
            .eq("type", src.type)
            .eq("amount", src.amount)
            .gte("date", start)
            .lte("date", end);
          if (error) throw error;
          const ids = (data ?? []).map((r: { id: string }) => r.id);
          if (ids.length) {
            const { error: e2 } = await supabase.from("investments").delete().in("id", ids);
            if (e2) throw e2;
          }
        }
      }
      inv(["debits", "incomes", "investments", "installments"]);
    },
  });
}





// =======================
// Importer (cards live inside an account, so card already carries account)
// =======================
export type ImportedRow = {
  description: string;
  purchaseDate: string;
  totalAmount: number;
  installmentsCount: number;
  cardId: string;
  installmentNumber?: number;
  installmentAmount?: number;
  installmentDueDate?: string;
  paid?: boolean;
};

export function useImportPurchases() {
  const { user } = useAuth();
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (rows: ImportedRow[]) => {
      // Cache de cartões para evitar fetch repetido
      const cardCache = new Map<string, { closing_day: number; due_day: number }>();
      const getCard = async (cardId: string) => {
        if (cardCache.has(cardId)) return cardCache.get(cardId)!;
        const { data } = await supabase
          .from("cards")
          .select("closing_day,due_day")
          .eq("id", cardId)
          .single();
        const c = {
          closing_day: (data as { closing_day?: number } | null)?.closing_day ?? 25,
          due_day: (data as { due_day?: number } | null)?.due_day ?? 5,
        };
        cardCache.set(cardId, c);
        return c;
      };

      // Cada linha = 1 compra completa (modo linha-âncora)
      for (const r of rows) {
        const { data: pIns, error: e1 } = await supabase
          .from("purchases")
          .insert({
            user_id: user!.id,
            card_id: r.cardId,
            description: r.description,
            total_amount: r.totalAmount,
            purchase_date: r.purchaseDate,
            installments_count: r.installmentsCount,
          })
          .select("id")
          .single();
        if (e1) throw e1;
        const purchaseId = (pIns as { id: string }).id;

        if (r.installmentNumber && r.installmentsCount > 1) {
          // Modo âncora: usa data_vencimento (preferida) ou data_compra
          const anchorDate = r.installmentDueDate ?? r.purchaseDate;
          const inst = buildInstallmentsAnchored(
            purchaseId,
            user!.id,
            r.totalAmount,
            r.installmentsCount,
            r.installmentNumber,
            anchorDate,
          );
          // Se o status do CSV indica "pago", aplica à parcela âncora
          if (r.paid) {
            const a = inst.find((x) => x.number === r.installmentNumber);
            if (a) a.paid = true;
          }
          const { error: e2 } = await supabase.from("installments").insert(inst);
          if (e2) throw e2;
        } else {
          // Sem numero_parcela ou compra à vista: usa cálculo clássico do cartão
          const { closing_day, due_day } = await getCard(r.cardId);
          const inst = buildInstallmentsForPurchase(
            purchaseId,
            user!.id,
            r.totalAmount,
            r.installmentsCount,
            r.purchaseDate,
            closing_day,
            due_day,
          );
          if (r.paid) inst.forEach((i) => (i.paid = true));
          const { error: e2 } = await supabase.from("installments").insert(inst);
          if (e2) throw e2;
        }
      }
    },
    onSuccess: () => inv(["purchases", "installments", "card_payments"]),
  });
}

// =======================
// Purge — apaga TODAS as movimentações (mantém contas e cartões)
// =======================
export function usePurgeAllMovements() {
  const { user } = useAuth();
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado.");
      // Ordem importa: filhos antes de pais
      await supabase.from("installments").delete().eq("user_id", user.id);
      await supabase.from("card_payments").delete().eq("user_id", user.id);
      await supabase.from("purchases").delete().eq("user_id", user.id);
      await supabase.from("debits").delete().eq("user_id", user.id);
      await supabase.from("incomes").delete().eq("user_id", user.id);
      await supabase.from("investments").delete().eq("user_id", user.id);
      // Zera saldo inicial das contas — evita que apareça saldo residual
      // depois que todas as movimentações são apagadas.
      await supabase
        .from("accounts")
        .update({ initial_balance: 0 })
        .eq("user_id", user.id);
    },
    onSuccess: () =>
      inv([
        "accounts",
        "purchases",
        "installments",
        "debits",
        "incomes",
        "investments",
        "card_payments",
      ]),
  });
}

// =======================
// Importação histórica do XLSX (parser em src/lib/xlsxParser.ts)
// =======================
export type HistoricalImportPlan = {
  // Contas a criar (nome → tipo)
  accountsToCreate: Array<{ name: string; type: AccountType; color: string }>;
  // Cartões a criar (nome → conta)
  cardsToCreate: Array<{ name: string; accountName: string; color: string }>;
  // Entries já mapeadas (descritas em coordenadas de domínio)
  entries: HistoricalImportEntry[];
};

export type HistoricalImportEntry = {
  kind: "purchase" | "debit" | "income" | "investment";
  description: string;
  amount: number;
  /**
   * Data de competência da linha na planilha (YYYY-MM-DD).
   * Para parceladas: representa o mês/ano em que ESTA parcela específica
   * cai (derivado da coluna do mês onde a linha apareceu).
   */
  date: string;
  /**
   * Data ORIGINAL da compra (célula DATA da planilha), quando disponível.
   * Para parceladas, todas as linhas da mesma compra trazem a mesma
   * purchaseDate — usada como purchase_date no banco.
   */
  purchaseDate?: string;
  paid: boolean;
  // Para purchase
  cardName?: string;
  installmentNumber?: number;
  installmentTotal?: number;
  // Para debit/income
  accountName?: string;
};

export type HistoricalImportProgressStage =
  | "preparing"
  | "accounts"
  | "cards"
  | "purchases"
  | "installments"
  | "debits"
  | "incomes"
  | "investments"
  | "done";

export type HistoricalImportProgress = {
  stage: HistoricalImportProgressStage;
  label: string;
  current: number;
  total: number;
  batch?: number;
  totalBatches?: number;
  attempt?: number;
  message?: string;
};

type HistoricalImportMutationInput =
  | HistoricalImportPlan
  | {
      plan: HistoricalImportPlan;
      onProgress?: (progress: HistoricalImportProgress) => void;
    };

type NaturalIdQueues = Map<string, string[]>;

const HISTORICAL_IMPORT_BATCH = {
  purchases: 20,
  installments: 50,
  movements: 100,
  retries: 3,
} as const;

function isHistoricalImportMutationInput(
  input: HistoricalImportMutationInput,
): input is {
  plan: HistoricalImportPlan;
  onProgress?: (progress: HistoricalImportProgress) => void;
} {
  return typeof input === "object" && input !== null && "plan" in input;
}

function importKeyPart(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return round2(value).toFixed(2);
  return String(value).trim().toLowerCase().replace(/\s+/g, " ");
}

function importNaturalKey(...parts: unknown[]): string {
  return parts.map(importKeyPart).join("|");
}

function queueNaturalId(queues: NaturalIdQueues, key: string, id: string) {
  const list = queues.get(key) ?? [];
  list.push(id);
  queues.set(key, list);
}

function takeNaturalId(queues: NaturalIdQueues, key: string): string | null {
  const list = queues.get(key);
  if (!list || list.length === 0) return null;
  return list.shift() ?? null;
}

async function deterministicUuid(seed: string): Promise<string> {
  if (!crypto.subtle) return crypto.randomUUID();
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed)),
  );
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes.slice(0, 16), (b) => b.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}

export function useImportHistorical() {
  const { user } = useAuth();
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (input: HistoricalImportMutationInput) => {
      if (!user) throw new Error("Não autenticado.");

      const plan = isHistoricalImportMutationInput(input) ? input.plan : input;
      const onProgress = isHistoricalImportMutationInput(input) ? input.onProgress : undefined;
      const emit = (progress: HistoricalImportProgress) => onProgress?.(progress);
      const log = (message: string, meta?: unknown) => {
        if (meta === undefined) console.info(`[importar-historico] ${message}`);
        else console.info(`[importar-historico] ${message}`, meta);
      };

      emit({
        stage: "preparing",
        label: "Preparando importação",
        current: 0,
        total: plan.entries.length,
      });
      log(`Preparando importação histórica com ${plan.entries.length} lançamentos`);

      // 1) Criar contas que ainda não existem
      emit({
        stage: "accounts",
        label: "Conferindo contas",
        current: 0,
        total: plan.accountsToCreate.length,
      });
      const { data: existingAccs, error: accReadError } = await supabase
        .from("accounts")
        .select("id,name")
        .eq("user_id", user.id);
      if (accReadError) throw accReadError;

      const accByName = new Map<string, string>();
      for (const a of (existingAccs ?? []) as Array<{ id: string; name: string }>) {
        accByName.set(a.name.toLowerCase(), a.id);
      }
      for (let i = 0; i < plan.accountsToCreate.length; i++) {
        const a = plan.accountsToCreate[i];
        emit({
          stage: "accounts",
          label: "Conferindo contas",
          current: i + 1,
          total: plan.accountsToCreate.length,
        });
        if (accByName.has(a.name.toLowerCase())) continue;
        const { data, error } = await supabase
          .from("accounts")
          .insert({
            user_id: user.id,
            name: a.name,
            type: a.type,
            color: a.color,
            initial_balance: 0,
          })
          .select("id")
          .single();
        if (error) throw error;
        accByName.set(a.name.toLowerCase(), (data as { id: string }).id);
      }

      // 2) Criar cartões que ainda não existem
      emit({
        stage: "cards",
        label: "Conferindo cartões",
        current: 0,
        total: plan.cardsToCreate.length,
      });
      const { data: existingCards, error: cardReadError } = await supabase
        .from("cards")
        .select("id,name,account_id,closing_day,due_day")
        .eq("user_id", user.id);
      if (cardReadError) throw cardReadError;

      const cardByName = new Map<string, { id: string; closing_day: number; due_day: number }>();
      for (const c of (existingCards ?? []) as Array<{
        id: string;
        name: string;
        closing_day: number;
        due_day: number;
      }>) {
        cardByName.set(c.name.toLowerCase(), {
          id: c.id,
          closing_day: c.closing_day,
          due_day: c.due_day,
        });
      }
      for (let i = 0; i < plan.cardsToCreate.length; i++) {
        const c = plan.cardsToCreate[i];
        emit({
          stage: "cards",
          label: "Conferindo cartões",
          current: i + 1,
          total: plan.cardsToCreate.length,
        });
        if (cardByName.has(c.name.toLowerCase())) continue;
        const accId = accByName.get(c.accountName.toLowerCase());
        if (!accId) continue;
        const { data, error } = await supabase
          .from("cards")
          .insert({
            user_id: user.id,
            account_id: accId,
            name: c.name,
            color: c.color,
            closing_day: 25,
            due_day: 5,
          })
          .select("id,closing_day,due_day")
          .single();
        if (error) throw error;
        const row = data as { id: string; closing_day: number; due_day: number };
        cardByName.set(c.name.toLowerCase(), {
          id: row.id,
          closing_day: row.closing_day,
          due_day: row.due_day,
        });
      }

      // 3) Montar registros preservando a competência da planilha.
      const purchaseRows: Array<{
        id: string;
        user_id: string;
        card_id: string;
        description: string;
        total_amount: number;
        purchase_date: string;
        installments_count: number;
        _entries: HistoricalImportEntry[];
      }> = [];
      const debitRows: any[] = [];
      const incomeRows: any[] = [];
      const investmentRows: any[] = [];

      let defaultAccountId = accByName.values().next().value;
      if (!defaultAccountId) {
        const { data, error } = await supabase
          .from("accounts")
          .insert({
            user_id: user.id,
            name: "Importado",
            type: "corrente",
            color: "#8b5cf6",
            initial_balance: 0,
          })
          .select("id")
          .single();
        if (error) throw error;
        defaultAccountId = (data as { id: string }).id;
      }

      const parcelGroups = new Map<string, HistoricalImportEntry[]>();
      const singlePurchaseEntries: HistoricalImportEntry[] = [];

      for (const e of plan.entries) {
        if (e.kind !== "purchase") continue;
        const totalParcelas = Math.max(1, e.installmentTotal || 1);
        const numeroParcela = Math.max(0, e.installmentNumber || 0);
        if (totalParcelas > 1 && numeroParcela >= 1) {
          const key = [
            (e.cardName || "").toLowerCase(),
            e.description.trim().toLowerCase(),
            totalParcelas,
          ].join("|");
          const group = parcelGroups.get(key) ?? [];
          group.push(e);
          parcelGroups.set(key, group);
        } else {
          singlePurchaseEntries.push(e);
        }
      }

      for (const e of singlePurchaseEntries) {
        const card = e.cardName ? cardByName.get(e.cardName.toLowerCase()) : undefined;
        if (!card) continue;
        const seed = importNaturalKey(
          "purchase",
          user.id,
          card.id,
          e.description,
          e.date,
          1,
          e.amount,
        );
        purchaseRows.push({
          id: await deterministicUuid(seed),
          user_id: user.id,
          card_id: card.id,
          description: e.description,
          total_amount: e.amount,
          purchase_date: e.date,
          installments_count: 1,
          _entries: [e],
        });
      }

      for (const entries of parcelGroups.values()) {
        const sorted = [...entries].sort(
          (a, b) =>
            a.date.localeCompare(b.date) || (a.installmentNumber || 0) - (b.installmentNumber || 0),
        );

        const cycles: HistoricalImportEntry[][] = [];
        let current: HistoricalImportEntry[] = [];
        let seenPositive = new Set<number>();
        for (const e of sorted) {
          const n = Math.max(1, e.installmentNumber || 1);
          if (e.amount > 0 && seenPositive.has(n) && current.length > 0) {
            cycles.push(current);
            current = [];
            seenPositive = new Set<number>();
          }
          current.push(e);
          if (e.amount > 0) seenPositive.add(n);
        }
        if (current.length > 0) cycles.push(current);

        for (let cycleIndex = 0; cycleIndex < cycles.length; cycleIndex++) {
          const cycle = cycles[cycleIndex];
          const byNumber = new Map<number, HistoricalImportEntry>();
          for (const e of cycle) {
            const n = Math.max(1, e.installmentNumber || 1);
            const existing = byNumber.get(n);
            if (existing) {
              byNumber.set(n, {
                ...existing,
                amount: round2(existing.amount + e.amount),
                paid: existing.paid || e.paid,
              });
            } else {
              byNumber.set(n, e);
            }
          }
          const listed = Array.from(byNumber.values()).sort(
            (a, b) => (a.installmentNumber || 0) - (b.installmentNumber || 0),
          );
          const first = listed[0];
          const card = first.cardName ? cardByName.get(first.cardName.toLowerCase()) : undefined;
          if (!card) continue;
          const totalParcelas = Math.max(1, first.installmentTotal || 1);
          const knownTotal = round2(listed.reduce((sum, e) => sum + e.amount, 0));
          const projectedTotal = round2((knownTotal / listed.length) * totalParcelas);
          const totalAmount = listed.length >= totalParcelas ? knownTotal : projectedTotal;
          const purchaseDate =
            listed.find((e) => e.purchaseDate)?.purchaseDate ??
            listed.find((e) => e.installmentNumber === 1)?.date ??
            listed[0].date;
          const firstAnchor = listed[0];
          const seed = importNaturalKey(
            "purchase",
            user.id,
            card.id,
            first.description,
            purchaseDate,
            totalParcelas,
            totalAmount,
            firstAnchor.installmentNumber,
            firstAnchor.date,
            cycleIndex,
          );

          purchaseRows.push({
            id: await deterministicUuid(seed),
            user_id: user.id,
            card_id: card.id,
            description: first.description,
            total_amount: totalAmount,
            purchase_date: purchaseDate,
            installments_count: totalParcelas,
            _entries: listed,
          });
        }
      }

      for (const e of plan.entries) {
        if (e.kind === "purchase") continue;
        if (e.kind === "debit") {
          const accId = e.accountName
            ? accByName.get(e.accountName.toLowerCase())
            : defaultAccountId;
          if (!accId) continue;
          debitRows.push({
            user_id: user.id,
            account_id: accId,
            description: e.description,
            amount: e.amount,
            date: e.date,
            required: false,
            paid: e.paid,
            auto_debit: false,
            auto_debit_day: null,
            installments_count: 1,
            is_parent: false,
          });
        } else if (e.kind === "income") {
          const accId = e.accountName
            ? accByName.get(e.accountName.toLowerCase())
            : defaultAccountId;
          if (!accId) continue;
          incomeRows.push({
            user_id: user.id,
            account_id: accId,
            description: e.description,
            amount: e.amount,
            date: e.date,
            received: e.paid,
            installments_count: 1,
            is_parent: false,
          });
        } else if (e.kind === "investment") {
          const accId = e.accountName
            ? accByName.get(e.accountName.toLowerCase())
            : defaultAccountId;
          if (!accId) continue;
          investmentRows.push({
            user_id: user.id,
            account_id: accId,
            type: e.description,
            amount: e.amount,
            percentage: 0,
            date: e.date,
          });
        }
      }

      // 4) Reusar IDs já existentes para evitar duplicidade mesmo em dados importados antes da correção.
      emit({ stage: "preparing", label: "Verificando duplicidades", current: 0, total: 1 });
      const [
        existingPurchases,
        existingInstallments,
        existingDebits,
        existingIncomes,
        existingInvestments,
      ] = await Promise.all([
        fetchAllRows<any>(() =>
          supabase
            .from("purchases")
            .select("id,card_id,description,total_amount,purchase_date,installments_count")
            .eq("user_id", user.id),
        ),
        fetchAllRows<any>(() =>
          supabase
            .from("installments")
            .select("id,purchase_id,number,total,amount,due_date")
            .eq("user_id", user.id)
            .eq("parent_type", "purchase"),
        ),
        fetchAllRows<any>(() =>
          supabase
            .from("debits")
            .select(
              "id,account_id,description,amount,date,required,paid,auto_debit,auto_debit_day,installments_count,is_parent",
            )
            .eq("user_id", user.id),
        ),
        fetchAllRows<any>(() =>
          supabase
            .from("incomes")
            .select("id,account_id,description,amount,date,received,installments_count,is_parent")
            .eq("user_id", user.id),
        ),
        fetchAllRows<any>(() =>
          supabase
            .from("investments")
            .select("id,account_id,type,amount,percentage,date")
            .eq("user_id", user.id),
        ),
      ]);

      const purchaseIdsByNaturalKey: NaturalIdQueues = new Map();
      for (const p of existingPurchases) {
        queueNaturalId(
          purchaseIdsByNaturalKey,
          importNaturalKey(
            p.card_id,
            p.description,
            p.purchase_date,
            p.installments_count,
            p.total_amount,
          ),
          p.id,
        );
      }
      const newPurchaseOccurrences = new Map<string, number>();
      for (const p of purchaseRows) {
        const key = importNaturalKey(
          p.card_id,
          p.description,
          p.purchase_date,
          p.installments_count,
          p.total_amount,
        );
        const occurrence = newPurchaseOccurrences.get(key) ?? 0;
        newPurchaseOccurrences.set(key, occurrence + 1);
        const existingId = takeNaturalId(purchaseIdsByNaturalKey, key);
        p.id =
          existingId ??
          (await deterministicUuid(importNaturalKey("purchase", user.id, key, occurrence)));
      }

      const allInstallments: ReturnType<typeof buildInstallmentsAnchored>[number][] = [];
      for (const p of purchaseRows) {
        const total = Math.max(1, p.installments_count || 1);
        if (total === 1) {
          const e = p._entries[0];
          const [year, month, day] = e.date.split("-").map((n) => parseInt(n, 10));
          allInstallments.push({
            user_id: user.id,
            parent_id: p.id,
            parent_type: "purchase",
            purchase_id: p.id,
            number: 1,
            total: 1,
            amount: e.amount,
            due_date: `${year}-${String(month).padStart(2, "0")}-${String(day || 1).padStart(2, "0")}`,
            year,
            month: month - 1,
            paid: e.paid,
          });
          continue;
        }

        const anchor = p._entries[0];
        const anchorNumber = Math.min(Math.max(1, anchor.installmentNumber || 1), total);
        const paidByNumber = new Map<number, boolean>();
        const amountByNumber = new Map<number, number>();
        const dateByNumber = new Map<number, string>();
        for (const e of p._entries) {
          const n = Math.min(Math.max(1, e.installmentNumber || 1), total);
          paidByNumber.set(n, e.paid);
          amountByNumber.set(n, e.amount);
          dateByNumber.set(n, e.date);
        }
        const computed = buildInstallmentsAnchored(
          p.id,
          user.id,
          p.total_amount,
          total,
          anchorNumber,
          anchor.date,
        );
        for (const it of computed) {
          if (paidByNumber.has(it.number)) it.paid = paidByNumber.get(it.number)!;
          if (amountByNumber.has(it.number)) it.amount = amountByNumber.get(it.number)!;
          if (dateByNumber.has(it.number)) {
            const [year, month, day] = dateByNumber
              .get(it.number)!
              .split("-")
              .map((n) => parseInt(n, 10));
            it.due_date = `${year}-${String(month).padStart(2, "0")}-${String(day || 1).padStart(2, "0")}`;
            it.year = year;
            it.month = month - 1;
          }
          allInstallments.push(it);
        }
      }

      const installmentIdsByNaturalKey: NaturalIdQueues = new Map();
      for (const it of existingInstallments) {
        queueNaturalId(
          installmentIdsByNaturalKey,
          importNaturalKey(it.purchase_id, it.number, it.total, it.due_date, it.amount),
          it.id,
        );
      }
      const installmentsWithIds = [] as Array<
        ReturnType<typeof buildInstallmentsAnchored>[number] & { id: string }
      >;
      for (let i = 0; i < allInstallments.length; i++) {
        const it = allInstallments[i];
        const key = importNaturalKey(it.purchase_id, it.number, it.total, it.due_date, it.amount);
        const id =
          takeNaturalId(installmentIdsByNaturalKey, key) ??
          (await deterministicUuid(importNaturalKey("installment", user.id, key, i)));
        installmentsWithIds.push({ ...it, id });
      }

      const movementIds = {
        debits: new Map() as NaturalIdQueues,
        incomes: new Map() as NaturalIdQueues,
        investments: new Map() as NaturalIdQueues,
      };
      for (const row of existingDebits)
        queueNaturalId(
          movementIds.debits,
          importNaturalKey(row.account_id, row.description, row.amount, row.date, row.paid),
          row.id,
        );
      for (const row of existingIncomes)
        queueNaturalId(
          movementIds.incomes,
          importNaturalKey(row.account_id, row.description, row.amount, row.date, row.received),
          row.id,
        );
      for (const row of existingInvestments)
        queueNaturalId(
          movementIds.investments,
          importNaturalKey(row.account_id, row.type, row.amount, row.date),
          row.id,
        );

      for (let i = 0; i < debitRows.length; i++) {
        const row = debitRows[i];
        const key = importNaturalKey(
          row.account_id,
          row.description,
          row.amount,
          row.date,
          row.paid,
        );
        row.id =
          takeNaturalId(movementIds.debits, key) ??
          (await deterministicUuid(importNaturalKey("debit", user.id, key, i)));
      }
      for (let i = 0; i < incomeRows.length; i++) {
        const row = incomeRows[i];
        const key = importNaturalKey(
          row.account_id,
          row.description,
          row.amount,
          row.date,
          row.received,
        );
        row.id =
          takeNaturalId(movementIds.incomes, key) ??
          (await deterministicUuid(importNaturalKey("income", user.id, key, i)));
      }
      for (let i = 0; i < investmentRows.length; i++) {
        const row = investmentRows[i];
        const key = importNaturalKey(row.account_id, row.type, row.amount, row.date);
        row.id =
          takeNaturalId(movementIds.investments, key) ??
          (await deterministicUuid(importNaturalKey("investment", user.id, key, i)));
      }

      const saveBatch = async (
        payload: Record<string, any[]>,
        label: string,
        stage: HistoricalImportProgressStage,
        current: number,
        total: number,
        batch: number,
        totalBatches: number,
      ): Promise<any> => {
        const counts = Object.fromEntries(
          Object.entries(payload).map(([k, rows]) => [k, rows.length]),
        );
        let lastErr: any = null;
        for (let attempt = 1; attempt <= HISTORICAL_IMPORT_BATCH.retries; attempt++) {
          try {
            emit({ stage, label, current, total, batch, totalBatches, attempt });
            log(`${label}: lote ${batch}/${totalBatches}, tentativa ${attempt}`, counts);
            const { data, error } = await supabase.rpc("bulk_insert_finance", {
              _payload: payload,
            });
            if (!error) return data;
            lastErr = error;
            console.error(`[importar-historico] Erro no lote ${batch}`, error);
          } catch (e) {
            lastErr = e;
            console.error(`[importar-historico] Erro no lote ${batch}`, e);
          }
          if (attempt < HISTORICAL_IMPORT_BATCH.retries) {
            log(`Retry automático iniciado para lote ${batch}`);
            emit({
              stage,
              label,
              current,
              total,
              batch,
              totalBatches,
              attempt,
              message: `Retry automático do lote ${batch}`,
            });
            await new Promise((r) => setTimeout(r, 500 * attempt));
          }
        }
        const msg = lastErr?.message || String(lastErr) || "Erro de rede ao gravar";
        throw new Error(`[${label}] ${msg} (${JSON.stringify(counts)})`);
      };

      const runQueue = async (
        stage: HistoricalImportProgressStage,
        label: string,
        rows: any[],
        batchSize: number,
      ) => {
        const total = rows.length;
        const totalBatches = Math.max(1, Math.ceil(total / batchSize));
        const itemLabel: Record<string, string> = {
          purchases: "purchase",
          installments: "installment",
          debits: "debit",
          incomes: "income",
          investments: "investment",
        };
        if (total === 0) {
          emit({ stage, label, current: 0, total: 0, batch: 0, totalBatches: 0 });
          return;
        }
        for (let i = 0; i < rows.length; i += batchSize) {
          const batchRows = rows.slice(i, i + batchSize);
          const batch = Math.floor(i / batchSize) + 1;
          batchRows.forEach((_, idx) =>
            log(`Importando ${itemLabel[stage] ?? stage} ${i + idx + 1}/${total}`),
          );
          await saveBatch(
            { [stage]: batchRows },
            label,
            stage,
            Math.min(i + batchRows.length, total),
            total,
            batch,
            totalBatches,
          );
        }
      };

      const purchasePayload = purchaseRows.map((p) => ({
        id: p.id,
        user_id: p.user_id,
        card_id: p.card_id,
        description: p.description,
        total_amount: p.total_amount,
        purchase_date: p.purchase_date,
        installments_count: p.installments_count,
      }));

      log(
        `Fila criada: ${purchasePayload.length} purchases, ${installmentsWithIds.length} installments`,
      );
      await runQueue(
        "purchases",
        "Importando compras",
        purchasePayload,
        HISTORICAL_IMPORT_BATCH.purchases,
      );
      await runQueue(
        "installments",
        "Importando parcelas",
        installmentsWithIds,
        HISTORICAL_IMPORT_BATCH.installments,
      );
      await runQueue("debits", "Importando débitos", debitRows, HISTORICAL_IMPORT_BATCH.movements);
      await runQueue(
        "incomes",
        "Importando recebimentos",
        incomeRows,
        HISTORICAL_IMPORT_BATCH.movements,
      );
      await runQueue(
        "investments",
        "Importando investimentos",
        investmentRows,
        HISTORICAL_IMPORT_BATCH.movements,
      );

      emit({
        stage: "done",
        label: "Importação concluída",
        current: plan.entries.length,
        total: plan.entries.length,
      });
      log("Importação histórica concluída", {
        purchases: purchaseRows.length,
        installments: installmentsWithIds.length,
        debits: debitRows.length,
        incomes: incomeRows.length,
        investments: investmentRows.length,
      });

      return {
        accounts: plan.accountsToCreate.length,
        cards: plan.cardsToCreate.length,
        purchases: purchaseRows.length,
        installments: installmentsWithIds.length,
        debits: debitRows.length,
        incomes: incomeRows.length,
        investments: investmentRows.length,
      };
    },
    onSuccess: () =>
      inv([
        "accounts",
        "cards",
        "purchases",
        "installments",
        "debits",
        "incomes",
        "investments",
        "card_payments",
      ]),
  });
}

// =======================
// Selectors
// =======================
export function getMonthInstallments(installments: Installment[], year: number, month: number) {
  return installments.filter((i) => i.year === year && i.month === month);
}

export function getMonthInvestments(invs: Investment[], year: number, month: number) {
  return invs.filter((i) => {
    if (!i.date) return false;
    const [y, m] = i.date.slice(0, 10).split("-").map(Number);
    return y === year && m - 1 === month;
  });
}

export function getMonthDebits(
  debits: Debit[],
  installments: Installment[],
  year: number,
  month: number,
) {
  const single = uniqueById(debits)
    .filter((d) => !d.isParent)
    .filter((d) => {
      const [y, m] = d.date.slice(0, 10).split("-").map(Number);
      return y === year && m - 1 === month;
    });
  const parcelled = installments
    .filter((i) => i.parentType === "debit" && i.year === year && i.month === month)
    .map((i) => {
      const parent = debits.find((d) => d.id === i.parentId);
      return { installment: i, debit: parent };
    })
    .filter((x): x is { installment: Installment; debit: Debit } => !!x.debit);
  return { single, parcelled };
}

export function getMonthIncomes(
  incomes: Income[],
  installments: Installment[],
  year: number,
  month: number,
) {
  const single = incomes
    .filter((d) => !d.isParent)
    .filter((d) => {
      const [y, m] = d.date.slice(0, 10).split("-").map(Number);
      return y === year && m - 1 === month;
    });
  const parcelled = installments
    .filter((i) => i.parentType === "income" && i.year === year && i.month === month)
    .map((i) => {
      const parent = incomes.find((d) => d.id === i.parentId);
      return { installment: i, income: parent };
    })
    .filter((x): x is { installment: Installment; income: Income } => !!x.income);
  return { single, parcelled };
}

export function isCardFullyPaid(
  _installments: Installment[],
  _purchases: Purchase[],
  cardPayments: Record<string, boolean>,
  cardId: string,
  year: number,
  month: number,
) {
  // Fonte de verdade para "fatura paga" é exclusivamente o registro em card_payments.
  // Os inst.paid são checkboxes de revisão da fatura, não de pagamento.
  const key = `${cardId}-${year}-${month}`;
  return cardPayments[key] ?? false;
}

// =======================
// Account-aware filters
// =======================
/**
 * Filter helpers used across pages — when accountId is null, returns the input unchanged.
 */
export function filterCardsByAccount(cards: Card[], accountId: string | null) {
  return accountId ? cards.filter((c) => c.accountId === accountId) : cards;
}
export function filterDebitsByAccount(debits: Debit[], accountId: string | null) {
  return accountId ? debits.filter((d) => d.accountId === accountId) : debits;
}
export function filterIncomesByAccount(incomes: Income[], accountId: string | null) {
  return accountId ? incomes.filter((i) => i.accountId === accountId) : incomes;
}
export function filterInvestmentsByAccount(invs: Investment[], accountId: string | null) {
  return accountId ? invs.filter((i) => i.accountId === accountId) : invs;
}

/**
 * Compute the running balance of an account across all paid transactions.
 * Balance = initialBalance + (paid incomes/installments) - (paid debits/installments) - (paid card installments)
 */
export function computeAccountBalance(
  account: Account,
  cards: Card[],
  purchases: Purchase[],
  installments: Installment[],
  debits: Debit[],
  incomes: Income[],
): number {
  let bal = account.initialBalance;
  // Incomes received
  for (const inc of incomes.filter(
    (i) => i.accountId === account.id && !i.isParent && i.received,
  )) {
    bal += inc.amount;
  }
  // Income installments paid (paid==true used as "received" for parcelled)
  for (const i of installments.filter((x) => x.parentType === "income" && x.paid)) {
    const parent = incomes.find((p) => p.id === i.parentId);
    if (parent?.accountId === account.id) bal += i.amount;
  }
  // Debits paid
  for (const d of debits.filter((d) => d.accountId === account.id && !d.isParent && d.paid)) {
    bal -= d.amount;
  }
  for (const i of installments.filter((x) => x.parentType === "debit" && x.paid)) {
    const parent = debits.find((p) => p.id === i.parentId);
    if (parent?.accountId === account.id) bal -= i.amount;
  }
  // Card installments paid (purchases attached to cards in this account)
  const accountCardIds = new Set(cards.filter((c) => c.accountId === account.id).map((c) => c.id));
  for (const i of installments.filter((x) => x.parentType === "purchase" && x.paid)) {
    const pur = purchases.find((p) => p.id === i.parentId);
    if (pur && accountCardIds.has(pur.cardId)) bal -= i.amount;
  }
  return bal;
}

// =======================
// Monthly running balance per account
// =======================
export type MonthlyBalance = {
  year: number;
  month: number;
  recebimentos: number;
  debitos: number;
  faturas: number;
  investido: number;
  balanco: number; // recebimentos - despesas (sem investimento)
  saldoEmConta: number; // saldo acumulado real ao fim do mês
};

/**
 * Compute month-by-month running balance for an account, starting from
 * initialBalance. Includes ALL movements (regardless of paid status), since
 * the metric represents the projected end-of-month balance.
 */
export function computeMonthlyAccountBalance(
  account: Account,
  cards: Card[],
  purchases: Purchase[],
  installments: Installment[],
  debits: Debit[],
  incomes: Income[],
  investments: Investment[],
): Map<string, MonthlyBalance> {
  const accountCardIds = new Set(cards.filter((c) => c.accountId === account.id).map((c) => c.id));
  // Map purchase id → card, to allow per-month visibility filtering of invoice installments.
  const purchaseCard = new Map<string, Card>();
  for (const p of purchases) {
    if (!accountCardIds.has(p.cardId)) continue;
    const card = cards.find((c) => c.id === p.cardId);
    if (card) purchaseCard.set(p.id, card);
  }

  const buckets = new Map<string, { rec: number; deb: number; fat: number; inv: number }>();
  const ensure = (y: number, m: number) => {
    const k = `${y}-${m}`;
    let b = buckets.get(k);
    if (!b) {
      b = { rec: 0, deb: 0, fat: 0, inv: 0 };
      buckets.set(k, b);
    }
    return b;
  };

  // single incomes
  for (const inc of incomes) {
    if (inc.accountId !== account.id || inc.isParent || !inc.date) continue;
    const [y, m] = inc.date.slice(0, 10).split("-").map(Number);
    if (y && m) ensure(y, m - 1).rec += inc.amount;
  }
  // single debits
  for (const d of debits) {
    if (d.accountId !== account.id || d.isParent || !d.date) continue;
    const [y, m] = d.date.slice(0, 10).split("-").map(Number);
    if (y && m) ensure(y, m - 1).deb += d.amount;
  }
  // installments
  for (const i of installments) {
    if (i.parentType === "income") {
      const parent = incomes.find((x) => x.id === i.parentId);
      if (parent?.accountId === account.id) ensure(i.year, i.month).rec += i.amount;
    } else if (i.parentType === "debit") {
      const parent = debits.find((x) => x.id === i.parentId);
      if (parent?.accountId === account.id) ensure(i.year, i.month).deb += i.amount;
    } else if (i.parentType === "purchase") {
      if (!i.parentId) continue;
      const card = purchaseCard.get(i.parentId);
      // Only include invoice installments for months where the card is visible.
      // Mirrors the per-route filter so the running balance matches the displayed
      // "Gastos Totais" / "Saldo Final" of each month.
      if (card && isCardVisibleInMonth(card, i.year, i.month)) {
        ensure(i.year, i.month).fat += i.amount;
      }
    }
  }
  // investments
  for (const inv of investments) {
    if (inv.accountId !== account.id || !inv.date) continue;
    const [y, m] = inv.date.slice(0, 10).split("-").map(Number);
    if (y && m) ensure(y, m - 1).inv += inv.amount;
  }

  // Sort chronologically and accumulate
  const sortedKeys = Array.from(buckets.keys()).sort((a, b) => {
    const [ay, am] = a.split("-").map(Number);
    const [by, bm] = b.split("-").map(Number);
    return ay !== by ? ay - by : am - bm;
  });

  const result = new Map<string, MonthlyBalance>();
  let running = account.initialBalance;
  for (const k of sortedKeys) {
    const b = buckets.get(k)!;
    const [y, m] = k.split("-").map(Number);
    const balanco = b.rec - b.deb - b.fat;
    running = running + b.rec - b.deb - b.fat - b.inv;
    result.set(k, {
      year: y,
      month: m,
      recebimentos: b.rec,
      debitos: b.deb,
      faturas: b.fat,
      investido: b.inv,
      balanco,
      saldoEmConta: round2(running),
    });
  }
  return result;
}

// =======================
// Update mutations for single Debit / Income / Investment
// =======================
export function useUpdateDebit() {
  const inv = useInvalidate();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      description?: string;
      amount?: number;
      date?: string;
      paid?: boolean;
    }) => {
      const patch: { description?: string; amount?: number; date?: string; paid?: boolean } = {};
      if (args.description !== undefined) patch.description = args.description;
      if (args.amount !== undefined) patch.amount = args.amount;
      if (args.date !== undefined) patch.date = args.date;
      if (args.paid !== undefined) patch.paid = args.paid;
      const { error } = await supabase.from("debits").update(patch).eq("id", args.id);
      if (error) throw error;
    },
    onMutate: async (args) => {
      await qc.cancelQueries({ queryKey: ["debits"] });
      const prev = qc.getQueriesData<Debit[]>({ queryKey: ["debits"] });
      qc.setQueriesData<Debit[]>({ queryKey: ["debits"] }, (old) =>
        old
          ? old.map((d) =>
              d.id === args.id
                ? {
                    ...d,
                    description: args.description ?? d.description,
                    amount: args.amount ?? d.amount,
                    date: args.date ?? d.date,
                    paid: args.paid ?? d.paid,
                  }
                : d,
            )
          : old,
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      ctx?.prev?.forEach(([k, d]) => qc.setQueryData(k, d));
    },
    onSettled: () => inv(["debits"]),
  });
}

export function useUpdateIncome() {
  const inv = useInvalidate();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      description?: string;
      amount?: number;
      date?: string;
      received?: boolean;
    }) => {
      const patch: { description?: string; amount?: number; date?: string; received?: boolean } =
        {};
      if (args.description !== undefined) patch.description = args.description;
      if (args.amount !== undefined) patch.amount = args.amount;
      if (args.date !== undefined) patch.date = args.date;
      if (args.received !== undefined) patch.received = args.received;
      const { error } = await supabase.from("incomes").update(patch).eq("id", args.id);
      if (error) throw error;
    },
    onMutate: async (args) => {
      await qc.cancelQueries({ queryKey: ["incomes"] });
      const prev = qc.getQueriesData<Income[]>({ queryKey: ["incomes"] });
      qc.setQueriesData<Income[]>({ queryKey: ["incomes"] }, (old) =>
        old
          ? old.map((i) =>
              i.id === args.id
                ? {
                    ...i,
                    description: args.description ?? i.description,
                    amount: args.amount ?? i.amount,
                    date: args.date ?? i.date,
                    received: args.received ?? i.received,
                  }
                : i,
            )
          : old,
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      ctx?.prev?.forEach(([k, d]) => qc.setQueryData(k, d));
    },
    onSettled: () => inv(["incomes"]),
  });
}

export function useUpdateInvestment() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      type?: string;
      amount?: number;
      percentage?: number;
      date?: string;
    }) => {
      const patch: { type?: string; amount?: number; percentage?: number; date?: string } = {};
      if (args.type !== undefined) patch.type = args.type;
      if (args.amount !== undefined) patch.amount = args.amount;
      if (args.percentage !== undefined) patch.percentage = args.percentage;
      if (args.date !== undefined) patch.date = args.date;
      const { error } = await supabase.from("investments").update(patch).eq("id", args.id);
      if (error) throw error;
    },
    onSettled: () => inv(["investments"]),
  });
}

export function useUpdatePurchase() {
  const inv = useInvalidate();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      description?: string;
      totalAmount?: number;
      date?: string;
    }) => {
      const patch: { description?: string; total_amount?: number; purchase_date?: string } = {};
      if (args.description !== undefined) patch.description = args.description;
      if (args.totalAmount !== undefined) patch.total_amount = args.totalAmount;
      if (args.date !== undefined) patch.purchase_date = args.date;
      const { error } = await supabase.from("purchases").update(patch).eq("id", args.id);
      if (error) throw error;
    },
    onMutate: async (args) => {
      await qc.cancelQueries({ queryKey: ["purchases"] });
      const prev = qc.getQueriesData<Purchase[]>({ queryKey: ["purchases"] });
      qc.setQueriesData<Purchase[]>({ queryKey: ["purchases"] }, (old) =>
        old
          ? old.map((p) =>
              p.id === args.id
                ? {
                    ...p,
                    description: args.description ?? p.description,
                    totalAmount: args.totalAmount ?? p.totalAmount,
                    date: args.date ?? p.date,
                  }
                : p,
            )
          : old,
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      ctx?.prev?.forEach(([k, d]) => qc.setQueryData(k, d));
    },
    onSettled: () => inv(["purchases", "installments"]),
  });
}

/**
 * Recria as parcelas de uma compra (parcelada) mudando o número de parcelas.
 * Mantém o mês da PRIMEIRA parcela igual à atual (ou ao anchor informado) e
 * redistribui o valor total proporcionalmente nas N novas parcelas.
 */
export function useChangePurchaseInstallments() {
  const { user } = useAuth();
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (args: {
      purchaseId: string;
      newCount: number;
      totalAmount: number;
    }) => {
      if (!user) throw new Error("Não autenticado.");
      const newCount = Math.max(1, Math.floor(args.newCount));

      // 1) Descobre a data da primeira parcela atual (para ancorar a nova série)
      const { data: existing } = await supabase
        .from("installments")
        .select("number,due_date")
        .eq("parent_id", args.purchaseId)
        .eq("parent_type", "purchase")
        .order("number", { ascending: true })
        .limit(1);
      const firstDue =
        existing && existing.length > 0
          ? (existing[0] as { due_date: string }).due_date
          : new Date().toISOString().slice(0, 10);

      // 2) Apaga todas as parcelas antigas dessa compra
      await supabase
        .from("installments")
        .delete()
        .eq("parent_id", args.purchaseId)
        .eq("parent_type", "purchase");

      // 3) Atualiza o número de parcelas e o total no purchase
      await supabase
        .from("purchases")
        .update({
          installments_count: newCount,
          total_amount: args.totalAmount,
        })
        .eq("id", args.purchaseId);

      // 4) Cria as novas parcelas ancoradas na data da primeira
      const items = buildInstallmentsAnchored(
        args.purchaseId,
        user.id,
        args.totalAmount,
        newCount,
        1,
        firstDue,
        "purchase",
        false,
      );
      if (items.length > 0) {
        const { error } = await supabase.from("installments").insert(items);
        if (error) throw error;
      }
    },
    onSettled: () => inv(["purchases", "installments"]),
  });
}

// =======================
// Effective "current" month — Day-27 rule
// =======================
/**
 * Returns the month/year considered "current" by the business rule:
 *   - If today's day < 27: returns the actual current month.
 *   - If today's day >= 27: rolls over to the NEXT month — meaning future
 *     month data starts being included in "saldo atual" calculations.
 */
export function getEffectiveCurrentMonth(today: Date = new Date()): {
  year: number;
  month: number;
} {
  if (today.getDate() < 27) {
    return { year: today.getFullYear(), month: today.getMonth() };
  }
  const next = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return { year: next.getFullYear(), month: next.getMonth() };
}

/**
 * Like computeAccountBalance but considers ONLY months up to (and including)
 * the effective current month — so future months never inflate the balance.
 * "saldo atual" = initialBalance + sum(rec - deb - fat - inv) for each past
 * month (ignoring paid status).
 */
export function computeAccountBalanceUntilNow(
  account: Account,
  cards: Card[],
  purchases: Purchase[],
  installments: Installment[],
  debits: Debit[],
  incomes: Income[],
  investments: Investment[],
  today: Date = new Date(),
): number {
  const eff = getEffectiveCurrentMonth(today);
  const monthly = computeMonthlyAccountBalance(
    account,
    cards,
    purchases,
    installments,
    debits,
    incomes,
    investments,
  );
  // Find the latest key <= effective current month
  let result = account.initialBalance;
  const keys = Array.from(monthly.keys()).sort((a, b) => {
    const [ay, am] = a.split("-").map(Number);
    const [by, bm] = b.split("-").map(Number);
    return ay !== by ? ay - by : am - bm;
  });
  for (const k of keys) {
    const [y, m] = k.split("-").map(Number);
    if (y > eff.year || (y === eff.year && m > eff.month)) break;
    result = monthly.get(k)!.saldoEmConta;
  }
  return result;
}

/** Normalize -0 to 0 and clamp tiny float noise so no "-R$ 0,00" leaks out. */
export function normalizeZero(n: number): number {
  if (Math.abs(n) < 0.005) return 0;
  return n;
}

// =======================
// Recurring series (debits / incomes)
// =======================
//
// A "recurring" debit/income is materialized as N independent monthly rows,
// each sharing the same `recurrence_group_id`. There are NO `installments`
// rows for recurring series — recurrence is NOT installment.
//
// Scope semantics for edit/delete on a recurring row:
//   - "one":     touch only the clicked row
//   - "forward": touch the clicked row AND every future row in the same
//                group (date >= the clicked row's date)
//
type RecurringKind = "debit" | "income";

export function useUpdateRecurringSeries() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (args: {
      kind: RecurringKind;
      id: string;
      groupId: string;
      anchorDate: string;
      scope: "one" | "forward";
      patch: { description?: string; amount?: number; date?: string };
    }) => {
      const table = args.kind === "debit" ? "debits" : "incomes";
      const baseUpdate: any = {};
      if (args.patch.description !== undefined) baseUpdate.description = args.patch.description;
      if (args.patch.amount !== undefined) baseUpdate.amount = args.patch.amount;

      if (args.scope === "one") {
        const update: any = { ...baseUpdate };
        if (args.patch.date !== undefined) (update as any).date = args.patch.date;
        const { error } = await (supabase.from(table) as any).update(update).eq("id", args.id);
        if (error) throw error;
        return;
      }

      // forward: this row + all rows in the group with date >= anchorDate
      if (Object.keys(baseUpdate).length > 0) {
        const { error } = await (supabase.from(table) as any)
          .update(baseUpdate)
          .eq("recurrence_group_id", args.groupId)
          .gte("date", args.anchorDate);
        if (error) throw error;
      }

      // Date change with forward scope = shift each future row to use the
      // NEW day-of-month (clamped to that month's last day).
      if (args.patch.date !== undefined) {
        const newDay = parseInt(args.patch.date.slice(8, 10), 10);
        const { data, error } = await supabase
          .from(table)
          .select("id,date")
          .eq("recurrence_group_id", args.groupId)
          .gte("date", args.anchorDate);
        if (error) throw error;
        for (const row of (data ?? []) as { id: string; date: string }[]) {
          const [y, m] = row.date.slice(0, 10).split("-").map(Number);
          const last = new Date(y, m, 0).getDate();
          const day = Math.min(newDay, last);
          const newDate = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const { error: ue } = await (supabase.from(table) as any).update({ date: newDate }).eq("id", row.id);
          if (ue) throw ue;
        }
      }
    },
    onSettled: () => inv(["debits", "incomes"]),
  });
}

export function useDeleteRecurringSeries() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (args: {
      kind: RecurringKind;
      id: string;
      groupId: string;
      anchorDate: string;
      scope: "one" | "forward";
    }) => {
      const table = args.kind === "debit" ? "debits" : "incomes";
      if (args.scope === "one") {
        const { error } = await supabase.from(table).delete().eq("id", args.id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from(table)
        .delete()
        .eq("recurrence_group_id", args.groupId)
        .gte("date", args.anchorDate);
      if (error) throw error;
    },
    onSettled: () => inv(["debits", "incomes"]),
  });
}

/**
 * On mount, ensure every recurrence group has a row in the given target
 * (year, month). For each group missing the target month, clones the
 * latest row with the same day-of-month (clamped). Runs once per
 * (user, year, month).
 */
// Tracks which (user, year, month) combinations have already been ensured
// in this browser session. Prevents the ensure routine from re-running on
// every mount/navigation, which was racing against in-flight optimistic
// mutations (toggle paid, delete) and causing visual duplication.
// Persiste no sessionStorage para sobreviver re-mounts do componente
// mas resetar ao fechar o app/aba.
const getEnsuredKeys = () => {
  try {
    const raw = sessionStorage.getItem("ensuredRecurringKeys");
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set<string>();
  }
};
const addEnsuredKey = (key: string) => {
  try {
    const keys = getEnsuredKeys();
    keys.add(key);
    sessionStorage.setItem("ensuredRecurringKeys", JSON.stringify([...keys]));
  } catch {}
};
const deleteEnsuredKey = (key: string) => {
  try {
    const keys = getEnsuredKeys();
    keys.delete(key);
    sessionStorage.setItem("ensuredRecurringKeys", JSON.stringify([...keys]));
  } catch {}
};
const hasEnsuredKey = (key: string) => getEnsuredKeys().has(key);

export function useEnsureRecurringForMonth(year: number, month: number) {
  const { user } = useAuth();
  const qc = useQueryClient();
  useEffect(() => {
    if (!user) return;
    const key = `${user.id}:${year}:${month}`;
    if (hasEnsuredKey(key)) return;
    // Mark immediately so concurrent mounts of the same route don't double-run.
    addEnsuredKey(key);

    let cancelled = false;
    (async () => {
      const monthStr = String(month + 1).padStart(2, "0");
      const lastDay = new Date(year, month + 1, 0).getDate();
      const startStr = `${year}-${monthStr}-01`;
      const endStr = `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}`;
      let inserted = false;

      try {
        for (const table of ["debits", "incomes"] as const) {
          const { data: groupRows, error } = await supabase
            .from(table)
            .select("recurrence_group_id")
            .not("recurrence_group_id", "is", null);
          if (error || cancelled) return;

          const groupIds = Array.from(
            new Set((groupRows ?? []).map((g: any) => g.recurrence_group_id as string)),
          ).filter(Boolean);

          for (const gid of groupIds) {
            if (cancelled) return;
            const { data: existing } = await supabase
              .from(table)
              .select("id")
              .eq("recurrence_group_id", gid)
              .gte("date", startStr)
              .lte("date", endStr)
              .limit(1);
            if (existing && existing.length > 0) continue;

            const { data: earliest } = await supabase
              .from(table)
              .select("date")
              .eq("recurrence_group_id", gid)
              .order("date", { ascending: true })
              .limit(1);
            if (!earliest || earliest.length === 0) continue;
            const seriesStartDate = earliest[0].date as string;
            const seriesYear = parseInt(seriesStartDate.slice(0, 4), 10);
            const seriesMonth = parseInt(seriesStartDate.slice(5, 7), 10) - 1;
            if (year < seriesYear || (year === seriesYear && month < seriesMonth)) continue;

            const { data: latest } = await supabase
              .from(table)
              .select("*")
              .eq("recurrence_group_id", gid)
              .order("date", { ascending: false })
              .limit(1);
            if (!latest || latest.length === 0) continue;
            const t = latest[0] as any;
            const day = parseInt(String(t.date).slice(8, 10), 10);
            const dd = Math.min(day, lastDay);
            const newDate = `${year}-${monthStr}-${String(dd).padStart(2, "0")}`;

            const row: any = {
              id: await deterministicUuid(`recurring:${table}:${gid}:${year}:${month}`),
              user_id: user.id,
              account_id: t.account_id,
              description: t.description,
              amount: t.amount,
              date: newDate,
              installments_count: 1,
              is_parent: false,
              recurrence_group_id: gid,
            };
            if (table === "debits") {
              row.required = true;
              row.paid = false;
              row.auto_debit = t.auto_debit ?? false;
              row.auto_debit_day = t.auto_debit_day ?? null;
            } else {
              row.received = false;
            }
            const { error: ie } = await (supabase.from(table) as any).insert(row);
            if (ie) continue;
            inserted = true;
          }
        }

        if (cancelled || !inserted) return;

        // Wait for any in-flight mutations to settle before invalidating.
        // Without this wait, an optimistic toggle/delete in progress would
        // be clobbered by the refetch and reappear visually.
        const waitForMutationsIdle = async () => {
          const deadline = Date.now() + 5000;
          while (qc.isMutating() > 0 && Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, 150));
          }
        };
        await waitForMutationsIdle();
        if (cancelled) return;
        qc.invalidateQueries({ queryKey: ["debits"], refetchType: "active" });
        qc.invalidateQueries({ queryKey: ["incomes"], refetchType: "active" });
      } catch {
        // If anything threw, allow a future mount to retry.
        deleteEnsuredKey(key);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, year, month]);
}

// =======================
// Description suggestions (autocomplete)
// =======================
/**
 * Returns previously-used descriptions for the current user from the given
 * domain, ranked by usage frequency (desc) then recency (desc). Same-category
 * only — debit suggestions don't pollute income, etc.
 */
export function useDescriptionSuggestions(
  kind: "debit" | "income" | "purchase" | "investment",
): string[] {
  const { user } = useAuth();
  const table =
    kind === "debit"
      ? "debits"
      : kind === "income"
        ? "incomes"
        : kind === "purchase"
          ? "purchases"
          : "investments";
  const field = kind === "investment" ? "type" : "description";
  const { data = [] } = useQuery({
    queryKey: ["description-suggestions", kind, user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<{ label: string; createdAt: string }[]> => {
      const { data, error } = await supabase
        .from(table)
        .select(`${field}, created_at`)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => ({
        label: String(row[field] ?? "").trim(),
        createdAt: String(row["created_at"] ?? ""),
      }));
    },
  });
  return useMemo(() => {
    const stats = new Map<string, { display: string; count: number; latest: string }>();
    for (const row of data) {
      const label = row.label;
      if (!label) continue;
      const key = label.toLowerCase();
      const prev = stats.get(key);
      if (prev) {
        prev.count += 1;
        if (row.createdAt > prev.latest) {
          prev.latest = row.createdAt;
          prev.display = label;
        }
      } else {
        stats.set(key, { display: label, count: 1, latest: row.createdAt });
      }
    }
    return Array.from(stats.values())
      .sort((a, b) => (b.count - a.count) || (b.latest > a.latest ? 1 : -1))
      .map((s) => s.display);
  }, [data]);
}

