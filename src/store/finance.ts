import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Card = {
  id: string;
  name: string;
  color: string;
  closingDay: number;
  dueDay: number;
};

export type Installment = {
  id: string;
  purchaseId: string;
  number: number;
  total: number;
  amount: number;
  year: number;
  month: number; // 0-11
  paid: boolean;
};

export type Purchase = {
  id: string;
  cardId: string;
  description: string;
  totalAmount: number;
  date: string; // ISO yyyy-mm-dd
  installmentsCount: number; // 1 = à vista
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

export type CardPaymentStatus = {
  // key: `${cardId}-${year}-${month}` => paid
  [key: string]: boolean;
};

type State = {
  cards: Card[];
  purchases: Purchase[];
  installments: Installment[];
  debits: Debit[];
  incomes: Income[];
  investments: Investment[];
  walletAmount: number;
  cardPayments: CardPaymentStatus;

  // Cards
  addCard: (c: Omit<Card, "id">) => void;
  removeCard: (id: string) => void;

  // Purchases & installments
  addPurchase: (p: Omit<Purchase, "id">) => void;
  removePurchase: (id: string) => void;
  toggleInstallmentPaid: (id: string) => void;

  // Card payment status (manual override + auto)
  setCardPaid: (cardId: string, year: number, month: number, paid: boolean) => void;
  isCardFullyPaid: (cardId: string, year: number, month: number) => boolean;

  // Debits
  addDebit: (d: Omit<Debit, "id" | "paid">) => void;
  toggleDebitPaid: (id: string) => void;
  removeDebit: (id: string) => void;

  // Incomes
  addIncome: (i: Omit<Income, "id" | "received">) => void;
  toggleIncomeReceived: (id: string) => void;
  removeIncome: (id: string) => void;

  // Wallet
  setWallet: (amount: number) => void;

  // Investments
  addInvestment: (i: Omit<Investment, "id">) => void;
  removeInvestment: (id: string) => void;

  // Selectors
  getMonthInstallments: (year: number, month: number) => Installment[];
  getMonthDebits: (year: number, month: number) => Debit[];
  getMonthIncomes: (year: number, month: number) => Income[];
  getCardMonthInstallments: (cardId: string, year: number, month: number) => Installment[];
};

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

const round2 = (n: number) => Math.round(n * 100) / 100;

function generateInstallments(purchase: Purchase): Installment[] {
  const count = Math.max(1, purchase.installmentsCount);
  const base = round2(purchase.totalAmount / count);
  // Adjust last installment to absorb rounding
  const items: Installment[] = [];
  const start = new Date(purchase.date);
  let accum = 0;
  for (let i = 0; i < count; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const amount = i === count - 1 ? round2(purchase.totalAmount - accum) : base;
    accum += amount;
    items.push({
      id: uid(),
      purchaseId: purchase.id,
      number: i + 1,
      total: count,
      amount,
      year: d.getFullYear(),
      month: d.getMonth(),
      paid: false,
    });
  }
  return items;
}

const DEFAULT_CARDS: Card[] = [
  { id: uid(), name: "Cartão Principal", color: "#8b5cf6", closingDay: 25, dueDay: 5 },
];

export const useFinance = create<State>()(
  persist(
    (set, get) => ({
      cards: DEFAULT_CARDS,
      purchases: [],
      installments: [],
      debits: [],
      incomes: [],
      investments: [],
      walletAmount: 0,
      cardPayments: {},

      addCard: (c) => set((s) => ({ cards: [...s.cards, { ...c, id: uid() }] })),
      removeCard: (id) =>
        set((s) => ({
          cards: s.cards.filter((c) => c.id !== id),
          purchases: s.purchases.filter((p) => p.cardId !== id),
          installments: s.installments.filter(
            (i) => !s.purchases.find((p) => p.id === i.purchaseId && p.cardId === id),
          ),
        })),

      addPurchase: (p) => {
        const purchase: Purchase = { ...p, id: uid() };
        const inst = generateInstallments(purchase);
        set((s) => ({
          purchases: [...s.purchases, purchase],
          installments: [...s.installments, ...inst],
        }));
      },

      removePurchase: (id) =>
        set((s) => ({
          purchases: s.purchases.filter((p) => p.id !== id),
          installments: s.installments.filter((i) => i.purchaseId !== id),
        })),

      toggleInstallmentPaid: (id) => {
        set((s) => {
          const installments = s.installments.map((i) =>
            i.id === id ? { ...i, paid: !i.paid } : i,
          );
          // Auto-update card payment status
          const target = installments.find((i) => i.id === id);
          const cardPayments = { ...s.cardPayments };
          if (target) {
            const purchase = s.purchases.find((p) => p.id === target.purchaseId);
            if (purchase) {
              const cardId = purchase.cardId;
              const monthInst = installments.filter((i) => {
                const pur = s.purchases.find((p) => p.id === i.purchaseId);
                return (
                  pur?.cardId === cardId &&
                  i.year === target.year &&
                  i.month === target.month
                );
              });
              const allPaid = monthInst.length > 0 && monthInst.every((i) => i.paid);
              const key = `${cardId}-${target.year}-${target.month}`;
              cardPayments[key] = allPaid;
            }
          }
          return { installments, cardPayments };
        });
      },

      setCardPaid: (cardId, year, month, paid) => {
        set((s) => {
          const key = `${cardId}-${year}-${month}`;
          const installments = s.installments.map((i) => {
            const pur = s.purchases.find((p) => p.id === i.purchaseId);
            if (pur?.cardId === cardId && i.year === year && i.month === month) {
              return { ...i, paid };
            }
            return i;
          });
          return {
            installments,
            cardPayments: { ...s.cardPayments, [key]: paid },
          };
        });
      },

      isCardFullyPaid: (cardId, year, month) => {
        const s = get();
        const key = `${cardId}-${year}-${month}`;
        const monthInst = s.installments.filter((i) => {
          const pur = s.purchases.find((p) => p.id === i.purchaseId);
          return pur?.cardId === cardId && i.year === year && i.month === month;
        });
        if (monthInst.length === 0) return s.cardPayments[key] ?? false;
        return monthInst.every((i) => i.paid);
      },

      addDebit: (d) =>
        set((s) => ({ debits: [...s.debits, { ...d, id: uid(), paid: false }] })),
      toggleDebitPaid: (id) =>
        set((s) => ({
          debits: s.debits.map((d) => (d.id === id ? { ...d, paid: !d.paid } : d)),
        })),
      removeDebit: (id) => set((s) => ({ debits: s.debits.filter((d) => d.id !== id) })),

      addIncome: (i) =>
        set((s) => ({ incomes: [...s.incomes, { ...i, id: uid(), received: false }] })),
      toggleIncomeReceived: (id) =>
        set((s) => ({
          incomes: s.incomes.map((i) =>
            i.id === id ? { ...i, received: !i.received } : i,
          ),
        })),
      removeIncome: (id) =>
        set((s) => ({ incomes: s.incomes.filter((i) => i.id !== id) })),

      setWallet: (amount) => set({ walletAmount: amount }),

      addInvestment: (i) =>
        set((s) => ({ investments: [...s.investments, { ...i, id: uid() }] })),
      removeInvestment: (id) =>
        set((s) => ({ investments: s.investments.filter((i) => i.id !== id) })),

      getMonthInstallments: (year, month) =>
        get().installments.filter((i) => i.year === year && i.month === month),
      getMonthDebits: (year, month) =>
        get().debits.filter((d) => {
          const dt = new Date(d.date);
          return dt.getFullYear() === year && dt.getMonth() === month;
        }),
      getMonthIncomes: (year, month) =>
        get().incomes.filter((i) => {
          const dt = new Date(i.date);
          return dt.getFullYear() === year && dt.getMonth() === month;
        }),
      getCardMonthInstallments: (cardId, year, month) => {
        const s = get();
        return s.installments.filter((i) => {
          const pur = s.purchases.find((p) => p.id === i.purchaseId);
          return pur?.cardId === cardId && i.year === year && i.month === month;
        });
      },
    }),
    {
      name: "finance-app-v1",
    },
  ),
);
