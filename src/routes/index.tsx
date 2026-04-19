import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useCards,
  useInstallments,
  usePurchases,
  useDebits,
  useIncomes,
  useWallet,
  getMonthInstallments,
  getMonthDebits,
  getMonthIncomes,
} from "@/store/finance";
import { formatCurrency, MONTHS } from "@/lib/format";
import { ArrowDownRight, ArrowUpRight, CreditCard, TrendingUp, Wallet, ChevronRight } from "lucide-react";

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

  const { data: cards = [] } = useCards();
  const { data: purchases = [] } = usePurchases();
  const { data: installments = [] } = useInstallments();
  const { data: debits = [] } = useDebits();
  const { data: incomes = [] } = useIncomes();
  const { data: walletAmount = 0 } = useWallet();

  const inst = getMonthInstallments(installments, year, month);
  const monthDebits = getMonthDebits(debits, installments, year, month);
  const monthIncomes = getMonthIncomes(incomes, installments, year, month);

  const credInst = inst.filter((i) => i.parentType === "purchase");
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

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:py-12">
      <header className="mb-8">
        <p className="text-sm font-medium text-muted-foreground">{MONTHS[month]} de {year}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">Olá 👋</h1>
        <p className="mt-2 text-muted-foreground">Aqui está o resumo do seu mês.</p>
      </header>

      <div className="bg-gradient-hero relative overflow-hidden rounded-3xl border border-border p-8 shadow-elevated">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
        <p className="text-sm font-medium text-muted-foreground">Saldo do mês</p>
        <p className={`mt-2 text-4xl font-bold tracking-tight md:text-5xl ${balance >= 0 ? "text-success" : "text-destructive"}`}>
          {formatCurrency(balance)}
        </p>
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <MiniStat label="Carteira" value={formatCurrency(walletAmount)} icon={<Wallet className="h-4 w-4" />} />
          <MiniStat label="A pagar (cartões)" value={formatCurrency(pendingCredit)} icon={<CreditCard className="h-4 w-4" />} tone="credit" />
          <MiniStat label="Débitos pendentes" value={formatCurrency(pendingDebits)} icon={<ArrowDownRight className="h-4 w-4" />} tone="debit" />
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <StatCard title="Recebimentos" value={formatCurrency(totalIncome)} icon={<ArrowUpRight className="h-5 w-5" />} gradient="bg-gradient-income" />
        <StatCard title="Cartões de crédito" value={formatCurrency(totalCredit)} icon={<CreditCard className="h-5 w-5" />} gradient="bg-gradient-credit" />
        <StatCard title="Débitos" value={formatCurrency(totalDebits)} icon={<ArrowDownRight className="h-5 w-5" />} gradient="bg-gradient-debit" />
      </div>

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
            Cadastre seu primeiro cartão na aba <Link to="/carteira" className="text-primary hover:underline">Carteira</Link>.
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
