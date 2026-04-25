import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";

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
};

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
};

export type Investment = {
  id: string;
  accountId: string;
  type: string;
  amount: number;
  percentage: number;
};

// =======================
// Helpers
// =======================
const round2 = (n: number) => Math.round(n * 100) / 100;

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
  const d = typeof purchaseDate === "string" ? new Date(purchaseDate) : purchaseDate;
  const purchaseDay = d.getDate();
  // If purchase happens AFTER the closing day, the invoice closes next month
  // and is due the month after. Otherwise it closes this month and is due next.
  const monthsAhead = purchaseDay > closingDay ? 2 : 1;
  const target = new Date(d.getFullYear(), d.getMonth() + monthsAhead, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const day = Math.min(dueDay, lastDay);
  const due = new Date(target.getFullYear(), target.getMonth(), day);
  return {
    year: due.getFullYear(),
    month: due.getMonth(),
    dueDate: due.toISOString().slice(0, 10),
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
  const start = new Date(startDate);
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
      due_date: d.toISOString().slice(0, 10),
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
      due_date: d.toISOString().slice(0, 10),
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
  purchaseId: string,
  userId: string,
  totalAmount: number,
  installmentsCount: number,
  anchorNumber: number,
  anchorDate: string,
) {
  const count = Math.max(1, installmentsCount);
  const anchor = Math.min(Math.max(1, anchorNumber), count);
  const base = round2(totalAmount / count);
  // Parse anchorDate como data LOCAL (evita shift de fuso com new Date("YYYY-MM-DD") que assume UTC)
  const [ay, am, ad] = anchorDate.slice(0, 10).split("-").map((n) => parseInt(n, 10));
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
      parent_id: purchaseId,
      parent_type: "purchase",
      purchase_id: purchaseId,
      number: i,
      total: count,
      amount,
      due_date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      year: d.getFullYear(),
      month: d.getMonth(),
      paid: i < anchor,
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
        .select("id,account_id,name,color,closing_day,due_day")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((c) => ({
        id: c.id,
        accountId: c.account_id,
        name: c.name,
        color: c.color,
        closingDay: c.closing_day,
        dueDay: c.due_day,
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
      const { data, error } = await supabase
        .from("purchases")
        .select("id,card_id,description,total_amount,purchase_date,installments_count");
      if (error) throw error;
      return (data ?? []).map((p) => ({
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
      const { data, error } = await supabase
        .from("installments")
        .select("id,parent_type,parent_id,purchase_id,number,total,amount,due_date,year,month,paid")
        .order("year", { ascending: true })
        .order("month", { ascending: true })
        .order("number", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((i) => ({
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
    queryFn: async (): Promise<Debit[]> => {
      const { data, error } = await supabase
        .from("debits")
        .select("id,account_id,description,amount,date,required,paid,auto_debit,auto_debit_day,installments_count,is_parent")
        .order("date", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((d) => ({
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
      }));
    },
  });
}

export function useIncomes() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["incomes", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Income[]> => {
      const { data, error } = await supabase
        .from("incomes")
        .select("id,account_id,description,amount,date,received,installments_count,is_parent")
        .order("date", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((d) => ({
        id: d.id,
        accountId: d.account_id,
        description: d.description,
        amount: num(d.amount as number | string),
        date: d.date,
        received: d.received,
        installmentsCount: d.installments_count,
        isParent: d.is_parent,
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
      const { data, error } = await supabase
        .from("investments")
        .select("id,account_id,type,amount,percentage");
      if (error) throw error;
      return (data ?? []).map((i) => ({
        id: i.id,
        accountId: i.account_id,
        type: i.type,
        amount: num(i.amount as number | string),
        percentage: num(i.percentage as number | string),
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
      const { data, error } = await supabase
        .from("card_payments")
        .select("card_id,year,month,paid");
      if (error) throw error;
      const map: Record<string, boolean> = {};
      for (const r of (data ?? []) as Array<{ card_id: string; year: number; month: number; paid: boolean }>) {
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
  return (keys: string[]) => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
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
    onSuccess: () => inv(["accounts"]),
  });
}

export function useRemoveAccount() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      // Cascading FKs handle cards/debits/incomes/investments removal.
      // Installments are linked to purchases (via parent_id) — wipe them
      // explicitly before purchases vanish through cards cascade.
      const { data: cardRows } = await supabase.from("cards").select("id").eq("account_id", id);
      const cardIds = (cardRows ?? []).map((c) => c.id);
      if (cardIds.length > 0) {
        const { data: purs } = await supabase.from("purchases").select("id").in("card_id", cardIds);
        const purIds = (purs ?? []).map((p) => p.id);
        if (purIds.length > 0) {
          await supabase.from("installments").delete().in("parent_id", purIds).eq("parent_type", "purchase");
        }
      }
      // Debits + Incomes also have child installments
      const { data: debs } = await supabase.from("debits").select("id").eq("account_id", id);
      const debIds = (debs ?? []).map((d) => d.id);
      if (debIds.length > 0) {
        await supabase.from("installments").delete().in("parent_id", debIds).eq("parent_type", "debit");
      }
      const { data: incs } = await supabase.from("incomes").select("id").eq("account_id", id);
      const incIds = (incs ?? []).map((i) => i.id);
      if (incIds.length > 0) {
        await supabase.from("installments").delete().in("parent_id", incIds).eq("parent_type", "income");
      }
      const { error } = await supabase.from("accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () =>
      inv(["accounts", "cards", "purchases", "installments", "debits", "incomes", "investments", "card_payments"]),
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
    onSuccess: () => inv(["accounts"]),
  });
}

// =======================
// Mutations — Cards / Purchases
// =======================
export function useAddCard() {
  const { user } = useAuth();
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (c: Omit<Card, "id">) => {
      const { error } = await supabase.from("cards").insert({
        user_id: user!.id,
        account_id: c.accountId,
        name: c.name,
        color: c.color,
        closing_day: c.closingDay,
        due_day: c.dueDay,
      });
      if (error) throw error;
    },
    onSuccess: () => inv(["cards"]),
  });
}

export function useRemoveCard() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: purs } = await supabase.from("purchases").select("id").eq("card_id", id);
      const ids = (purs ?? []).map((p) => p.id);
      if (ids.length > 0) {
        await supabase.from("installments").delete().in("parent_id", ids).eq("parent_type", "purchase");
        await supabase.from("purchases").delete().in("id", ids);
      }
      const { error } = await supabase.from("cards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => inv(["cards", "purchases", "installments", "card_payments"]),
  });
}

export function useAddPurchase() {
  const { user } = useAuth();
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (p: Omit<Purchase, "id">) => {
      // Need card's closing/due day to calculate the invoice month.
      const { data: card, error: eCard } = await supabase
        .from("cards")
        .select("closing_day,due_day")
        .eq("id", p.cardId)
        .single();
      if (eCard) throw eCard;
      const { data, error } = await supabase
        .from("purchases")
        .insert({
          user_id: user!.id,
          card_id: p.cardId,
          description: p.description,
          total_amount: p.totalAmount,
          purchase_date: p.date,
          installments_count: p.installmentsCount,
        })
        .select("id")
        .single();
      if (error) throw error;
      const inst = buildInstallmentsForPurchase(
        (data as { id: string }).id,
        user!.id,
        p.totalAmount,
        p.installmentsCount,
        p.date,
        (card as { closing_day: number; due_day: number }).closing_day,
        (card as { closing_day: number; due_day: number }).due_day,
      );
      const { error: e2 } = await supabase.from("installments").insert(inst);
      if (e2) throw e2;
    },
    onSuccess: () => inv(["purchases", "installments"]),
  });
}

export function useRemovePurchase() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("installments").delete().eq("parent_id", id).eq("parent_type", "purchase");
      const { error } = await supabase.from("purchases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => inv(["purchases", "installments", "card_payments"]),
  });
}

// =======================
// Installments
// =======================
export function useUpdateInstallment() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (args: { id: string; amount?: number; dueDate?: string; paid?: boolean }) => {
      const patch: { amount?: number; due_date?: string; year?: number; month?: number; paid?: boolean } = {};
      if (args.amount !== undefined) patch.amount = args.amount;
      if (args.dueDate !== undefined) {
        patch.due_date = args.dueDate;
        const d = new Date(args.dueDate);
        patch.year = d.getFullYear();
        patch.month = d.getMonth();
      }
      if (args.paid !== undefined) patch.paid = args.paid;
      const { error } = await supabase.from("installments").update(patch).eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => inv(["installments", "card_payments"]),
  });
}

export function useShiftInstallmentDate() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (args: { installment: Installment; newDate: string; applyToFuture: boolean }) => {
      const newD = new Date(args.newDate);
      const { error: eCur } = await supabase
        .from("installments")
        .update({ due_date: args.newDate, year: newD.getFullYear(), month: newD.getMonth() })
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
        const day = newD.getDate();
        for (const r of (rows ?? []) as Array<{ id: string; number: number }>) {
          const offset = r.number - args.installment.number;
          const target = new Date(newD.getFullYear(), newD.getMonth() + offset, 1);
          const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
          const d = new Date(target.getFullYear(), target.getMonth(), Math.min(day, lastDay));
          const { error: eUpd } = await supabase
            .from("installments")
            .update({ due_date: d.toISOString().slice(0, 10), year: d.getFullYear(), month: d.getMonth() })
            .eq("id", r.id);
          if (eUpd) throw eUpd;
        }
      }
    },
    onSuccess: () => inv(["installments", "card_payments"]),
  });
}

export function useToggleInstallmentPaid() {
  const upd = useUpdateInstallment();
  return (id: string, paid: boolean) => upd.mutate({ id, paid });
}

export function useSetCardPaid() {
  const { user } = useAuth();
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (args: { cardId: string; year: number; month: number; paid: boolean }) => {
      const { data: pursRaw, error: e1 } = await supabase
        .from("purchases")
        .select("id")
        .eq("card_id", args.cardId);
      if (e1) throw e1;
      const purIds = (pursRaw ?? []).map((p) => p.id);
      if (purIds.length > 0) {
        const { error: e2 } = await supabase
          .from("installments")
          .update({ paid: args.paid })
          .in("parent_id", purIds)
          .eq("parent_type", "purchase")
          .eq("year", args.year)
          .eq("month", args.month);
        if (e2) throw e2;
      }
      const { error: e3 } = await supabase
        .from("card_payments")
        .upsert(
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
    }) => {
      const count = Math.max(1, d.installmentsCount ?? 1);
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
        })
        .select("id")
        .single();
      if (error) throw error;
      if (count > 1) {
        const inst = buildInstallments(
          (ins as { id: string }).id,
          "debit",
          user!.id,
          d.amount,
          count,
          d.date,
        );
        const { error: e2 } = await supabase.from("installments").insert(inst);
        if (e2) throw e2;
      }
    },
    onSuccess: () => inv(["debits", "installments"]),
  });
}

export function useToggleDebitPaid() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (args: { id: string; paid: boolean }) => {
      const { error } = await supabase.from("debits").update({ paid: args.paid }).eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => inv(["debits"]),
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
    onSuccess: () => inv(["debits", "installments"]),
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
    }) => {
      const count = Math.max(1, i.installmentsCount ?? 1);
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
        })
        .select("id")
        .single();
      if (error) throw error;
      if (count > 1) {
        const inst = buildInstallments(
          (ins as { id: string }).id,
          "income",
          user!.id,
          i.amount,
          count,
          i.date,
        );
        const { error: e2 } = await supabase.from("installments").insert(inst);
        if (e2) throw e2;
      }
    },
    onSuccess: () => inv(["incomes", "installments"]),
  });
}

export function useToggleIncomeReceived() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (args: { id: string; received: boolean }) => {
      const { error } = await supabase
        .from("incomes")
        .update({ received: args.received })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => inv(["incomes"]),
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
    onSuccess: () => inv(["incomes", "installments"]),
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
      });
      if (error) throw error;
    },
    onSuccess: () => inv(["investments"]),
  });
}

export function useRemoveInvestment() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("investments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => inv(["investments"]),
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
// Selectors
// =======================
export function getMonthInstallments(installments: Installment[], year: number, month: number) {
  return installments.filter((i) => i.year === year && i.month === month);
}

export function getMonthDebits(
  debits: Debit[],
  installments: Installment[],
  year: number,
  month: number,
) {
  const single = debits
    .filter((d) => !d.isParent)
    .filter((d) => {
      const dt = new Date(d.date);
      return dt.getFullYear() === year && dt.getMonth() === month;
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
      const dt = new Date(d.date);
      return dt.getFullYear() === year && dt.getMonth() === month;
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
  installments: Installment[],
  purchases: Purchase[],
  cardPayments: Record<string, boolean>,
  cardId: string,
  year: number,
  month: number,
) {
  const monthInst = installments.filter((i) => {
    if (i.parentType !== "purchase") return false;
    const pur = purchases.find((p) => p.id === i.parentId);
    return pur?.cardId === cardId && i.year === year && i.month === month;
  });
  const key = `${cardId}-${year}-${month}`;
  if (monthInst.length === 0) return cardPayments[key] ?? false;
  return monthInst.every((i) => i.paid);
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
  for (const inc of incomes.filter((i) => i.accountId === account.id && !i.isParent && i.received)) {
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
