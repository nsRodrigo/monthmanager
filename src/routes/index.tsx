import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useAccounts,
  useCards,
  useInstallments,
  usePurchases,
  useDebits,
  useIncomes,
  getMonthInstallments,
  getMonthDebits,
  getMonthIncomes,
  filterCardsByAccount,
  filterDebitsByAccount,
  filterIncomesByAccount,
  computeAccountBalance,
} from "@/store/finance";
import { useAccountFilter } from "@/store/account-filter";
import { formatCurrency, MONTHS } from "@/lib/format";
import { ArrowDownRight, ArrowUpRight, CreditCard, TrendingUp, Wallet, ChevronRight, Building2 } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Finanças" },
      { name: "description", content: "Visão geral das suas finanças mensais." },
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

  const cards = filterCardsByAccount(allCards, accountId);
  const debits = filterDebitsByAccount(allDebits, accountId);
  const incomes = filterIncomesByAccount(allIncomes, accountId);

  // Restrict purchase-installments to cards belonging to selected account
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
  const pendingCredit = credInst.filter((i) => !i.paid).reduce((s, i) => s + i.amount, 0);
  const pendingDebits =
    monthDebits.single.filter((d) => !d.paid).reduce((s, d) => s + d.amount, 0) +
    monthDebits.parcelled.filter((p) => !p.installment.paid).reduce((s, p) => s + p.installment.amount, 0);

  const balance = totalIncome - totalCredit - totalDebits;

  // Per-account running balance (current state of money — independent from month)
  const visibleAccounts = accountId ? accounts.filter((a) => a.id === accountId) : accounts;
  const totalAccountBalance = visibleAccounts.reduce(
    (sum, a) => sum + computeAccountBalance(a, allCards, purchases, installments, allDebits, allIncomes),
    0,
  );

  const filterLabel = accountId ? accounts.find((a) => a.id === accountId)?.name ?? "Conta" : "Todas as contas";

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
        <p className="mt-2 text-muted-foreground">Aqui está o resumo do seu mês.</p>
      </header>

      {accounts.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Você ainda não tem nenhuma conta cadastrada.
          </p>
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
          <div className="bg-gradient-hero relative overflow-hidden rounded-3xl border border-border p-8 shadow-elevated">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
            <p className="text-sm font-medium text-muted-foreground">Saldo do mês</p>
            <p className={`mt-2 text-4xl font-bold tracking-tight md:text-5xl ${balance >= 0 ? "text-success" : "text-destructive"}`}>
              {formatCurrency(balance)}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
              <MiniStat label="Saldo das contas" value={formatCurrency(totalAccountBalance)} icon={<Wallet className="h-4 w-4" />} />
              <MiniStat label="A pagar (cartões)" value={formatCurrency(pendingCredit)} icon={<CreditCard className="h-4 w-4" />} tone="credit" />
              <MiniStat label="Débitos pendentes" value={formatCurrency(pendingDebits)} icon={<ArrowDownRight className="h-4 w-4" />} tone="debit" />
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <StatCard title="Recebimentos" value={formatCurrency(totalIncome)} icon={<ArrowUpRight className="h-5 w-5" />} gradient="bg-gradient-income" />
            <StatCard title="Cartões de crédito" value={formatCurrency(totalCredit)} icon={<CreditCard className="h-5 w-5" />} gradient="bg-gradient-credit" />
            <StatCard title="Débitos" value={formatCurrency(totalDebits)} icon={<ArrowDownRight className="h-5 w-5" />} gradient="bg-gradient-debit" />
          </div>

          {!accountId && visibleAccounts.length > 0 && (
            <section className="mt-10">
              <h2 className="mb-4 text-xl font-semibold">Suas contas</h2>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {visibleAccounts.map((a) => {
                  const bal = computeAccountBalance(a, allCards, purchases, installments, allDebits, allIncomes);
                  return (
                    <div
                      key={a.id}
                      className="rounded-2xl border border-border bg-gradient-card p-5"
                    >
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

          <section className="mt-10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Cartões — {MONTHS[month]}</h2>
              <Link
                to="/meses/$year/$month"
                params={{ year: String(year), month: String(month) }}
                className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                Ver mês completo <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
            {cards.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                Nenhum cartão {accountId ? "nesta conta" : "cadastrado"}. Cadastre na aba{" "}
                <Link to="/carteira" className="text-primary hover:underline">Carteira</Link>.
              </div>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              {cards.map((c) => {
                const cardInst = credInst.filter((i) => {
                  const pur = purchases.find((p) => p.id === i.parentId);
                  return pur?.cardId === c.id;
                });
                const total = cardInst.reduce((s, i) => s + i.amount, 0);
                const allPaid = cardInst.length > 0 && cardInst.every((i) => i.paid);
                return (
                  <Link
                    key={c.id}
                    to="/meses/$year/$month/cartao/$cardId"
                    params={{ year: String(year), month: String(month), cardId: c.id }}
                    className="group relative overflow-hidden rounded-2xl border border-border bg-gradient-card p-5 transition-all hover:border-primary/40 hover:shadow-glow"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                          <p className="font-semibold">{c.name}</p>
                        </div>
                        <p className="mt-3 text-2xl font-bold">{formatCurrency(total)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{cardInst.length} {cardInst.length === 1 ? "lançamento" : "lançamentos"}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        allPaid ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
                      }`}>
                        {allPaid ? "Pago" : "Em aberto"}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          <div className="mt-8 flex items-center justify-center">
            <Link
              to="/meses"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-105"
            >
              <TrendingUp className="h-4 w-4" /> Ver todos os meses
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function MiniStat({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone?: "credit" | "debit" }) {
  const toneClass =
    tone === "credit" ? "text-credit" : tone === "debit" ? "text-debit" : "text-foreground";
  return (
    <div className="rounded-xl bg-card/60 p-4 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon} {label}
      </div>
      <p className={`mt-2 text-lg font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function StatCard({ title, value, icon, gradient }: { title: string; value: string; icon: React.ReactNode; gradient: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl ${gradient} p-5 shadow-elegant`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-white/85">{title}</p>
        <div className="rounded-lg bg-white/15 p-2 text-white">{icon}</div>
      </div>
      <p className="mt-4 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
