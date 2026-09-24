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
  useCardPayments,
  computeAccountBalanceUntilNow,
  computeAccountBalanceAtMonth,
  getMonthInstallments,
  getMonthDebits,
  getMonthIncomes,
  sumMonthInvestments,
  getEffectiveCurrentMonth,
  normalizeZero,
} from "@/store/finance";
import { useAccountFilter } from "@/store/account-filter";
import { usePanes, useMaxPanes } from "@/store/panes";
import { useAuth } from "@/store/auth";
import { useProfile } from "@/store/profile";
import { formatCurrency, MONTHS, MONTHS_SHORT } from "@/lib/format";
import { Sparkline } from "@/components/Sparkline";
import { ManageAccountsDialog } from "@/components/ManageAccountsDialog";
import { PaneTabsBar } from "@/components/PaneTabsBar";
import { HeaderBand } from "@/components/HeaderBand";
import {
  BalanceTrendChart,
  FlowChart,
  SpendDonut,
  type DonutSlice,
} from "@/components/dashboard/charts";
import { APP_VERSION } from "@/lib/version";
import {
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  CreditCard,
  TrendingUp,
  ChevronRight,
  Wallet,
  Building2,
  Smartphone,
  User,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Home — Gestão Financeira" },
      { name: "description", content: "Visão consolidada de todas as suas contas." },
    ],
  }),
  component: Consolidated,
});

const ICON_BY_TYPE = {
  corrente: Building2,
  digital: Smartphone,
  carteira: Wallet,
  investimento: TrendingUp,
} as const;

/** Data local "YYYY-MM-DD" → Date (sem deslocamento de fuso). */
function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function daysUntil(date: Date, today: Date): string {
  const a = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const b = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const n = Math.round((a - b) / 86_400_000);
  if (n === 0) return "hoje";
  if (n === 1) return "amanhã";
  if (n < 0) return `há ${-n} ${n === -1 ? "dia" : "dias"}`;
  return `em ${n} dias`;
}

type Due = {
  key: string;
  date: Date;
  name: string;
  sub: string;
  amount: number;
  kind: "income" | "debit" | "card";
};

function Consolidated() {
  const [manageOpen, setManageOpen] = useState(false);
  const { data: accounts = [] } = useAccounts();
  const { data: cards = [] } = useCards();
  const { data: purchases = [] } = usePurchases();
  const { data: installments = [] } = useInstallments();
  const { data: debits = [] } = useDebits();
  const { data: incomes = [] } = useIncomes();
  const { data: investments = [] } = useInvestments();
  const { data: cardPayments = {} } = useCardPayments();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { panes } = usePanes();
  const maxPanes = useMaxPanes();

  // On the consolidated dashboard the global filter must be cleared,
  // so dialogs (new card / new debit) ask for the account explicitly.
  const { setAccountId } = useAccountFilter();
  useEffect(() => setAccountId(null), [setAccountId]);

  const today = new Date();
  const eff = getEffectiveCurrentMonth(today);
  const year = eff.year;
  const month = eff.month;

  /** Totais de um mês (todas as contas) — mesma regra do card principal de antes. */
  const monthTotals = (y: number, m: number) => {
    const inst = getMonthInstallments(installments, y, m).filter((i) => i.parentType === "purchase");
    const md = getMonthDebits(debits, installments, y, m);
    const mi = getMonthIncomes(incomes, installments, y, m);
    const sum = (n: number[]) => n.reduce((s, v) => s + v, 0);
    return {
      credit: sum(inst.map((i) => i.amount)),
      creditPaid: sum(inst.filter((i) => i.paid).map((i) => i.amount)),
      creditCount: inst.length,
      debit: sum(md.single.map((d) => d.amount)) + sum(md.parcelled.map((p) => p.installment.amount)),
      debitPaid:
        sum(md.single.filter((d) => d.paid).map((d) => d.amount)) +
        sum(md.parcelled.filter((p) => p.installment.paid).map((p) => p.installment.amount)),
      income: sum(mi.single.map((i) => i.amount)) + sum(mi.parcelled.map((p) => p.installment.amount)),
      incomePaid:
        sum(mi.single.filter((i) => i.received).map((i) => i.amount)) +
        sum(mi.parcelled.filter((p) => p.installment.paid).map((p) => p.installment.amount)),
      invest: sumMonthInvestments(investments, installments, y, m),
      md,
      mi,
      inst,
    };
  };

  const cur = monthTotals(year, month);
  const totalCredit = cur.credit;
  const totalDebits = cur.debit;
  const totalIncome = cur.income;
  const totalInvested = cur.invest;

  const accountBalance = accounts.reduce(
    (s, a) => s + computeAccountBalanceUntilNow(a, cards, purchases, installments, debits, incomes, investments, today),
    0,
  );
  const expected = normalizeZero(accountBalance + totalIncome - totalDebits - totalCredit);

  // Saldo total ao fim de cada mês: 5 anteriores → mês corrente (o "previsto",
  // igual ao número em destaque) → 3 seguintes (projeção do que já está lançado).
  const trend = useMemo(() => {
    const pts: { label: string; full: string; value: number }[] = [];
    for (let i = -5; i <= 3; i++) {
      const d = new Date(year, month + i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const value =
        i === 0
          ? expected
          : normalizeZero(
              accounts.reduce(
                (s, a) =>
                  s + computeAccountBalanceAtMonth(a, cards, purchases, installments, debits, incomes, investments, y, m),
                0,
              ),
            );
      pts.push({ label: MONTHS_SHORT[m], full: `${MONTHS[m]} ${y}`, value });
    }
    return pts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, cards, purchases, installments, debits, incomes, investments, year, month, expected]);

  const prevMonthValue = trend[4]?.value ?? 0;
  const trendPct =
    prevMonthValue && Math.abs(prevMonthValue) > 0.005
      ? ((expected - prevMonthValue) / Math.abs(prevMonthValue)) * 100
      : null;

  // Entradas × saídas dos últimos 6 meses.
  const flow = useMemo(() => {
    const out = [];
    for (let i = -5; i <= 0; i++) {
      const d = new Date(year, month + i, 1);
      const t = monthTotals(d.getFullYear(), d.getMonth());
      out.push({
        label: MONTHS_SHORT[d.getMonth()],
        full: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
        income: t.income,
        debit: t.debit,
        credit: t.credit,
        invest: t.invest,
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installments, debits, incomes, investments, year, month]);

  // Maiores saídas do mês: débitos + faturas por cartão + aportes.
  const topOutflows = useMemo(() => {
    const list: { name: string; value: number; color: string }[] = [];
    for (const d of cur.md.single) list.push({ name: d.description, value: d.amount, color: "var(--series-debit)" });
    for (const p of cur.md.parcelled)
      list.push({ name: p.debit.description, value: p.installment.amount, color: "var(--series-debit)" });
    const byCard = new Map<string, number>();
    for (const i of cur.inst) {
      const pur = purchases.find((p) => p.id === i.parentId);
      if (pur) byCard.set(pur.cardId, (byCard.get(pur.cardId) ?? 0) + i.amount);
    }
    for (const [cardId, v] of byCard) {
      const c = cards.find((x) => x.id === cardId);
      list.push({ name: `Fatura ${c?.name ?? "cartão"}`, value: v, color: "var(--series-credit)" });
    }
    if (totalInvested > 0) list.push({ name: "Investimentos", value: totalInvested, color: "var(--series-invest)" });
    return list.sort((a, b) => b.value - a.value).slice(0, 4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur.md, cur.inst, purchases, cards, investments, totalInvested]);

  const donut: DonutSlice[] = [
    { name: "Débitos", value: totalDebits, color: "var(--series-debit)" },
    { name: "Faturas", value: totalCredit, color: "var(--series-credit)" },
    { name: "Investimentos", value: totalInvested, color: "var(--series-invest)" },
  ].filter((d) => d.value > 0);
  const donutTotal = donut.reduce((s, d) => s + d.value, 0);

  // Próximos vencimentos: débitos e recebíveis em aberto + faturas não pagas.
  const upcoming = useMemo<Due[]>(() => {
    const list: Due[] = [];
    const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const accName = (id: string) => accounts.find((a) => a.id === id)?.name ?? "";
    for (const d of cur.md.single) {
      if (d.paid) continue;
      list.push({ key: `d-${d.id}`, date: parseLocalDate(d.date), name: d.description, sub: `${accName(d.accountId)} · débito`, amount: d.amount, kind: "debit" });
    }
    for (const p of cur.md.parcelled) {
      if (p.installment.paid) continue;
      list.push({
        key: `di-${p.installment.id}`,
        date: parseLocalDate(p.installment.referenceDate ?? p.installment.dueDate),
        name: `${p.debit.description} (${p.installment.number}/${p.installment.total})`,
        sub: `${accName(p.debit.accountId)} · débito`,
        amount: p.installment.amount,
        kind: "debit",
      });
    }
    for (const i of cur.mi.single) {
      if (i.received) continue;
      list.push({ key: `i-${i.id}`, date: parseLocalDate(i.date), name: i.description, sub: `${accName(i.accountId)} · a receber`, amount: i.amount, kind: "income" });
    }
    for (const p of cur.mi.parcelled) {
      if (p.installment.paid) continue;
      list.push({
        key: `ii-${p.installment.id}`,
        date: parseLocalDate(p.installment.referenceDate ?? p.installment.dueDate),
        name: `${p.income.description} (${p.installment.number}/${p.installment.total})`,
        sub: `${accName(p.income.accountId)} · a receber`,
        amount: p.installment.amount,
        kind: "income",
      });
    }
    for (const c of cards) {
      const total = cur.inst
        .filter((i) => purchases.find((p) => p.id === i.parentId)?.cardId === c.id)
        .reduce((s, i) => s + i.amount, 0);
      if (total <= 0 || cardPayments[`${c.id}-${year}-${month}`]) continue;
      list.push({
        key: `c-${c.id}`,
        date: new Date(year, month, Math.min(c.dueDay ?? 5, 28)),
        name: `Fatura ${c.name}`,
        sub: `${accName(c.accountId)} · cartão`,
        amount: total,
        kind: "card",
      });
    }
    return list
      .filter((x) => x.date.getTime() >= t0.getTime())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur.md, cur.mi, cur.inst, cards, purchases, accounts, cardPayments, year, month]);

  if (accounts.length === 0) {
    return (
      <div>
        <HeaderBand title="Home" />
        <div className="mx-auto max-w-2xl px-5 pt-10 pb-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
            <Wallet className="h-8 w-8" />
          </div>
          <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight">Bem-vindo!</h1>
          <p className="mt-2 text-muted-foreground">
            Comece criando sua primeira conta bancária. Cada conta organiza seus cartões,
            débitos, recebimentos e investimentos.
          </p>
          <button
            type="button"
            onClick={() => setManageOpen(true)}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Adicionar conta
          </button>
        </div>
        <ManageAccountsDialog open={manageOpen} onClose={() => setManageOpen(false)} />
      </div>
    );
  }

  const displayName = profile?.displayName || user?.email?.split("@")[0] || "Você";
  const initials = displayName
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const accBalances = accounts.map((a) => ({
    a,
    balance: normalizeZero(
      computeAccountBalanceUntilNow(a, cards, purchases, installments, debits, incomes, investments, today),
    ),
  }));
  const positiveTotal = accBalances.reduce((s, x) => s + Math.max(x.balance, 0), 0) || 1;

  const pct = (paid: number, total: number) => (total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0);

  return (
    <div>
      {maxPanes > 1 && panes.length > 0 && (
        <div className="hidden items-center border-b border-border bg-muted px-4 py-2 md:flex">
          <PaneTabsBar />
        </div>
      )}
      <div className="sticky top-0 z-10">
        <HeaderBand
          title="Home"
          eyebrow={
            <span>
              {MONTHS[month]} de {year}
            </span>
          }
        />
      </div>

      <div className="mx-auto max-w-7xl px-4 pt-5 pb-10 sm:px-6 md:pb-12">
        <div className="grid grid-cols-12 gap-4">
          {/* Saldo previsto + projeção */}
          <section
            className="col-span-12 overflow-hidden rounded-2xl border border-border bg-gradient-hero p-5 lg:col-span-8"
            aria-label="Saldo previsto"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Saldo previsto no fim de {MONTHS[month].toLowerCase()}
                </p>
                <p
                  className={`mt-2 break-words font-display text-4xl leading-none font-semibold tracking-tight tabular-nums sm:text-5xl ${
                    expected >= 0 ? "text-foreground" : "text-destructive"
                  }`}
                >
                  {formatCurrency(expected)}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  {trendPct !== null && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        trendPct >= 0 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                      }`}
                    >
                      {trendPct >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {Math.abs(trendPct).toFixed(1).replace(".", ",")}% vs. mês passado
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    saldo atual das contas:{" "}
                    <span className="font-semibold text-foreground tabular-nums">
                      {formatCurrency(normalizeZero(accountBalance))}
                    </span>
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <i className="inline-block h-[3px] w-3.5 rounded-full bg-primary" />
                  Realizado
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <i className="inline-block w-4 border-t-2 border-dashed border-primary" />
                  Projeção
                </span>
              </div>
            </div>
            <div className="mt-2">
              <BalanceTrendChart points={trend} currentIndex={5} />
            </div>
          </section>

          {/* Onde está o dinheiro */}
          <section className="col-span-12 rounded-2xl border border-border bg-card p-5 lg:col-span-4" aria-label="Distribuição do saldo">
            <h2 className="font-display text-[15px] font-semibold">Onde está seu dinheiro</h2>
            <p className="text-xs text-muted-foreground">Saldo atual por conta</p>
            <div className="mt-4 flex h-2.5 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
              {accBalances.map((x) => (
                <i
                  key={x.a.id}
                  className="block h-full"
                  style={{ flex: Math.max(x.balance, 0) || 0.001, background: x.a.color }}
                />
              ))}
            </div>
            <div className="mt-3 flex flex-col">
              {accBalances.map((x) => (
                <Link
                  key={x.a.id}
                  to="/contas/$contaId"
                  params={{ contaId: x.a.id }}
                  className="flex items-center gap-2.5 rounded-lg px-1.5 py-2 hover:bg-muted"
                >
                  <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: x.a.color }} />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-sm font-semibold">{x.a.name}</b>
                    <span className="text-xs text-muted-foreground">
                      {Math.round((Math.max(x.balance, 0) / positiveTotal) * 100)}% do total
                    </span>
                  </span>
                  <b className={`text-sm tabular-nums ${x.balance < 0 ? "text-destructive" : ""}`}>
                    {formatCurrency(x.balance)}
                  </b>
                </Link>
              ))}
            </div>
          </section>

          {/* KPIs do mês */}
          <KpiTile
            label="A receber"
            value={totalIncome}
            icon={ArrowUpRight}
            tone="income"
            progress={pct(cur.incomePaid, totalIncome)}
            sub={`recebido ${formatCurrency(cur.incomePaid)}`}
          />
          <KpiTile
            label="A pagar (débitos)"
            value={totalDebits}
            icon={ArrowDownRight}
            tone="debit"
            progress={pct(cur.debitPaid, totalDebits)}
            sub={`pago ${formatCurrency(cur.debitPaid)}`}
          />
          <KpiTile
            label="Faturas"
            value={totalCredit}
            icon={CreditCard}
            tone="credit"
            progress={pct(cur.creditPaid, totalCredit)}
            sub={`${cur.creditCount} ${cur.creditCount === 1 ? "lançamento" : "lançamentos"}`}
          />
          <KpiTile label="Investido" value={totalInvested} icon={TrendingUp} tone="invest" sub="aportes do mês" />

          {/* Entradas × saídas */}
          <section className="col-span-12 rounded-2xl border border-border bg-card p-5 lg:col-span-7" aria-label="Entradas e saídas">
            <h2 className="font-display text-[15px] font-semibold">Entradas × saídas</h2>
            <p className="text-xs text-muted-foreground">Últimos 6 meses · saídas empilhadas por tipo</p>
            <div className="mt-3 mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <Legend color="var(--series-income)" line label="Recebíveis" />
              <Legend color="var(--series-debit)" label="Débitos" />
              <Legend color="var(--series-credit)" label="Faturas" />
              <Legend color="var(--series-invest)" label="Investimentos" />
            </div>
            <FlowChart data={flow} />
          </section>

          {/* Composição das saídas */}
          <section className="col-span-12 rounded-2xl border border-border bg-card p-5 lg:col-span-5" aria-label="Composição das saídas">
            <h2 className="font-display text-[15px] font-semibold">Para onde vai o mês</h2>
            <p className="text-xs text-muted-foreground">Composição das saídas de {MONTHS[month].toLowerCase()}</p>
            <div className="mt-4 flex flex-wrap items-center gap-5">
              <SpendDonut data={donut} />
              <div className="min-w-44 flex-1">
                {donut.map((d) => (
                  <div key={d.name} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm">
                    <i className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: d.color }} />
                    <span className="flex-1 whitespace-nowrap text-muted-foreground">{d.name}</span>
                    <b className="tabular-nums">{formatCurrency(d.value)}</b>
                    <em className="w-9 text-right text-xs text-muted-foreground not-italic">
                      {Math.round((d.value / donutTotal) * 100)}%
                    </em>
                  </div>
                ))}
                {donut.length === 0 && <p className="text-sm text-muted-foreground">Sem saídas neste mês.</p>}
              </div>
            </div>
            {topOutflows.length > 0 && (
              <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4">
                <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Maiores saídas</p>
                {topOutflows.map((t) => (
                  <div key={t.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
                    <span className="truncate text-sm text-muted-foreground">{t.name}</span>
                    <b className="text-sm tabular-nums">{formatCurrency(t.value)}</b>
                    <div className="col-span-2 h-1 overflow-hidden rounded-full bg-secondary">
                      <i
                        className="block h-full rounded-full"
                        style={{ width: `${Math.round((t.value / topOutflows[0].value) * 100)}%`, background: t.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Contas */}
          <section className="col-span-12 lg:col-span-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-[17px] font-semibold tracking-tight">Suas contas</h2>
              <button
                type="button"
                onClick={() => setManageOpen(true)}
                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                + Gerenciar contas
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {accounts.map((a) => {
                const Icon = ICON_BY_TYPE[a.type] ?? Wallet;
                const balance = accBalances.find((x) => x.a.id === a.id)?.balance ?? 0;
                const cardCount = cards.filter((c) => c.accountId === a.id).length;
                const accCardIds = new Set(cards.filter((c) => c.accountId === a.id).map((c) => c.id));
                const accDebits = debits.filter((d) => d.accountId === a.id);
                const accIncomes = incomes.filter((i) => i.accountId === a.id);
                const accInvested = sumMonthInvestments(
                  investments.filter((i) => i.accountId === a.id),
                  installments,
                  year,
                  month,
                );
                const md = getMonthDebits(accDebits, installments, year, month);
                const mi = getMonthIncomes(accIncomes, installments, year, month);
                const accDebitsTotal =
                  md.single.reduce((s, d) => s + d.amount, 0) +
                  md.parcelled.reduce((s, p) => s + p.installment.amount, 0);
                const accIncomesTotal =
                  mi.single.reduce((s, i) => s + i.amount, 0) +
                  mi.parcelled.reduce((s, p) => s + p.installment.amount, 0);
                const accCardsTotal = cur.inst
                  .filter((i) => {
                    const pur = purchases.find((p) => p.id === i.parentId);
                    return pur ? accCardIds.has(pur.cardId) : false;
                  })
                  .reduce((s, i) => s + i.amount, 0);
                const accMonthBalance = normalizeZero(accIncomesTotal - accDebitsTotal - accCardsTotal);
                const accTrend = [-5, -4, -3, -2, -1, 0].map((i) => {
                  const d = new Date(year, month + i, 1);
                  return normalizeZero(
                    computeAccountBalanceAtMonth(a, cards, purchases, installments, debits, incomes, investments, d.getFullYear(), d.getMonth()),
                  );
                });

                return (
                  <Link
                    key={a.id}
                    to="/contas/$contaId"
                    params={{ contaId: a.id }}
                    className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-ring/40"
                  >
                    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                        style={{ backgroundColor: a.color + "33", color: a.color }}
                      >
                        <Icon className="h-[18px] w-[18px]" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{a.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {a.type} · {cardCount} {cardCount === 1 ? "cartão" : "cartões"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`font-display text-base font-semibold whitespace-nowrap tabular-nums ${
                            balance >= 0 ? "text-foreground" : "text-destructive"
                          }`}
                        >
                          {formatCurrency(balance)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">saldo atual</p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                    </div>
                    <Sparkline points={accTrend} color={a.color} />
                    <div className="grid grid-cols-2 gap-2">
                      <MiniStat label="A receber" value={accIncomesTotal} tone="income" />
                      <MiniStat label="A pagar" value={accDebitsTotal} tone="debit" />
                      <MiniStat label="Faturas" value={accCardsTotal} tone="credit" />
                      <MiniStat label="Balanço do mês" value={accMonthBalance} tone={accMonthBalance >= 0 ? "income" : "debit"} />
                    </div>
                    {accInvested > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        Investido: <span className="font-semibold text-invest">{formatCurrency(accInvested)}</span>
                      </p>
                    )}
                  </Link>
                );
              })}
            </div>
          </section>

          {/* Próximos vencimentos */}
          <section className="col-span-12 self-start rounded-2xl border border-border bg-card p-5 lg:col-span-4" aria-label="Próximos vencimentos">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h2 className="font-display text-[15px] font-semibold">Próximos vencimentos</h2>
                <p className="text-xs text-muted-foreground">O que ainda está em aberto</p>
              </div>
              <Clock className="mt-1 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </div>
            {upcoming.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">Nada pendente pelos próximos dias. 🎉</p>
            ) : (
              <div className="flex flex-col">
                {upcoming.map((u) => (
                  <div key={u.key} className="flex items-center gap-3 border-t border-border py-2.5 first:border-t-0 first:pt-0">
                    <div className="flex h-11 w-10 shrink-0 flex-col items-center justify-center rounded-xl border border-border bg-background leading-tight">
                      <b className="font-display text-base">{String(u.date.getDate()).padStart(2, "0")}</b>
                      <small className="text-[9px] font-semibold tracking-wider text-muted-foreground uppercase">
                        {MONTHS_SHORT[u.date.getMonth()]}
                      </small>
                    </div>
                    <div className="min-w-0 flex-1">
                      <b className="block truncate text-sm font-semibold">{u.name}</b>
                      <span className="text-xs text-muted-foreground">{u.sub}</span>
                    </div>
                    <div className="text-right">
                      <b className={`text-sm tabular-nums ${u.kind === "income" ? "text-income" : ""}`}>
                        {u.kind === "income" ? "+" : ""}
                        {formatCurrency(u.amount)}
                      </b>
                      <p className="text-[11px] text-muted-foreground">{daysUntil(u.date, today)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
        <p className="mt-8 text-center text-[10px] text-muted-foreground/60">v{APP_VERSION}</p>
      </div>
      <ManageAccountsDialog open={manageOpen} onClose={() => setManageOpen(false)} />
    </div>
  );
}

function Legend({ color, label, line }: { color: string; label: string; line?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <i
        className={`inline-block ${line ? "h-[3px] w-3.5 rounded-full" : "h-2.5 w-2.5 rounded-[3px]"}`}
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

const TONE = {
  income: { text: "text-income", tint: "bg-series-income/20", bar: "var(--series-income)" },
  debit: { text: "text-debit", tint: "bg-series-debit/20", bar: "var(--series-debit)" },
  credit: { text: "text-credit", tint: "bg-series-credit/25", bar: "var(--series-credit)" },
  invest: { text: "text-invest", tint: "bg-series-invest/20", bar: "var(--series-invest)" },
} as const;

/** Total do mês com barra de progresso (pago/recebido) — o "quanto já foi" de cada bloco. */
function KpiTile({
  label,
  value,
  icon: Icon,
  tone,
  progress,
  sub,
}: {
  label: string;
  value: number;
  icon: typeof Wallet;
  tone: keyof typeof TONE;
  progress?: number;
  sub: string;
}) {
  const t = TONE[tone];
  return (
    <div className="col-span-6 flex flex-col gap-2.5 rounded-2xl border border-border bg-card p-4 lg:col-span-3">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{label}</span>
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${t.tint} ${t.text}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <p className="font-display text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">{formatCurrency(value)}</p>
      {progress !== undefined && (
        <div className="h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
          <i className="block h-full rounded-full" style={{ width: `${progress}%`, background: t.bar }} />
        </div>
      )}
      <div className="flex justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate">{sub}</span>
        {progress !== undefined && <span>{progress}%</span>}
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "income" | "debit" | "credit";
}) {
  const c = tone === "income" ? "text-income" : tone === "debit" ? "text-debit" : "text-credit";
  return (
    <div className="min-w-0 rounded-lg border border-border bg-background px-2.5 py-1.5">
      <p className={`truncate text-[10px] font-semibold tracking-wider uppercase ${c}`}>{label}</p>
      <p className="truncate text-xs font-semibold tabular-nums">{formatCurrency(value)}</p>
    </div>
  );
}
