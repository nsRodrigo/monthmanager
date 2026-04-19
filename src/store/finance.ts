import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";

// =======================
// Types (camelCase domain)
// =======================
export type Card = {
  id: string;
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
  date: string; // ISO yyyy-mm-dd
  installmentsCount: number;
};

export type ParentType = "purchase" | "debit" | "income";

export type Installment = {
  id: string;
  parentType: ParentType;
  parentId: string;
  purchaseId: string | null; // legacy mirror for purchase installments
  number: number;
  total: number;
  amount: number;
  dueDate: string; // ISO
  year: number;
  month: number; // 0-11
  paid: boolean;
};

export type Debit = {
  id: string;
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
  description: string;
  amount: number;
  date: string;
  received: boolean;
  installmentsCount: number;
  isParent: boolean;
};

export type Investment = {
  id: string;
  type: string;
  amount: number;
  percentage: number;
};

// =======================
// Helpers
// =======================
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Generate installments evenly, last one absorbs rounding.
 * The day-of-month is preserved for every parcel (ex: 25/04, 25/05, 25/06).
 * Example: 100 / 3 => 33.33, 33.33, 33.34
 */
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
    // Same day-of-month, advance month — clamp if month is shorter (e.g. 31 -> 28/feb).
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

// Backwards-compatible wrapper used by importer.
export function buildInstallmentsForPurchase(
  purchaseId: string,
  userId: string,
  totalAmount: number,
  installmentsCount: number,
  startDate: string,
) {
  return buildInstallments(purchaseId, "purchase", userId, totalAmount, installmentsCount, startDate);
}

// =======================
// Row mappers
// =======================
type CardRow = { id: string; name: string; color: string; closing_day: number; due_day: number };
type PurchaseRow = {
  id: string;
  card_id: string;
  description: string;
  total_amount: number | string;
  purchase_date: string;
  installments_count: number;
};
type InstallmentRow = {
  id: string;
  parent_type: ParentType;
  parent_id: string;
  purchase_id: string | null;
  number: number;
  total: number;
  amount: number | string;
  due_date: string;
  year: number;
  month: number;
  paid: boolean;
};
type DebitRow = {
  id: string;
  description: string;
  amount: number | string;
  date: string;
  required: boolean;
  paid: boolean;
  auto_debit: boolean;
  auto_debit_day: number | null;
  installments_count: number;
  is_parent: boolean;
};
type IncomeRow = {
  id: string;
  description: string;
  amount: number | string;
  date: string;
  received: boolean;
  installments_count: number;
  is_parent: boolean;
};
type InvRow = { id: string; type: string; amount: number | string; percentage: number | string };

const num = (v: number | string) => (typeof v === "number" ? v : parseFloat(v));

// =======================
// Hooks
// =======================
export function useCards() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["cards", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Card[]> => {
      const { data, error } = await supabase
        .from("cards")
        .select("id,name,color,closing_day,due_day")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as CardRow[]).map((c) => ({
        id: c.id,
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
      return (data as PurchaseRow[]).map((p) => ({
        id: p.id,
        cardId: p.card_id,
        description: p.description,
        totalAmount: num(p.total_amount),
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
      return (data as InstallmentRow[]).map((i) => ({
        id: i.id,
        parentType: i.parent_type,
        parentId: i.parent_id,
        purchaseId: i.purchase_id,
        number: i.number,
        total: i.total,
        amount: num(i.amount),
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
        .select("id,description,amount,date,required,paid,auto_debit,auto_debit_day,installments_count,is_parent")
        .order("date", { ascending: true });
      if (error) throw error;
      return (data as DebitRow[]).map((d) => ({
        id: d.id,
        description: d.description,
        amount: num(d.amount),
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
        .select("id,description,amount,date,received,installments_count,is_parent")
        .order("date", { ascending: true });
      if (error) throw error;
      return (data as IncomeRow[]).map((d) => ({
        id: d.id,
        description: d.description,
        amount: num(d.amount),
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
        .select("id,type,amount,percentage");
      if (error) throw error;
      return (data as InvRow[]).map((i) => ({
        id: i.id,
        type: i.type,
        amount: num(i.amount),
        percentage: num(i.percentage),
      }));
    },
  });
}

export function useWallet() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["wallet", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase
        .from("wallet")
        .select("amount")
        .maybeSingle();
      if (error) throw error;
      return data ? num((data as { amount: number | string }).amount) : 0;
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
      for (const r of data as Array<{ card_id: string; year: number; month: number; paid: boolean }>) {
        map[`${r.card_id}-${r.year}-${r.month}`] = r.paid;
      }
      return map;
    },
  });
}

// =======================
// Mutations
// =======================
function useInvalidate() {
  const qc = useQueryClient();
  return (keys: string[]) => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}

export function useAddCard() {
  const { user } = useAuth();
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (c: Omit<Card, "id">) => {
      const { error } = await supabase.from("cards").insert({
        user_id: user!.id,
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
      // also remove installments tied to purchases of this card
      const { data: purs } = await supabase.from("purchases").select("id").eq("card_id", id);
      const ids = (purs as Array<{ id: string }> | null)?.map((p) => p.id) ?? [];
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
      const inst = buildInstallments(
        (data as { id: string }).id,
        "purchase",
        user!.id,
        p.totalAmount,
        p.installmentsCount,
        p.date,
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
      // remove installments first (foreign key not declared but consistent)
      await supabase.from("installments").delete().eq("parent_id", id).eq("parent_type", "purchase");
      const { error } = await supabase.from("purchases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => inv(["purchases", "installments", "card_payments"]),
  });
}

export function useUpdateInstallment() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      amount?: number;
      dueDate?: string;
      paid?: boolean;
    }) => {
      const patch: {
        amount?: number;
        due_date?: string;
        year?: number;
        month?: number;
        paid?: boolean;
      } = {};
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

/**
 * Smart date update: shifts THIS installment to a new date and, optionally,
 * shifts every installment AFTER it to keep the same day-of-month.
 * Past installments are NEVER affected.
 */
export function useShiftInstallmentDate() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (args: {
      installment: Installment;
      newDate: string;
      applyToFuture: boolean;
    }) => {
      const newD = new Date(args.newDate);
      // Always update the current one
      const updates: Array<Promise<unknown>> = [
        supabase
          .from("installments")
          .update({
            due_date: args.newDate,
            year: newD.getFullYear(),
            month: newD.getMonth(),
          })
          .eq("id", args.installment.id),
      ];

      if (args.applyToFuture) {
        // Get all future installments of the same parent
        const { data: rows, error } = await supabase
          .from("installments")
          .select("id,number")
          .eq("parent_id", args.installment.parentId)
          .eq("parent_type", args.installment.parentType)
          .gt("number", args.installment.number);
        if (error) throw error;
        const day = newD.getDate();
        for (const r of (rows as Array<{ id: string; number: number }>) ?? []) {
          const offset = r.number - args.installment.number;
          const target = new Date(newD.getFullYear(), newD.getMonth() + offset, 1);
          const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
          const d = new Date(target.getFullYear(), target.getMonth(), Math.min(day, lastDay));
          updates.push(
            supabase
              .from("installments")
              .update({
                due_date: d.toISOString().slice(0, 10),
                year: d.getFullYear(),
                month: d.getMonth(),
              })
              .eq("id", r.id),
          );
        }
      }
      const results = await Promise.all(updates);
      for (const r of results) {
        const e = (r as { error?: { message: string } }).error;
        if (e) throw new Error(e.message);
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
      const purIds = (pursRaw as Array<{ id: string }>).map((p) => p.id);
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

// ----- Debits -----
export function useAddDebit() {
  const { user } = useAuth();
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (d: {
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

// ----- Incomes -----
export function useAddIncome() {
  const { user } = useAuth();
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (i: {
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

export function useSetWallet() {
  const { user } = useAuth();
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (amount: number) => {
      const { error } = await supabase
        .from("wallet")
        .upsert(
          { user_id: user!.id, amount, updated_at: new Date().toISOString() },
          { onConflict: "user_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => inv(["wallet"]),
  });
}

export function useAddInvestment() {
  const { user } = useAuth();
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (i: Omit<Investment, "id">) => {
      const { error } = await supabase.from("investments").insert({
        user_id: user!.id,
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

/**
 * Bulk insert imported data: handles both
 *  - "compra com parcelas detalhadas" (respeita valores informados)
 *  - "compra única + n parcelas" (gera parcelas iguais)
 */
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
      const groups = new Map<string, ImportedRow[]>();
      for (const r of rows) {
        const key = `${r.cardId}|${r.description}|${r.purchaseDate}|${r.totalAmount}|${r.installmentsCount}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(r);
      }

      for (const [, items] of groups) {
        const head = items[0];
        const { data: pIns, error: e1 } = await supabase
          .from("purchases")
          .insert({
            user_id: user!.id,
            card_id: head.cardId,
            description: head.description,
            total_amount: head.totalAmount,
            purchase_date: head.purchaseDate,
            installments_count: head.installmentsCount,
          })
          .select("id")
          .single();
        if (e1) throw e1;
        const purchaseId = (pIns as { id: string }).id;

        const detailed = items.filter(
          (r) => r.installmentNumber !== undefined && r.installmentAmount !== undefined,
        );
        if (detailed.length > 0) {
          const insertRows = detailed.map((r) => {
            const due = r.installmentDueDate ?? head.purchaseDate;
            const d = new Date(due);
            return {
              user_id: user!.id,
              parent_id: purchaseId,
              parent_type: "purchase" as const,
              purchase_id: purchaseId,
              number: r.installmentNumber!,
              total: head.installmentsCount,
              amount: r.installmentAmount!,
              due_date: due,
              year: d.getFullYear(),
              month: d.getMonth(),
              paid: !!r.paid,
            };
          });
          const { error: e2 } = await supabase.from("installments").insert(insertRows);
          if (e2) throw e2;
        } else {
          const inst = buildInstallments(
            purchaseId,
            "purchase",
            user!.id,
            head.totalAmount,
            head.installmentsCount,
            head.purchaseDate,
          );
          if (head.paid) inst.forEach((i) => (i.paid = true));
          const { error: e2 } = await supabase.from("installments").insert(inst);
          if (e2) throw e2;
        }
      }
    },
    onSuccess: () => inv(["purchases", "installments", "card_payments"]),
  });
}

// =======================
// Selectors (pure utilities)
// =======================
export function getMonthInstallments(installments: Installment[], year: number, month: number) {
  return installments.filter((i) => i.year === year && i.month === month);
}

/**
 * Returns the items that should appear in a month's "debits" tab.
 * - One-shot debits (installments_count == 1): show by date
 * - Parcelled debits (is_parent): show ONLY their installments (one per month)
 */
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
    .filter((x) => !!x.debit);
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
    .filter((x) => !!x.income);
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
