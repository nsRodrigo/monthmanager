import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import {
  useAccounts,
  useCards,
  usePurchases,
  useInstallments,
  useDebits,
  useIncomes,
  useInvestments,
  computeAccountBalance,
  getMonthInstallments,
  getMonthDebits,
  getMonthIncomes,
} from "@/store/finance";
import { useAccountFilter } from "@/store/account-filter";
import { formatCurrency, MONTHS } from "@/lib/format";
import {
  ArrowDownRight,
  ArrowUpRight,
  CreditCard,
  TrendingUp,
  ChevronRight,
  Wallet,
  ChevronLeft,
} from "lucide-react";

export const Route = createFileRoute("/contas/$contaId")({
  head: () => ({ meta: [{ title: "Conta — Finanças" }] }),
  component: AccountHome,
});

function AccountHome() {
  const { contaId } = Route.useParams();
  const { data: accounts = [] } = useAccounts();
  const { data: cards = [] } = useCards();
  const { data: purchases = [] } = usePurchases();
  const { data: installments = [] } = useInstallments();
  const { data: debits = [] } = useDebits();
  const { data: incomes = [] } = useIncomes();
  const { data: investments = [] } = useInvestments();

  const account = accounts.find((a) => a.id === contaId);
  const { setAccountId } = useAccountFilter();

  // Sync the global account filter with the URL — so dialogs ("New card", "New debit"…)
  // pick the right account automatically, and rules stay 100% intact.
  useEffect(() => {
    if (account) setAccountId(account.id);
  }, [account, setAccountId]);

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const currentMonth = today.getMonth();

  const accountCardIds = useMemo(
    () => new Set(cards.filter((c) => c.accountId === contaId).map((c) => c.id)),
    [cards, contaId],
  );
  const accountCards = useMemo(
    () => cards.filter((c) => c.accountId === contaId),
    [cards, contaId],
  );
  const accountDebits = useMemo(
    () => debits.filter((d) => d.accountId === contaId),
    [debits, contaId],
  );
  const accountIncomes = useMemo(
    () => incomes.filter((i) => i.accountId === contaId),
    [incomes, contaId],
  );
  const accountInvestments = useMemo(
    () => investments.filter((i) => i.accountId === contaId),
    [investments, contaId],
  );

  if (!account) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-12 text-center">
        <p className="text-muted-foreground">Conta não encontrada.</p>
        <Link to="/" className="mt-4 inline-block text-sm text-primary hover:underline">
          ← Voltar para o consolidado
        </Link>
      </div>
    );
  }


  const balance = computeAccountBalance(account, cards, purchases, installments, debits, incomes);
  const totalInvested = accountInvestments.reduce((s, i) => s + i.amount, 0);

  // current month numbers (for the top dashboard)
  const cm = currentMonthSummary(
    today.getFullYear(),
    currentMonth,
    accountCardIds,
    accountCards,
    accountDebits,
    accountIncomes,
    purchases,
    installments,
  );

  const expectedEnd =
    balance + cm.income - cm.debits - cm.cardsTotal;

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 md:py-12">
      <Link
        to="/"
        className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Consolidado
      </Link>

      {/* HEADER + DASHBOARD */}
      <header className="overflow-hidden rounded-3xl border border-border bg-gradient-card p-4 shadow-elegant sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3 sm:gap-4 sm:flex-1 min-w-0">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
              style={{ backgroundColor: account.color + "30", color: account.color }}
            >
              <Wallet className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Conta
              </p>
              <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl md:text-3xl">
                {account.name}
              </h1>
            </div>
          </div>
          <div className="sm:text-right">
            <p className="text-xs text-muted-foreground">Saldo atual</p>
            <p
              className={`break-words text-2xl font-bold sm:text-2xl md:text-3xl ${
                balance >= 0 ? "text-foreground" : "text-destructive"
              }`}
            >
              {formatCurrency(balance)}
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-5">
          <Stat label="Recebimentos do mês" value={formatCurrency(cm.income)} tone="success" icon={ArrowUpRight} />
          <Stat label="Débitos do mês" value={formatCurrency(cm.debits)} tone="debit" icon={ArrowDownRight} />
          <Stat label="Faturas do mês" value={formatCurrency(cm.cardsTotal)} tone="credit" icon={CreditCard} />
          <Stat label="Investido" value={formatCurrency(totalInvested)} tone="primary" icon={TrendingUp} />
          <Stat
            label="Saldo previsto"
            value={formatCurrency(expectedEnd)}
            tone={expectedEnd >= 0 ? "success" : "debit"}
            icon={Wallet}
          />
        </div>
      </header>

      {/* YEAR PICKER */}
      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Meses de {year}</h2>
        <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
          <button
            onClick={() => setYear((y) => y - 1)}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Ano anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-2 text-sm font-semibold">{year}</span>
          <button
            onClick={() => setYear((y) => y + 1)}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Próximo ano"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* MONTHS LIST */}
      <div className="mt-4 space-y-2">
        {Array.from({ length: 12 }, (_, m) => m).map((m) => {
          const sum = currentMonthSummary(
            year,
            m,
            accountCardIds,
            accountCards,
            accountDebits,
            accountIncomes,
            purchases,
            installments,
          );
          const movement = sum.income + sum.debits + sum.cardsTotal;
          const monthBalance = sum.income - sum.debits - sum.cardsTotal;
          const isCurrent = year === today.getFullYear() && m === currentMonth;
          const isFuture = year > today.getFullYear() || (year === today.getFullYear() && m > currentMonth);
          return (
            <Link
              key={m}
              to="/contas/$contaId/$ano/$mes"
              params={{ contaId: account.id, ano: String(year), mes: String(m) }}
              className={`group flex items-center gap-3 rounded-2xl border bg-card p-3 transition-all hover:border-primary/40 hover:shadow-glow sm:gap-4 sm:p-4 ${
                isCurrent ? "border-primary/50 shadow-glow" : "border-border"
              }`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold sm:h-12 sm:w-12 ${
                  isCurrent
                    ? "bg-gradient-primary text-primary-foreground"
                    : isFuture
                      ? "bg-secondary/50 text-muted-foreground"
                      : "bg-secondary text-foreground"
                }`}
              >
                {String(m + 1).padStart(2, "0")}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold">{MONTHS[m]}</p>
                  {isCurrent && (
                    <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                      Atual
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  Movimentado: {formatCurrency(movement)}
                </p>
              </div>
              <div className="hidden gap-3 md:flex">
                <Mini label="Receb." value={sum.income} tone="success" />
                <Mini label="Débitos" value={sum.debits} tone="debit" />
                <Mini label="Faturas" value={sum.cardsTotal} tone="credit" />
              </div>
              <div className="min-w-0 text-right">
                <p
                  className={`truncate text-xs font-bold sm:text-sm ${
                    monthBalance >= 0 ? "text-success" : "text-destructive"
                  }`}
                >
                  {formatCurrency(monthBalance)}
                </p>
                <p className="text-[10px] text-muted-foreground">balanço</p>
              </div>
              <ChevronRight className="hidden h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary sm:block" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ───────── helpers ───────── */

function currentMonthSummary(
  year: number,
  month: number,
  accountCardIds: Set<string>,
  accountCards: any[],
  accountDebits: any[],
  accountIncomes: any[],
  purchases: any[],
  installments: any[],
) {
  const inst = getMonthInstallments(installments, year, month);
  const visiblePurchaseIds = new Set(
    purchases.filter((p) => accountCardIds.has(p.cardId)).map((p) => p.id),
  );
  const cardInst = inst.filter(
    (i) => i.parentType === "purchase" && visiblePurchaseIds.has(i.parentId),
  );
  const cardsTotal = cardInst.reduce((s, i) => s + i.amount, 0);

  const md = getMonthDebits(accountDebits, installments, year, month);
  const mi = getMonthIncomes(accountIncomes, installments, year, month);
  const debits =
    md.single.reduce((s, d) => s + d.amount, 0) +
    md.parcelled.reduce((s, p) => s + p.installment.amount, 0);
  const income =
    mi.single.reduce((s, i) => s + i.amount, 0) +
    mi.parcelled.reduce((s, p) => s + p.installment.amount, 0);

  return { cardsTotal, debits, income, cardsCount: accountCards.length };
}

function Stat({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  tone: "success" | "debit" | "credit" | "primary";
  icon: typeof Wallet;
}) {
  const colors = {
    success: "text-success",
    debit: "text-debit",
    credit: "text-credit",
    primary: "text-primary",
  } as const;
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <p className={`mt-1 text-base font-bold ${colors[tone]}`}>{value}</p>
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: number; tone: "success" | "debit" | "credit" }) {
  const c = tone === "success" ? "text-success" : tone === "debit" ? "text-debit" : "text-credit";
  return (
    <div className="text-right">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-xs font-semibold ${c}`}>{formatCurrency(value)}</p>
    </div>
  );
}
