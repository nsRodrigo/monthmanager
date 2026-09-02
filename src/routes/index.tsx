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
import { formatCurrency, MONTHS } from "@/lib/format";
import { Sparkline } from "@/components/Sparkline";
import { AccountSettingsFab } from "@/components/AccountSettingsFab";
import { ManageAccountsDialog } from "@/components/ManageAccountsDialog";
import { PaneTabsBar } from "@/components/PaneTabsBar";
import { HeaderBand } from "@/components/HeaderBand";
import { useBandScrollProgress } from "@/hooks/use-band-scroll-progress";
import { APP_VERSION } from "@/lib/version";
import {
  ArrowDownRight,
  ArrowUpRight,
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

function Consolidated() {
  const [manageOpen, setManageOpen] = useState(false);
  const bandAnchorRef = useBandScrollProgress<HTMLDivElement>({ collapseRange: 130, frameRange: 68 });
  const { data: accounts = [] } = useAccounts();
  const { data: cards = [] } = useCards();
  const { data: purchases = [] } = usePurchases();
  const { data: installments = [] } = useInstallments();
  const { data: debits = [] } = useDebits();
  const { data: incomes = [] } = useIncomes();
  const { data: investments = [] } = useInvestments();
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
  const totalInvested = sumMonthInvestments(investments, installments, year, month);

  const accountBalance = accounts.reduce(
    (s, a) => s + computeAccountBalanceUntilNow(a, cards, purchases, installments, debits, incomes, investments, today),
    0,
  );
  const expected = normalizeZero(accountBalance + totalIncome - totalDebits - totalCredit);

  // Tendência dos últimos 6 meses: saldo real acumulado ao fim de cada mês
  // passado, terminando no saldo previsto do mês corrente (mesma métrica do
  // card principal, para o ponto mais recente do gráfico bater com o número
  // em destaque).
  const trend = useMemo(() => {
    const points: number[] = [];
    for (let i = 5; i >= 1; i--) {
      const d = new Date(year, month - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const value = accounts.reduce(
        (s, a) =>
          s + computeAccountBalanceAtMonth(a, cards, purchases, installments, debits, incomes, investments, y, m),
        0,
      );
      points.push(normalizeZero(value));
    }
    points.push(expected);
    return points;
  }, [accounts, cards, purchases, installments, debits, incomes, investments, year, month, expected]);

  const prevMonthValue = trend[trend.length - 2];
  const trendPct =
    prevMonthValue && Math.abs(prevMonthValue) > 0.005
      ? ((expected - prevMonthValue) / Math.abs(prevMonthValue)) * 100
      : null;

  if (accounts.length === 0) {
    return (
      <div>
        <HeaderBand title="Home" />
        <div className="mx-auto max-w-2xl px-5 pt-10 pb-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
            <Wallet className="h-8 w-8" />
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight">Bem-vindo!</h1>
          <p className="mt-2 text-muted-foreground">
            Comece criando sua primeira conta bancária. Cada conta organiza seus cartões,
            débitos, recebimentos e investimentos.
          </p>
          <button
            type="button"
            onClick={() => setManageOpen(true)}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow hover:opacity-90"
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

  return (
    <div>
      {maxPanes > 1 && panes.length > 0 && (
        <div className="hidden items-center border-b border-border/60 bg-muted px-4 py-2 md:flex">
          <PaneTabsBar />
        </div>
      )}
      <div ref={bandAnchorRef} className="sticky top-0 z-10">
        <HeaderBand
          collapsible
          collapseTitleMode="shrink"
          title="Home"
          eyebrow={
            <span className="capitalize">
              {MONTHS[month]} {year}
            </span>
          }
          avatar={
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-xs font-extrabold text-primary">
              {profile?.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                initials || <User className="h-4 w-4" aria-hidden="true" />
              )}
            </div>
          }
        />
      </div>

      <div className="mx-auto max-w-6xl px-5 pb-8 md:pb-12">
      <section className="header-frame-fade relative z-10 -mt-6 overflow-hidden rounded-3xl border border-border bg-card p-4 shadow-elegant sm:p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <p className="text-sm text-muted-foreground">Saldo previsto no fim do mês</p>
            <p
              className={`mt-1 break-words text-3xl font-bold tracking-tight sm:text-4xl ${
                expected >= 0 ? "text-foreground" : "text-destructive"
              }`}
            >
              {formatCurrency(expected)}
            </p>
            {trendPct !== null && (
              <span
                className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  trendPct >= 0 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                }`}
              >
                {trendPct >= 0 ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
                {Math.abs(trendPct).toFixed(1)}% vs. mês passado
              </span>
            )}
          </div>
          <Sparkline points={trend} className="mt-3 md:mt-1 md:w-56 md:shrink-0" />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-4">
          <Stat
            label="A receber"
            value={formatCurrency(totalIncome)}
            icon={ArrowUpRight}
            tone="success"
          />
          <Stat
            label="A pagar (débito)"
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
            label="Investido"
            value={formatCurrency(totalInvested)}
            icon={TrendingUp}
            tone="primary"
          />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Saldo atual das contas: <span className="font-semibold text-foreground">{formatCurrency(normalizeZero(accountBalance))}</span>
        </p>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Suas contas</h2>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {accounts.map((a) => {
            const Icon = ICON_BY_TYPE[a.type] ?? Wallet;
            const balance = normalizeZero(
              computeAccountBalanceUntilNow(a, cards, purchases, installments, debits, incomes, investments, today),
            );
            const cardCount = cards.filter((c) => c.accountId === a.id).length;

            // Stats do mês corrente filtrados por conta
            const accCardIds = new Set(
              cards.filter((c) => c.accountId === a.id).map((c) => c.id),
            );
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
            const accCardsTotal = monthInst
              .filter((i) => {
                if (i.parentType !== "purchase") return false;
                const pur = purchases.find((p) => p.id === i.parentId);
                return pur ? accCardIds.has(pur.cardId) : false;
              })
              .reduce((s, i) => s + i.amount, 0);
            const accMonthBalance = normalizeZero(accIncomesTotal - accDebitsTotal - accCardsTotal);

            return (
              <Link
                key={a.id}
                to="/contas/$contaId"
                params={{ contaId: a.id }}
                className="group relative flex h-full flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-card p-4 pl-5 transition-all hover:border-primary/40 hover:shadow-glow sm:p-5 sm:pl-6"
              >
                <span
                  className="absolute inset-y-0 left-0 w-1"
                  style={{ backgroundColor: a.color }}
                  aria-hidden="true"
                />
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2.5 sm:gap-4">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: a.color + "33", color: a.color }}
                  >
                    <Icon className="h-[18px] w-[18px]" />
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
                    <p className="text-[10px] text-muted-foreground">saldo atual</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                </div>

                <div className="grid grid-cols-2 gap-2 border-t border-border/60 pt-3 lg:grid-cols-4">
                  <MiniStat label="A receber" value={accIncomesTotal} tone="success" icon={ArrowUpRight} />
                  <MiniStat label="A pagar" value={accDebitsTotal} tone="debit" icon={ArrowDownRight} />
                  <MiniStat label="Faturas" value={accCardsTotal} tone="credit" icon={CreditCard} />
                  <MiniStat
                    label="Balanço do mês"
                    value={accMonthBalance}
                    tone={accMonthBalance >= 0 ? "success" : "debit"}
                    icon={TrendingUp}
                  />
                </div>
                {accInvested > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Investido: <span className="font-semibold text-primary">{formatCurrency(accInvested)}</span>
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      </section>
      <p className="mt-8 text-center text-[10px] text-muted-foreground/60">v{APP_VERSION}</p>
      <AccountSettingsFab />
      </div>
    </div>
  );
}

function MiniStat({
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
  const c =
    tone === "success" ? "text-success" : tone === "debit" ? "text-debit" : "text-credit";
  return (
    <div className="min-w-0 rounded-lg bg-muted px-2 py-1.5">
      <p className={`flex items-center gap-1 text-[10px] uppercase tracking-wider ${c}`}>
        <Icon className="h-2.5 w-2.5 shrink-0" /> <span className="truncate">{label}</span>
      </p>
      <p className="truncate text-xs font-bold text-foreground">{formatCurrency(value)}</p>
    </div>
  );
}

const STAT_TONE_STYLES = {
  success: { text: "text-success", bg: "bg-success/10", border: "border-success/20" },
  debit: { text: "text-debit", bg: "bg-debit/10", border: "border-debit/20" },
  credit: { text: "text-credit", bg: "bg-credit/10", border: "border-credit/20" },
  primary: { text: "text-primary", bg: "bg-primary/10", border: "border-primary/20" },
  default: { text: "text-foreground", bg: "bg-background/40", border: "border-border" },
} as const;

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
  const s = STAT_TONE_STYLES[tone];
  return (
    <div className={`rounded-xl border p-3 ${s.bg} ${s.border}`}>
      <div className={`flex items-center gap-1.5 text-[11px] ${s.text}`}>
        <Icon className="h-3 w-3" /> {label}
      </div>
      <p className={`mt-1 text-base font-bold ${s.text}`}>{value}</p>
    </div>
  );
}

