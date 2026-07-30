import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, Fragment } from "react";
import {
  useAccounts,
  useCards,
  usePurchases,
  useInstallments,
  useDebits,
  useIncomes,
  useInvestments,
  computeAccountBalanceUntilNow,
  computeAccountBalanceAtMonth,
  getMonthInstallments,
  getMonthDebits,
  getMonthIncomes,
  getMonthInvestments,
  getEffectiveCurrentMonth,
  normalizeZero,
  isCardVisibleInMonth,
  type Account,
} from "@/store/finance";
import { useAccountFilter } from "@/store/account-filter";
import { formatCurrency, MONTHS } from "@/lib/format";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sparkline } from "@/components/Sparkline";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  Wallet,
  ChevronLeft,
  Plus,
  ArrowLeftRight,
  ArrowDownRight,
  CreditCard,
  TrendingUp,
  X,
} from "lucide-react";
import { AddMonthDialog } from "@/components/AddMonthDialog";
import { ReorganizeDataDialog } from "@/components/ReorganizeDataDialog";
import { MonthDetailPane } from "./contas.$contaId_.$ano.$mes";

export const Route = createFileRoute("/contas/$contaId")({
  head: () => ({ meta: [{ title: "Conta — Finanças" }] }),
  component: PanesWorkspace,
});

/**
 * Gerencia os painéis de contas abertos em paralelo lado a lado — só em
 * desktop/tablet (>= 768px). No mobile é sempre 1 painel só, igual a uma
 * conta por vez de sempre; o "+" pra abrir outro painel some sozinho porque
 * `maxPanes` vira 1. Clicar numa conta abre um painel; clicar em "+" na tira
 * de abas abre outro ao lado, sem fechar os existentes.
 */
function PanesWorkspace() {
  const { contaId } = Route.useParams();
  const { data: accounts = [] } = useAccounts();
  const [paneIds, setPaneIds] = useState<string[]>([contaId]);
  const [sizes, setSizes] = useState<number[]>([1]);
  const [maxPanes, setMaxPanes] = useState(3);

  // Reabre do zero quando a URL muda pra uma conta diferente (navegação normal).
  useEffect(() => {
    setPaneIds([contaId]);
    setSizes([1]);
  }, [contaId]);

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      setMaxPanes(w < 768 ? 1 : w >= 1280 ? 3 : 2);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    setPaneIds((ids) => (ids.length > maxPanes ? ids.slice(0, maxPanes) : ids));
  }, [maxPanes]);

  useEffect(() => {
    setSizes((s) => (s.length === paneIds.length ? s : paneIds.map(() => 1)));
  }, [paneIds]);

  const addPane = (id: string) => {
    setPaneIds((ids) => (ids.includes(id) || ids.length >= maxPanes ? ids : [...ids, id]));
  };
  const closePane = (id: string) => {
    setPaneIds((ids) => (ids.length <= 1 ? ids : ids.filter((x) => x !== id)));
  };
  const resizeAt = (index: number, deltaFraction: number) => {
    setSizes((prev) => {
      const total = prev.reduce((s, v) => s + v, 0);
      const a = prev[index] + deltaFraction * total;
      const b = prev[index + 1] - deltaFraction * total;
      const min = total * 0.18;
      if (a < min || b < min) return prev;
      const next = [...prev];
      next[index] = a;
      next[index + 1] = b;
      return next;
    });
  };

  const availableToAdd = accounts.filter((a) => !paneIds.includes(a.id));

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <PaneTabs
        accounts={accounts}
        paneIds={paneIds}
        availableToAdd={availableToAdd}
        canAdd={paneIds.length < maxPanes && availableToAdd.length > 0}
        onClose={closePane}
        onAdd={addPane}
      />
      <div className="flex min-h-0 flex-1 flex-row">
        {paneIds.map((id, i) => (
          <Fragment key={id}>
            {/* `relative` + `overflow-y-auto` própria de cada painel: rola sozinho
                (não a página inteira), e é a âncora do FAB "absolute" do painel
                (embedded=true em AccountPane) — sem isso o FAB usaria `fixed` e
                apareceria só 1x, por cima de tudo, na tela toda. */}
            <div
              style={{ flexGrow: sizes[i] ?? 1, flexBasis: 0 }}
              className="relative min-w-0 min-h-0 overflow-y-auto"
            >
              <AccountPane contaId={id} />
            </div>
            {i < paneIds.length - 1 && (
              <PaneDivider onDrag={(delta) => resizeAt(i, delta)} />
            )}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function PaneTabs({
  accounts,
  paneIds,
  availableToAdd,
  canAdd,
  onClose,
  onAdd,
}: {
  accounts: Account[];
  paneIds: string[];
  availableToAdd: Account[];
  canAdd: boolean;
  onClose: (id: string) => void;
  onAdd: (id: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <div className="sticky top-0 z-30 flex flex-wrap items-center gap-2 border-b border-border/60 bg-background/85 px-4 py-2.5 backdrop-blur-md md:px-6">
      <Link to="/" className="mr-1 inline-flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Home
      </Link>
      {paneIds.map((id) => {
        const a = accounts.find((x) => x.id === id);
        if (!a) return null;
        return (
          <span
            key={id}
            className="inline-flex items-center gap-2 rounded-full border border-primary/50 bg-card px-3 py-1.5 text-xs font-semibold"
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: a.color }} aria-hidden="true" />
            <span className="truncate max-w-[10rem]">{a.name}</span>
            {paneIds.length > 1 && (
              <button
                type="button"
                onClick={() => onClose(id)}
                aria-label={`Fechar painel de ${a.name}`}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        );
      })}
      {canAdd && (
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Abrir outra conta ao lado"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-1.5">
            {availableToAdd.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  onAdd(a.id);
                  setPickerOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-secondary"
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: a.color }} aria-hidden="true" />
                <span className="truncate">{a.name}</span>
              </button>
            ))}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

/** Divisor arrastável entre painéis — só existe em desktop/tablet (mobile nunca tem mais de 1 painel). */
function PaneDivider({ onDrag }: { onDrag: (deltaFraction: number) => void }) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const lastPosRef = useRef(0);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    lastPosRef.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || !elRef.current?.parentElement) return;
    const pos = e.clientX;
    const delta = pos - lastPosRef.current;
    lastPosRef.current = pos;
    const rect = elRef.current.parentElement.getBoundingClientRect();
    if (rect.width > 0) onDrag(delta / rect.width);
  };
  const onPointerUp = () => {
    draggingRef.current = false;
  };

  return (
    <div
      ref={elRef}
      role="separator"
      aria-orientation="vertical"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="flex w-3 shrink-0 cursor-col-resize touch-none items-center justify-center bg-border text-muted-foreground hover:bg-primary/30"
    >
      <span className="select-none text-xs">⋮</span>
    </div>
  );
}

function AccountPane({ contaId }: { contaId: string }) {
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

  // Estado de navegação local do painel: lista de meses, ou um mês
  // específico "aberto" dentro do próprio painel (sem navegar a URL da
  // página inteira — o painel ao lado continua exatamente como estava).
  const [view, setView] = useState<{ type: "months" } | { type: "month"; year: number; month: number }>({
    type: "months",
  });

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

  // Tendência dos últimos 6 meses do saldo desta conta (mesma métrica e
  // componente usados no Home, aqui restritos a uma única conta).
  const trend = useMemo(() => {
    if (!account) return [];
    const points: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(eff.year, eff.month - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      points.push(
        normalizeZero(
          computeAccountBalanceAtMonth(account, cards, purchases, installments, debits, incomes, investments, y, m),
        ),
      );
    }
    return points;
  }, [account, cards, purchases, installments, debits, incomes, investments, eff.year, eff.month]);

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

        <Sparkline points={trend} className="mt-3" />

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




      {view.type === "month" ? (
        <div className="mt-4">
          <MonthDetailPane
            contaId={contaId}
            year={view.year}
            month={view.month}
            onBack={() => setView({ type: "months" })}
            onMonthChange={(y, m) => setView({ type: "month", year: y, month: m })}
            embedded
          />
        </div>
      ) : (
        <>
      <div className="mt-5 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-muted-foreground">Meses</p>
        <YearPickerChip compact />
      </div>

      {/* MONTHS LIST — only months that have any value */}
      <div className="mt-2 space-y-2">
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
            <button
              key={m}
              type="button"
              onClick={() => setView({ type: "month", year, month: m })}
              className={`group block w-full rounded-3xl border bg-card p-4 text-left transition-all hover:border-primary/40 hover:shadow-glow sm:p-5 ${
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

              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/60 pt-3 sm:mt-4">
                <Mini label="Débitos" value={totalDebits} tone="debit" icon={ArrowDownRight} />
                <Mini label="Faturas" value={totalFaturas} tone="credit" icon={CreditCard} />
                <Mini label="Invest." value={monthInv} tone="debit" icon={TrendingUp} />
              </div>
            </button>
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
      </>
      )}

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



const MINI_TONE_STYLES = {
  success: { text: "text-success", bg: "bg-success/10" },
  debit: { text: "text-debit", bg: "bg-debit/10" },
  credit: { text: "text-credit", bg: "bg-credit/10" },
} as const;

function Mini({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  tone: "success" | "debit" | "credit";
  icon: typeof Wallet;
}) {
  const s = MINI_TONE_STYLES[tone];
  return (
    <div className={`min-w-0 rounded-lg px-2 py-1.5 text-left ${s.bg}`}>
      <p className={`flex items-center gap-1 text-[10px] uppercase tracking-wider ${s.text}`}>
        <Icon className="h-2.5 w-2.5 shrink-0" /> <span className="truncate">{label}</span>
      </p>
      <p className={`truncate text-xs font-semibold sm:text-sm ${s.text}`}>{formatCurrency(value)}</p>
    </div>
  );
}

