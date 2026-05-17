import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  useAccounts,
  useCards,
  usePurchases,
  useInstallments,
  useDebits,
  useIncomes,
  useInvestments,
  computeAccountBalanceUntilNow,
  computeMonthFinance,
  getMonthInstallments,
  getMonthDebits,
  getMonthIncomes,
  getMonthInvestments,
  getEffectiveCurrentMonth,
  normalizeZero,
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
  Building2,
  Smartphone,
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

function Consolidated() {
  const { data: accounts = [] } = useAccounts();
  const { data: cards = [] } = useCards();
  const { data: purchases = [] } = usePurchases();
  const { data: installments = [] } = useInstallments();
  const { data: debits = [] } = useDebits();
  const { data: incomes = [] } = useIncomes();
  const { data: investments = [] } = useInvestments();

  // On the consolidated dashboard the global filter must be cleared,
  // so dialogs (new card / new debit) ask for the account explicitly.
  const { setAccountId } = useAccountFilter();
  useEffect(() => setAccountId(null), [setAccountId]);

  const today = new Date();
  const eff = getEffectiveCurrentMonth(today);
  const year = eff.year;
  const month = eff.month;

  const monthInst = getMonthInstallments(installments, year, month);
  const monthDebits = getMonthDebits(debits, installments, year, month);
  const monthIncomes = getMonthIncomes(incomes, installments, year, month);

  const totalCredit = monthInst
    .filter((i) => i.parentType === "purchase")
    .reduce((s, i) => s + i.amount, 0);
  const totalDebits =
    monthDebits.single.reduce((s, d) => s + d.amount, 0) +
    monthDebits.parcelled.reduce((s, p) => s + p.installment.amount, 0);
  const totalIncome =
    monthIncomes.single.reduce((s, i) => s + i.amount, 0) +
    monthIncomes.parcelled.reduce((s, p) => s + p.installment.amount, 0);
  const totalInvested = getMonthInvestments(investments, year, month).reduce((s, i) => s + i.amount, 0);

  // Saldo Disponível consolidado = Σ (sobraMesAnterior + recebimentosMesAtual) por conta
  const totalSaldoDisponivel = accounts.reduce(
    (s, a) =>
      s +
      computeMonthFinance(a, cards, purchases, installments, debits, incomes, investments, year, month).saldoDisponivel,
    0,
  );
  const totalSobraMes = accounts.reduce(
    (s, a) =>
      s +
      computeMonthFinance(a, cards, purchases, installments, debits, incomes, investments, year, month).sobraMes,
    0,
  );
  const totalGastosTotais = totalDebits + totalCredit + totalInvested;
  const expected = normalizeZero(totalSaldoDisponivel);
  const sobraMesConsolidada = normalizeZero(totalSobraMes);

  if (accounts.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
          <Wallet className="h-8 w-8" />
        </div>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">Bem-vindo!</h1>
        <p className="mt-2 text-muted-foreground">
          Comece criando sua primeira conta bancária. Cada conta organiza seus cartões,
          débitos, recebimentos e investimentos.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Use o botão <strong>Adicionar conta</strong> na lateral para começar.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:py-12">
      <header className="mb-8">
        <p className="text-sm font-medium text-primary capitalize">
          {MONTHS[month]} {year}
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">Home</h1>
        <p className="mt-1 text-muted-foreground">
          Visão geral de todas as suas {accounts.length}{" "}
          {accounts.length === 1 ? "conta" : "contas"}.
        </p>
      </header>

      <section className="overflow-hidden rounded-3xl border border-border bg-gradient-card p-4 shadow-elegant sm:p-6">
        <p className="text-sm text-muted-foreground">Saldo Disponível</p>
        <p
          className={`mt-1 break-words text-3xl font-bold tracking-tight sm:text-4xl ${
            expected >= 0 ? "text-foreground" : "text-destructive"
          }`}
        >
          {formatCurrency(expected)}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Sobra do mês anterior + Recebimentos do mês ·{" "}
          <span className={sobraMesConsolidada >= 0 ? "text-success" : "text-destructive"}>
            Sobra do mês: {formatCurrency(sobraMesConsolidada)}
          </span>{" "}
          · Gastos totais: {formatCurrency(normalizeZero(totalGastosTotais))}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:gap-3">
          <Stat
            label="Recebimentos"
            value={formatCurrency(totalIncome)}
            icon={ArrowUpRight}
            tone="success"
          />
          <Stat
            label="Débitos"
            value={formatCurrency(totalDebits)}
            icon={ArrowDownRight}
            tone="debit"
          />
          <Stat
            label="Faturas"
            value={formatCurrency(totalCredit)}
            icon={CreditCard}
            tone="credit"
          />
          <Stat
            label="Investimentos + Carteira"
            value={formatCurrency(totalInvested)}
            icon={TrendingUp}
            tone="primary"
          />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Suas contas</h2>
        <div className="grid gap-3 grid-cols-1">
          {accounts.map((a) => {
            const Icon = ICON_BY_TYPE[a.type] ?? Wallet;
            const accFin = computeMonthFinance(
              a, cards, purchases, installments, debits, incomes, investments, year, month,
            );
            const balance = normalizeZero(accFin.saldoDisponivel);
            const cardCount = cards.filter((c) => c.accountId === a.id).length;

            // Stats do mês corrente filtrados por conta
            const accCardIds = new Set(
              cards.filter((c) => c.accountId === a.id).map((c) => c.id),
            );
            const accDebits = debits.filter((d) => d.accountId === a.id);
            const accIncomes = incomes.filter((i) => i.accountId === a.id);
            const accInvested = getMonthInvestments(
              investments.filter((i) => i.accountId === a.id),
              year,
              month,
            ).reduce((s, i) => s + i.amount, 0);

            const md = getMonthDebits(accDebits, installments, year, month);
            const mi = getMonthIncomes(accIncomes, installments, year, month);
            const accDebitsTotal =
              md.single.reduce((s, d) => s + d.amount, 0) +
              md.parcelled.reduce((s, p) => s + p.installment.amount, 0);
            const accIncomesTotal =
              mi.single.reduce((s, i) => s + i.amount, 0) +
              mi.parcelled.reduce((s, p) => s + p.installment.amount, 0);
            const accCardsTotal = monthInst
              .filter((i) => {
                if (i.parentType !== "purchase") return false;
                const pur = purchases.find((p) => p.id === i.parentId);
                return pur ? accCardIds.has(pur.cardId) : false;
              })
              .reduce((s, i) => s + i.amount, 0);
            const accSobraMes = normalizeZero(accFin.sobraMes);

            return (
              <Link
                key={a.id}
                to="/contas/$contaId"
                params={{ contaId: a.id }}
                className="group flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-glow sm:p-5"
              >
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2.5 sm:gap-4">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl sm:h-12 sm:w-12"
                    style={{ backgroundColor: a.color + "25", color: a.color }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{a.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {a.type} · {cardCount} {cardCount === 1 ? "cartão" : "cartões"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`whitespace-nowrap text-sm font-bold sm:text-base ${
                        balance >= 0 ? "text-foreground" : "text-destructive"
                      }`}
                    >
                      {formatCurrency(balance)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Saldo Disponível</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                </div>

                <div className="grid grid-cols-2 gap-2 border-t border-border/60 pt-3 lg:grid-cols-4">
                  <MiniStat label="Recebimentos" value={accIncomesTotal} tone="success" />
                  <MiniStat label="Débitos" value={accDebitsTotal} tone="debit" />
                  <MiniStat label="Faturas" value={accCardsTotal} tone="credit" />
                  <MiniStat
                    label="Sobra do mês"
                    value={accSobraMes}
                    tone={accSobraMes >= 0 ? "success" : "debit"}
                  />
                </div>
                {accInvested > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Investimentos + Carteira: <span className="font-semibold text-primary">{formatCurrency(accInvested)}</span>
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      </section>
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
  tone: "success" | "debit" | "credit";
}) {
  const c =
    tone === "success" ? "text-success" : tone === "debit" ? "text-debit" : "text-credit";
  return (
    <div className="min-w-0 rounded-lg bg-background/40 px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`truncate text-xs font-bold ${c}`}>{formatCurrency(value)}</p>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  icon: typeof Wallet;
  tone?: "default" | "success" | "debit" | "credit" | "primary";
}) {
  const c =
    tone === "success"
      ? "text-success"
      : tone === "debit"
        ? "text-debit"
        : tone === "credit"
          ? "text-credit"
          : tone === "primary"
            ? "text-primary"
            : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <p className={`mt-1 text-base font-bold ${c}`}>{value}</p>
    </div>
  );
}
