import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useAccounts,
  useCards,
  usePurchases,
  useInstallments,
  useDebits,
  useIncomes,
  useInvestments,
  computeAccountBalanceUntilNow,
  getMonthInstallments,
  getMonthDebits,
  getMonthIncomes,
  getMonthInvestments,
  getEffectiveCurrentMonth,
  normalizeZero,
  isCardVisibleInMonth,
} from "@/store/finance";
import { useAccountFilter } from "@/store/account-filter";
import { formatCurrency, MONTHS } from "@/lib/format";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  Wallet,
  ChevronLeft,
  Plus,
  ArrowLeftRight,
} from "lucide-react";
import { AddMonthDialog } from "@/components/AddMonthDialog";
import { ReorganizeDataDialog } from "@/components/ReorganizeDataDialog";

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
  const eff = getEffectiveCurrentMonth(today);
  const yearStorageKey = `selected-year-${contaId}`;
  const [year, setYear] = useState<number>(() => {
    if (typeof window === "undefined") return eff.year;
    const stored = sessionStorage.getItem(yearStorageKey);
    return stored ? parseInt(stored, 10) : eff.year;
  });
  const currentMonth = eff.month;

  const accountCardIds = useMemo(
    () => new Set(cards.filter((c) => c.accountId === contaId).map((c) => c.id)),
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
  const [openAddMonth, setOpenAddMonth] = useState(false);
  const [openReorganize, setOpenReorganize] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);
  const [headerOut, setHeaderOut] = useState(false);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setHeaderOut(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-60px 0px 0px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const monthlyBalances = useMemo(() => {
    if (!account) return new Map<string, number>();
    const allMonths = Array.from(yearMonthMap.entries())
      .flatMap(([y, months]) => Array.from(months).map((m) => ({ y, m })))
      .sort((a, b) => a.y !== b.y ? a.y - b.y : a.m - b.m);

    const accDebits = debits.filter((d) => d.accountId === account.id);
    const accIncomes = incomes.filter((i) => i.accountId === account.id);
    const accInvestments = investments.filter((i) => i.accountId === account.id);

    const map = new Map<string, number>();
    let running = account.initialBalance;
    for (const { y, m } of allMonths) {
      const vCards = cards.filter((c) => c.accountId === account.id && isCardVisibleInMonth(c, y, m));
      const vCardIds = new Set(vCards.map((c) => c.id));
      const s = currentMonthSummary(y, m, vCardIds, vCards, accDebits, accIncomes, purchases, installments);
      const mDebits = getMonthDebits(accDebits, installments, y, m);
      const tDebits =
        mDebits.single.reduce((acc, d) => acc + d.amount, 0) +
        mDebits.parcelled.reduce((acc, p) => acc + p.installment.amount, 0);
      const inv = getMonthInvestments(accInvestments, y, m).reduce((acc, i) => acc + i.amount, 0);
      running = running + s.income - tDebits - s.cardsTotal - inv;
      map.set(`${y}-${m}`, Math.round(running * 100) / 100);
    }
    return map;
  }, [account, cards, purchases, installments, debits, incomes, investments, yearMonthMap]);

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


  const balance = normalizeZero(
    computeAccountBalanceUntilNow(account, cards, purchases, installments, debits, incomes, investments, today),
  );

  const canPrevYear = yearList.length > 0 && yearList.indexOf(year) > 0;
  const canNextYear =
    yearList.length > 0 && yearList.indexOf(year) >= 0 && yearList.indexOf(year) < yearList.length - 1;
  const goPrevYear = () => {
    if (!canPrevYear) return;
    const idx = yearList.indexOf(year);
    const next = yearList[idx - 1];
    setYear(next);
    sessionStorage.setItem(yearStorageKey, String(next));
  };
  const goNextYear = () => {
    if (!canNextYear) return;
    const idx = yearList.indexOf(year);
    const next = yearList[idx + 1];
    setYear(next);
    sessionStorage.setItem(yearStorageKey, String(next));
  };

  const YearPickerChip = ({ compact = false }: { compact?: boolean }) => (
    <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
      <button
        type="button"
        onClick={goPrevYear}
        disabled={!canPrevYear}
        className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
        aria-label="Ano anterior"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </button>
      <Popover open={openYear} onOpenChange={setOpenYear}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "cursor-pointer rounded-md bg-transparent px-2 py-0.5 font-semibold outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring",
              compact ? "text-xs" : "text-sm",
            )}
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
                    sessionStorage.setItem(yearStorageKey, String(y));
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
        onClick={goNextYear}
        disabled={!canNextYear}
        className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
        aria-label="Próximo ano"
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-10">
      {/* Sticky top bar — breadcrumb + year picker */}
      <div className="sticky top-0 z-30 -mx-4 mb-5 flex items-center justify-between gap-2 border-b border-border/60 bg-background/85 px-4 py-3 backdrop-blur-md md:-mx-6 md:px-6" data-stuck={headerOut}>
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground shrink-0 min-w-0"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" />
          <span className="truncate">Consolidado</span>
        </Link>
        <YearPickerChip compact />
      </div>

      {/* HEADER + DASHBOARD */}
      <header ref={headerRef} className="overflow-hidden rounded-3xl border border-border bg-gradient-card p-4 shadow-elegant sm:p-6">
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
            <h1 className="break-words text-xl font-bold tracking-tight sm:text-2xl md:text-3xl">
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

        <div className="mt-3 flex justify-end border-t border-border/40 pt-3">
          <button
            type="button"
            onClick={() => setOpenReorganize(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/50 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            Reorganizar dados
          </button>
        </div>

      </header>




      {/* MONTHS LIST — only months that have any value */}
      <div className="mt-4 space-y-2">
        {monthsForYear.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum lançamento em {year}.
            </p>
            <button
              type="button"
              onClick={() => setOpenAddMonth(true)}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Adicionar mês
            </button>
            <p className="text-[11px] text-muted-foreground">
              Comece adicionando o mês atual para lançar recebimentos, débitos, investimentos e cartões.
            </p>
          </div>
        ) : (
          monthsForYear.map((m) => {
            const visibleCards = cards.filter(
              (c) => c.accountId === contaId && isCardVisibleInMonth(c, year, m)
            );
            const visibleCardIds = new Set(visibleCards.map((c) => c.id));
            const sum = currentMonthSummary(
              year, m,
              visibleCardIds,
              visibleCards,
              accountDebits,
              accountIncomes,
              purchases,
              installments,
            );
            const monthInv = getMonthInvestments(accountInvestments, year, m).reduce((s, i) => s + i.amount, 0);
            const md = getMonthDebits(accountDebits, installments, year, m);
            const totalDebits = normalizeZero(md.single.reduce((s, d) => s + d.amount, 0) + md.parcelled.reduce((s, p) => s + p.installment.amount, 0));
            const totalIncome = normalizeZero(sum.income);
            const totalFaturas = normalizeZero(sum.cardsTotal);
            const saldoConta = normalizeZero(monthlyBalances.get(`${year}-${m}`) ?? 0);
            const isCurrent = year === eff.year && m === currentMonth;
            const isFuture = year > eff.year || (year === eff.year && m > currentMonth);


            return (
            <Link
              key={m}
              to="/contas/$contaId/$ano/$mes"
              params={{ contaId: account.id, ano: String(year), mes: String(m) }}
              className={`group block rounded-3xl border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-glow sm:p-5 ${
                isCurrent ? "border-primary/50 shadow-glow" : "border-border"
              }`}
            >
              {/* Mobile: stacked. Desktop (sm+): name+balanço left, saldo em conta right */}
              <div className="flex items-center gap-3 sm:gap-4">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-bold ${
                  isCurrent
                    ? "bg-gradient-primary text-primary-foreground"
                    : isFuture
                      ? "bg-secondary/50 text-muted-foreground"
                      : "bg-secondary text-foreground"
                }`}>
                  {String(m + 1).padStart(2, "0")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate text-lg font-bold">{MONTHS[m]}</p>
                    {isCurrent && <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">Atual</span>}
                  </div>
                  <p className={`mt-0.5 truncate text-xs font-semibold ${totalIncome >= 0 ? "text-success" : "text-destructive"}`}>
                    RECEBÍVEIS: {formatCurrency(totalIncome)}
                  </p>
                </div>
                <div className="hidden text-right sm:block">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Saldo em conta</p>
                  <p
                    className={`whitespace-nowrap text-lg font-bold ${
                      saldoConta >= 0 ? "text-foreground" : "text-destructive"
                    }`}
                  >
                    {formatCurrency(saldoConta)}
                  </p>
                </div>
              </div>

              {/* Saldo em conta — mobile only, in its own row */}
              <div className="mt-3 flex items-baseline justify-between gap-2 border-t border-border/60 pt-3 sm:hidden">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Saldo em conta</p>
                <p
                  className={`whitespace-nowrap text-base font-bold ${
                    saldoConta >= 0 ? "text-foreground" : "text-destructive"
                  }`}
                >
                  {formatCurrency(saldoConta)}
                </p>
              </div>

              <div className="mt-3 grid grid-cols-3 divide-x divide-border border-t border-border/60 pt-3 sm:mt-4">
                <Mini label="Débitos" value={totalDebits} tone="debit" />
                <Mini label="Faturas" value={totalFaturas} tone="credit" />
                <Mini label="Investimentos" value={monthInv} tone="debit" />
              </div>
            </Link>
            );
          })
        )}
        {monthsForYear.length > 0 && (
          <button
            type="button"
            onClick={() => setOpenAddMonth(true)}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border bg-card/40 px-3 py-3 text-sm font-semibold text-primary transition-colors hover:bg-secondary"
          >
            <Plus className="h-4 w-4" /> Adicionar mês
          </button>
        )}
      </div>

      <AddMonthDialog
        open={openAddMonth}
        onClose={() => setOpenAddMonth(false)}
        contaId={account.id}
      />
      <ReorganizeDataDialog
        open={openReorganize}
        onClose={() => setOpenReorganize(false)}
        contaId={contaId}
        yearList={yearList}
      />
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



function Mini({ label, value, tone }: { label: string; value: number; tone: "success" | "debit" | "credit" }) {
  const c = tone === "success" ? "text-success" : tone === "debit" ? "text-debit" : "text-credit";
  return (
    <div className="min-w-0 px-2 text-left first:pl-0 last:pr-0 sm:px-3">
      <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`truncate text-xs font-semibold sm:text-sm ${c}`}>{formatCurrency(value)}</p>
    </div>
  );
}

