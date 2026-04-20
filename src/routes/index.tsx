import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useAccounts,
  useCards,
  useInstallments,
  usePurchases,
  useDebits,
  useIncomes,
  useInvestments,
  getMonthInstallments,
  getMonthDebits,
  getMonthIncomes,
  filterCardsByAccount,
  filterDebitsByAccount,
  filterIncomesByAccount,
  filterInvestmentsByAccount,
  computeAccountBalance,
} from "@/store/finance";
import { useAccountFilter } from "@/store/account-filter";
import { formatCurrency, MONTHS } from "@/lib/format";
import {
  ArrowDownRight,
  ArrowUpRight,
  CreditCard,
  Wallet,
  ChevronRight,
  Building2,
  TrendingUp,
  CalendarDays,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Finanças" },
      { name: "description", content: "Visão geral do mês com saldo previsto." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const { accountId } = useAccountFilter();
  const { data: accounts = [] } = useAccounts();
  const { data: allCards = [] } = useCards();
  const { data: purchases = [] } = usePurchases();
  const { data: installments = [] } = useInstallments();
  const { data: allDebits = [] } = useDebits();
  const { data: allIncomes = [] } = useIncomes();
  const { data: allInvestments = [] } = useInvestments();

  const cards = filterCardsByAccount(allCards, accountId);
  const debits = filterDebitsByAccount(allDebits, accountId);
  const incomes = filterIncomesByAccount(allIncomes, accountId);
  const investments = filterInvestmentsByAccount(allInvestments, accountId);

  const visibleCardIds = new Set(cards.map((c) => c.id));
  const visiblePurchaseIds = new Set(
    purchases.filter((p) => visibleCardIds.has(p.cardId)).map((p) => p.id),
  );

  const allMonthInst = getMonthInstallments(installments, year, month);
  const monthDebits = getMonthDebits(debits, installments, year, month);
  const monthIncomes = getMonthIncomes(incomes, installments, year, month);

  const credInst = allMonthInst.filter(
    (i) => i.parentType === "purchase" && (accountId ? visiblePurchaseIds.has(i.parentId) : true),
  );
  const totalCredit = credInst.reduce((s, i) => s + i.amount, 0);
  const totalDebits =
    monthDebits.single.reduce((s, d) => s + d.amount, 0) +
    monthDebits.parcelled.reduce((s, p) => s + p.installment.amount, 0);
  const totalIncome =
    monthIncomes.single.reduce((s, i) => s + i.amount, 0) +
    monthIncomes.parcelled.reduce((s, p) => s + p.installment.amount, 0);
  const totalInvestments = investments.reduce((s, i) => s + i.amount, 0);

  const expectedBalance = totalIncome - totalCredit - totalDebits;

  const visibleAccounts = accountId ? accounts.filter((a) => a.id === accountId) : accounts;
  const totalAccountBalance = visibleAccounts.reduce(
    (sum, a) => sum + computeAccountBalance(a, allCards, purchases, installments, allDebits, allIncomes),
    0,
  );

  const filterLabel = accountId
    ? accounts.find((a) => a.id === accountId)?.name ?? "Conta"
    : "Todas as contas";

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:py-12">
      <header className="mb-8">
        <p className="text-sm font-medium text-muted-foreground">{MONTHS[month]} de {year}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Olá 👋</h1>
          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
            <Building2 className="h-3 w-3" /> {filterLabel}
          </span>
        </div>
        <p className="mt-2 text-muted-foreground">Resumo do mês com base no vencimento das faturas.</p>
      </header>

      {accounts.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">Você ainda não tem nenhuma conta cadastrada.</p>
          <Link
            to="/contas"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-105"
          >
            <Building2 className="h-4 w-4" /> Cadastrar primeira conta
          </Link>
        </div>
      )}

      {accounts.length > 0 && (
        <>
          {/* Saldo previsto destacado */}
          <div className="bg-gradient-hero relative mb-6 overflow-hidden rounded-3xl border border-border p-8 shadow-elevated">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
            <p className="text-sm font-medium text-muted-foreground">Saldo previsto · {MONTHS[month]}</p>
            <p className={`mt-2 text-4xl font-bold tracking-tight md:text-5xl ${expectedBalance >= 0 ? "text-success" : "text-destructive"}`}>
              {formatCurrency(expectedBalance)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Recebimentos − faturas − débitos</p>
            <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
              <MiniStat label="Saldo das contas" value={formatCurrency(totalAccountBalance)} icon={<Wallet className="h-4 w-4" />} />
              <MiniStat label="Investido" value={formatCurrency(totalInvestments)} icon={<TrendingUp className="h-4 w-4" />} />
              <MiniStat label="A receber" value={formatCurrency(totalIncome)} icon={<ArrowUpRight className="h-4 w-4" />} />
            </div>
          </div>

          {/* Cards grandes por categoria */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <CategoryCard
              to="/credito"
              title="Crédito"
              subtitle="Faturas do mês"
              value={formatCurrency(totalCredit)}
              count={`${credInst.length} parcelas`}
              icon={<CreditCard className="h-5 w-5" />}
              gradient="bg-gradient-credit"
            />
            <CategoryCard
              to="/debito"
              title="Débito"
              subtitle="Conta corrente"
              value={formatCurrency(totalDebits)}
              count={`${monthDebits.single.length + monthDebits.parcelled.length} lançamentos`}
              icon={<ArrowDownRight className="h-5 w-5" />}
              gradient="bg-gradient-debit"
            />
            <CategoryCard
              to="/recebimentos"
              title="Recebimentos"
              subtitle="Entradas do mês"
              value={formatCurrency(totalIncome)}
              count={`${monthIncomes.single.length + monthIncomes.parcelled.length} a receber`}
              icon={<ArrowUpRight className="h-5 w-5" />}
              gradient="bg-gradient-income"
            />
            <CategoryCard
              to="/meses"
              title="Visão mensal"
              subtitle="Todos os meses"
              value={formatCurrency(totalCredit + totalDebits)}
              count="ver outros meses"
              icon={<CalendarDays className="h-5 w-5" />}
              gradient="bg-gradient-card"
              dark
            />
          </div>

          {/* Contas detalhadas (apenas no consolidado) */}
          {!accountId && visibleAccounts.length > 0 && (
            <section className="mt-10">
              <h2 className="mb-4 text-xl font-semibold">Suas contas</h2>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {visibleAccounts.map((a) => {
                  const bal = computeAccountBalance(a, allCards, purchases, installments, allDebits, allIncomes);
                  return (
                    <div key={a.id} className="rounded-2xl border border-border bg-gradient-card p-5">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: a.color }} />
                        <p className="font-semibold">{a.name}</p>
                        <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">{a.type}</span>
                      </div>
                      <p className={`mt-3 text-2xl font-bold ${bal >= 0 ? "text-success" : "text-destructive"}`}>
                        {formatCurrency(bal)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function MiniStat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-card/60 p-4 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon} {label}
      </div>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}

function CategoryCard({
  to,
  title,
  subtitle,
  value,
  count,
  icon,
  gradient,
  dark,
}: {
  to: "/credito" | "/debito" | "/recebimentos" | "/meses";
  title: string;
  subtitle: string;
  value: string;
  count: string;
  icon: React.ReactNode;
  gradient: string;
  dark?: boolean;
}) {
  const text = dark ? "text-foreground" : "text-white";
  const muted = dark ? "text-muted-foreground" : "text-white/85";
  return (
    <Link
      to={to}
      className={`group relative overflow-hidden rounded-2xl ${gradient} p-5 shadow-elegant transition-transform hover:scale-[1.02]`}
    >
      <div className="flex items-center justify-between">
        <p className={`text-xs font-semibold uppercase tracking-wide ${muted}`}>{subtitle}</p>
        <div className={`rounded-lg ${dark ? "bg-secondary" : "bg-white/15"} p-2 ${text}`}>{icon}</div>
      </div>
      <p className={`mt-3 text-base font-bold ${text}`}>{title}</p>
      <p className={`mt-2 text-2xl font-bold ${text}`}>{value}</p>
      <div className={`mt-2 flex items-center justify-between text-xs ${muted}`}>
        <span>{count}</span>
        <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  );
}
