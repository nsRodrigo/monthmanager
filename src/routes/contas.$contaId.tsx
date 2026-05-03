import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
  getMonthInvestments,
} from "@/store/finance";
import { useAccountFilter } from "@/store/account-filter";
import { formatCurrency, MONTHS } from "@/lib/format";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
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

  // Build map year -> Set<month> of months with ANY value for this account
  const yearMonthMap = useMemo(() => {
    const map = new Map<number, Set<number>>();
    const add = (y: number, m: number) => {
      if (!map.has(y)) map.set(y, new Set());
      map.get(y)!.add(m);
    };
    const accPurchaseIds = new Set(
      purchases.filter((p) => accountCardIds.has(p.cardId)).map((p) => p.id),
    );
    for (const i of installments) {
      if (i.parentType === "purchase") {
        if (accPurchaseIds.has(i.parentId)) add(i.year, i.month);
      } else if (i.parentType === "debit") {
        const d = debits.find((x) => x.id === i.parentId);
        if (d?.accountId === contaId) add(i.year, i.month);
      } else if (i.parentType === "income") {
        const inc = incomes.find((x) => x.id === i.parentId);
        if (inc?.accountId === contaId) add(i.year, i.month);
      }
    }
    for (const d of debits) {
      if (d.accountId !== contaId || d.isParent || !d.date) continue;
      const [y, m] = d.date.slice(0, 10).split("-").map(Number);
      if (y && m) add(y, m - 1);
    }
    for (const inc of incomes) {
      if (inc.accountId !== contaId || inc.isParent || !inc.date) continue;
      const [y, m] = inc.date.slice(0, 10).split("-").map(Number);
      if (y && m) add(y, m - 1);
    }
    for (const inv of investments) {
      if (inv.accountId !== contaId || !inv.date) continue;
      const [y, m] = inv.date.slice(0, 10).split("-").map(Number);
      if (y && m) add(y, m - 1);
    }
    return map;
  }, [accountCardIds, purchases, installments, debits, incomes, investments, contaId]);

  const yearList = useMemo(() => {
    const ys = Array.from(yearMonthMap.keys()).sort((a, b) => a - b);
    return ys.length > 0 ? ys : [new Date().getFullYear()];
  }, [yearMonthMap]);

  const monthsForYear = useMemo(() => {
    const set = yearMonthMap.get(year);
    return set ? Array.from(set).sort((a, b) => a - b) : [];
  }, [yearMonthMap, year]);

  const [openYear, setOpenYear] = useState(false);

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
  const monthInvested = getMonthInvestments(accountInvestments, today.getFullYear(), currentMonth)
    .reduce((s, i) => s + i.amount, 0);

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
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 sm:gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
            style={{ backgroundColor: account.color + "30", color: account.color }}
          >
            <Wallet className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {account.type}
            </p>
            <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl md:text-3xl">
              {account.name}
            </h1>
          </div>
          <div className="text-right">
            <p
              className={`whitespace-nowrap text-sm font-bold sm:text-base ${
                balance >= 0 ? "text-foreground" : "text-destructive"
              }`}
            >
              {formatCurrency(balance)}
            </p>
            <p className="text-[10px] text-muted-foreground">saldo atual</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5 border-t border-border/60 pt-4 lg:grid-cols-4">
          <MiniStat label="A receber" value={cm.income} tone="success" />
          <MiniStat label="A pagar" value={cm.debits} tone="debit" />
          <MiniStat label="Faturas" value={cm.cardsTotal} tone="credit" />
          <MiniStat label="Previsto" value={expectedEnd} tone={expectedEnd >= 0 ? "success" : "debit"} />
        </div>
        {monthInvested > 0 && (
          <p className="mt-3 text-[11px] text-muted-foreground">
            Investido: <span className="font-semibold text-primary">{formatCurrency(monthInvested)}</span>
          </p>
        )}
      </header>

      {/* YEAR PICKER */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Meses de {year}</h2>
        <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
          <button
            type="button"
            onClick={() => {
              const idx = yearList.indexOf(year);
              if (idx > 0) setYear(yearList[idx - 1]);
              else setYear(yearList[0] - 1);
            }}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Ano anterior"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <Popover open={openYear} onOpenChange={setOpenYear}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="cursor-pointer rounded-md bg-transparent px-2 py-0.5 text-sm font-semibold outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Selecionar ano"
              >
                {year}
              </button>
            </PopoverTrigger>
            <PopoverContent align="center" className="w-28 p-1">
              <ul className="max-h-64 overflow-y-auto">
                {(yearList.includes(year) ? yearList : [...yearList, year].sort((a, b) => a - b)).map((y) => (
                  <li key={y}>
                    <button
                      type="button"
                      onClick={() => {
                        setYear(y);
                        setOpenYear(false);
                      }}
                      className={cn(
                        "w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary",
                        y === year && "bg-secondary font-semibold",
                      )}
                    >
                      {y}
                    </button>
                  </li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>
          <button
            type="button"
            onClick={() => {
              const idx = yearList.indexOf(year);
              if (idx >= 0 && idx < yearList.length - 1) setYear(yearList[idx + 1]);
              else setYear(yearList[yearList.length - 1] + 1);
            }}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Próximo ano"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>


      {/* MONTHS LIST — only months that have any value */}
      <div className="mt-4 space-y-2">
        {monthsForYear.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
            Nenhum lançamento em {year}.
          </p>
        ) : (
          monthsForYear.map((m) => {
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
              className={`group flex flex-col gap-2 rounded-2xl border bg-card p-3 transition-all hover:border-primary/40 hover:shadow-glow xl:flex-row xl:items-center xl:gap-4 xl:p-4 ${
                isCurrent ? "border-primary/50 shadow-glow" : "border-border"
              }`}
            >
              {/* Header: número + nome do mês + balanço (mobile) / linha completa (desktop) */}
              <div className="flex items-center gap-3 xl:gap-4">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold xl:h-12 xl:w-12 ${
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
              </div>

              {/* Valores: abaixo no mobile, ao lado no desktop */}
              <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-2 xl:ml-auto xl:border-t-0 xl:pt-0">
                <div className="flex flex-1 gap-3 xl:flex-none">
                  <Mini label="Receb." value={sum.income} tone="success" />
                  <Mini label="Débitos" value={sum.debits} tone="debit" />
                  <Mini label="Faturas" value={sum.cardsTotal} tone="credit" />
                </div>
                <div className="min-w-0 text-right">
                  <p
                    className={`truncate text-xs font-bold xl:text-sm ${
                      monthBalance >= 0 ? "text-success" : "text-destructive"
                    }`}
                  >
                    {formatCurrency(monthBalance)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">balanço</p>
                </div>
                <ChevronRight className="hidden h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary xl:block" />
              </div>
            </Link>
            );
          })
        )}
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

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "debit" | "credit";
}) {
  const c = tone === "success" ? "text-success" : tone === "debit" ? "text-debit" : "text-credit";
  return (
    <div className="min-w-0 rounded-xl bg-background/40 px-3 py-2">
      <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`truncate text-sm font-bold ${c}`}>{formatCurrency(value)}</p>
    </div>
  );
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
