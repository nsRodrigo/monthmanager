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

export type Installment = {
  id: string;
  purchaseId: string;
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
};

export type Income = {
  id: string;
  description: string;
  amount: number;
  date: string;
  received: boolean;
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
 * Example: 100 / 3 => 33.33, 33.33, 33.34
 */
export function buildInstallmentsForPurchase(
  purchaseId: string,
  userId: string,
  totalAmount: number,
  installmentsCount: number,
  startDate: string,
) {
  const count = Math.max(1, installmentsCount);
  const base = round2(totalAmount / count);
  const start = new Date(startDate);
  let accum = 0;
  const items: Array<{
    user_id: string;
    purchase_id: string;
    number: number;
    total: number;
    amount: number;
    due_date: string;
    year: number;
    month: number;
    paid: boolean;
  }> = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, start.getDate());
    const amount = i === count - 1 ? round2(totalAmount - accum) : base;
    accum += amount;
    items.push({
      user_id: userId,
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
  purchase_id: string;
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
};
type IncomeRow = {
  id: string;
  description: string;
  amount: number | string;
  date: string;
  received: boolean;
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
        .select("id,purchase_id,number,total,amount,due_date,year,month,paid")
        .order("year", { ascending: true })
        .order("month", { ascending: true })
        .order("number", { ascending: true });
      if (error) throw error;
      return (data as InstallmentRow[]).map((i) => ({
        id: i.id,
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
        .select("id,description,amount,date,required,paid")
        .order("date", { ascending: true });
      if (error) throw error;
      return (data as DebitRow[]).map((d) => ({
        ...d,
        amount: num(d.amount),
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
        .select("id,description,amount,date,received")
        .order("date", { ascending: true });
      if (error) throw error;
      return (data as IncomeRow[]).map((d) => ({ ...d, amount: num(d.amount) }));
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
      const inst = buildInstallmentsForPurchase(
        (data as { id: string }).id,
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

export function useToggleInstallmentPaid() {
  const upd = useUpdateInstallment();
  return (id: string, paid: boolean) => upd.mutate({ id, paid });
}

export function useSetCardPaid() {
  const { user } = useAuth();
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (args: { cardId: string; year: number; month: number; paid: boolean }) => {
      // Mark all installments of that card/month accordingly
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
          .in("purchase_id", purIds)
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

export function useAddDebit() {
  const { user } = useAuth();
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (d: Omit<Debit, "id" | "paid">) => {
      const { error } = await supabase.from("debits").insert({
        user_id: user!.id,
        description: d.description,
        amount: d.amount,
        date: d.date,
        required: d.required,
        paid: false,
      });
      if (error) throw error;
    },
    onSuccess: () => inv(["debits"]),
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
      const { error } = await supabase.from("debits").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => inv(["debits"]),
  });
}

export function useAddIncome() {
  const { user } = useAuth();
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (i: Omit<Income, "id" | "received">) => {
      const { error } = await supabase.from("incomes").insert({
        user_id: user!.id,
        description: i.description,
        amount: i.amount,
        date: i.date,
        received: false,
      });
      if (error) throw error;
    },
    onSuccess: () => inv(["incomes"]),
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
      const { error } = await supabase.from("incomes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => inv(["incomes"]),
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
  // optional: when these are present, treat as detailed installment row
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
      // group rows that look like detailed installments by (description+date+card+total)
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
          // respect user values
          const insertRows = detailed.map((r) => {
            const due = r.installmentDueDate ?? head.purchaseDate;
            const d = new Date(due);
            return {
              user_id: user!.id,
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
          // auto-generate
          const inst = buildInstallmentsForPurchase(
            purchaseId,
            user!.id,
            head.totalAmount,
            head.installmentsCount,
            head.purchaseDate,
          );
          // if a global "paid" flag is set on the row, apply
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
export function getMonthDebits(debits: Debit[], year: number, month: number) {
  return debits.filter((d) => {
    const dt = new Date(d.date);
    return dt.getFullYear() === year && dt.getMonth() === month;
  });
}
export function getMonthIncomes(incomes: Income[], year: number, month: number) {
  return incomes.filter((i) => {
    const dt = new Date(i.date);
    return dt.getFullYear() === year && dt.getMonth() === month;
  });
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
    const pur = purchases.find((p) => p.id === i.purchaseId);
    return pur?.cardId === cardId && i.year === year && i.month === month;
  });
  const key = `${cardId}-${year}-${month}`;
  if (monthInst.length === 0) return cardPayments[key] ?? false;
  return monthInst.every((i) => i.paid);
}
