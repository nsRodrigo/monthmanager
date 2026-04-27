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
  useToggleDebitPaid,
  useRemoveDebit,
  useToggleIncomeReceived,
  useRemoveIncome,
  useToggleInstallmentPaid,
  useSetCardPaid,
  useRemovePurchase,
  useRemoveInvestment,
  getMonthInstallments,
  getMonthDebits,
  getMonthIncomes,
  isCardFullyPaid,
  type Installment,
  type Debit,
  type Income,
  type Investment,
} from "@/store/finance";
import { useAccountFilter } from "@/store/account-filter";
import { formatCurrency, MONTHS, formatDate } from "@/lib/format";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Plus,
  CreditCard,
  ArrowDownRight,
  TrendingUp,
  Trash2,
  Check,
  Pencil,
  Zap,
  Building2,
  Download,
} from "lucide-react";
import { AddDebitDialog } from "@/components/AddDebitDialog";
import { AddIncomeDialog } from "@/components/AddIncomeDialog";
import { AddPurchaseDialog } from "@/components/AddPurchaseDialog";
import { AddInvestmentDialog } from "@/components/AddInvestmentDialog";
import { EditInstallmentDialog } from "@/components/EditInstallmentDialog";

export const Route = createFileRoute("/contas/$contaId_/$ano/$mes")({
  head: ({ params }) => ({
    meta: [
      {
        title: `${MONTHS[Number(params.mes)]} ${params.ano} — Finanças`,
      },
    ],
  }),
  component: AccountMonth,
});

function AccountMonth() {
  const { contaId, ano, mes } = Route.useParams();
  const year = Number(ano);
  const month = Number(mes);

  const { data: accounts = [] } = useAccounts();
  const { data: cards = [] } = useCards();
  const { data: purchases = [] } = usePurchases();
  const { data: installments = [] } = useInstallments();
  const { data: allDebits = [] } = useDebits();
  const { data: allIncomes = [] } = useIncomes();
  const { data: allInvestments = [] } = useInvestments();
  const { data: cardPayments = {} } = useCardPayments();

  const { setAccountId } = useAccountFilter();
  useEffect(() => setAccountId(contaId), [contaId, setAccountId]);

  const account = accounts.find((a) => a.id === contaId);

  const toggleInst = useToggleInstallmentPaid();
  const setCardPaid = useSetCardPaid();
  const removePurchase = useRemovePurchase();
  const toggleDebit = useToggleDebitPaid();
  const removeDebit = useRemoveDebit();
  const toggleIncome = useToggleIncomeReceived();
  const removeIncome = useRemoveIncome();
  const removeInvestment = useRemoveInvestment();

  const [openDebit, setOpenDebit] = useState(false);
  const [openIncome, setOpenIncome] = useState(false);
  const [openInvest, setOpenInvest] = useState(false);
  const [purchaseFor, setPurchaseFor] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    inst: Installment;
    label: string;
    subtitle?: string;
    onDeleteParent?: () => void;
  } | null>(null);

  // expanded sections
  const accountCards = useMemo(
    () => cards.filter((c) => c.accountId === contaId),
    [cards, contaId],
  );
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // initialize defaults: debits/incomes expanded, investments collapsed, cards expanded
  useEffect(() => {
    setExpanded((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const next: Record<string, boolean> = {
        debits: true,
        incomes: true,
        investments: false,
      };
      for (const c of accountCards) next[`card:${c.id}`] = true;
      return next;
    });
  }, [accountCards]);

  const toggle = (k: string) => setExpanded((p) => ({ ...p, [k]: !p[k] }));

  // hidden cards per month (persisted in localStorage); a card stays hidden
  // for a given month until the user un-hides it OR new purchases land in it.
  const hiddenKey = `fin:hiddenCards:${contaId}:${year}:${month}`;
  const [hiddenCardIds, setHiddenCardIds] = useState<string[]>([]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(hiddenKey);
      setHiddenCardIds(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      setHiddenCardIds([]);
    }
  }, [hiddenKey]);
  const persistHidden = (next: string[]) => {
    setHiddenCardIds(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(hiddenKey, JSON.stringify(next));
    }
  };
  const hideCardForMonth = (cardId: string) => {
    if (hiddenCardIds.includes(cardId)) return;
    persistHidden([...hiddenCardIds, cardId]);
  };
  const restoreHiddenCards = () => persistHidden([]);

  const accountCardIds = new Set(accountCards.map((c) => c.id));
  const debits = allDebits.filter((d) => d.accountId === contaId);
  const incomes = allIncomes.filter((i) => i.accountId === contaId);
  const investments = allInvestments.filter((i) => i.accountId === contaId);

  const visiblePurchaseIds = new Set(
    purchases.filter((p) => accountCardIds.has(p.cardId)).map((p) => p.id),
  );

  const monthInst = getMonthInstallments(installments, year, month).filter((i) =>
    i.parentType === "purchase" ? visiblePurchaseIds.has(i.parentId) : true,
  );
  const monthDebits = getMonthDebits(debits, installments, year, month);
  const monthIncomes = getMonthIncomes(incomes, installments, year, month);

  const totalDebits =
    monthDebits.single.reduce((s, d) => s + d.amount, 0) +
    monthDebits.parcelled.reduce((s, p) => s + p.installment.amount, 0);
  const totalIncome =
    monthIncomes.single.reduce((s, i) => s + i.amount, 0) +
    monthIncomes.parcelled.reduce((s, p) => s + p.installment.amount, 0);
  const totalCards = monthInst
    .filter((i) => i.parentType === "purchase")
    .reduce((s, i) => s + i.amount, 0);
  const totalInvested = investments.reduce((s, i) => s + i.amount, 0);

  if (!account) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-12 text-center text-muted-foreground">
        Conta não encontrada.
      </div>
    );
  }

  const prevMonth = month === 0 ? { y: year - 1, m: 11 } : { y: year, m: month - 1 };
  const nextMonth = month === 11 ? { y: year + 1, m: 0 } : { y: year, m: month + 1 };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-10">
      {/* Top nav */}
      <div className="mb-5 flex items-center justify-between">
        <Link
          to="/contas/$contaId"
          params={{ contaId }}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> {account.name}
        </Link>
        <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
          <Link
            to="/contas/$contaId/$ano/$mes"
            params={{ contaId, ano: String(prevMonth.y), mes: String(prevMonth.m) }}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="px-2 text-xs font-semibold capitalize">
            {MONTHS[month]} {year}
          </span>
          <Link
            to="/contas/$contaId/$ano/$mes"
            params={{ contaId, ano: String(nextMonth.y), mes: String(nextMonth.m) }}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Header */}
      <header className="mb-6">
        <p className="text-sm font-medium" style={{ color: account.color }}>
          {account.name} · {year}
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl capitalize">
          {MONTHS[month]}
        </h1>
      </header>

      {/* Top summary cards */}
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <BigSummary
          icon={Download}
          label="Recebimentos"
          value={totalIncome}
          count={monthIncomes.single.length + monthIncomes.parcelled.length}
          countLabel="lançamentos"
          tone="income"
        />
        <BigSummary
          icon={ArrowDownRight}
          label="Débitos"
          value={totalDebits}
          count={monthDebits.single.length + monthDebits.parcelled.length}
          countLabel="lançamentos"
          tone="debit"
        />
        <BigSummary
          icon={CreditCard}
          label="Cartões"
          value={totalCards}
          count={monthInst.filter((i) => i.parentType === "purchase").length}
          countLabel={`${accountCards.length} ${accountCards.length === 1 ? "cartão" : "cartões"} • lançamentos`}
          tone="credit"
        />
        <BigSummary
          icon={TrendingUp}
          label="Investimentos"
          value={totalInvested}
          count={investments.length}
          countLabel="lançamentos"
          tone="primary"
        />
      </div>

      {/* Stacked sections — order: Débito → Recebíveis → Investimentos → Cartões */}
      <div className="space-y-7">
        {/* DEBITS */}
        <GroupedSection
          icon={Building2}
          title="DÉBITOS"
          description="Gastos diretos da conta corrente"
          tone="debit"
          onAdd={() => setOpenDebit(true)}
          addLabel="Novo débito"
          empty={
            monthDebits.single.length === 0 && monthDebits.parcelled.length === 0
          }
          emptyText="Nenhum débito neste mês."
        >
          {(() => {
            type GroupItem =
              | { kind: "single"; debit: Debit }
              | { kind: "parcelled"; installment: Installment; debit: Debit };
            const groups = new Map<
              string,
              { label: string; subtitle: string; total: number; items: GroupItem[] }
            >();
            for (const d of monthDebits.single) {
              const key = `s:${d.description.toLowerCase()}`;
              const g = groups.get(key) ?? {
                label: d.description,
                subtitle: d.required ? "Recorrente" : "Avulso",
                total: 0,
                items: [],
              };
              g.total += d.amount;
              g.items.push({ kind: "single", debit: d });
              groups.set(key, g);
            }
            for (const p of monthDebits.parcelled) {
              const key = `p:${p.debit!.id}`;
              const g = groups.get(key) ?? {
                label: p.debit!.description,
                subtitle: `Parcelado em ${p.debit!.installmentsCount}x`,
                total: 0,
                items: [],
              };
              g.total += p.installment.amount;
              g.items.push({ kind: "parcelled", installment: p.installment, debit: p.debit! });
              groups.set(key, g);
            }
            const arr = Array.from(groups.entries());
            return arr.map(([key, g]) => (
              <GroupedRow
                key={key}
                label={g.label}
                subtitle={g.subtitle}
                value={g.total}
                count={g.items.length}
                tone="debit"
                initial={g.label.charAt(0).toUpperCase()}
              >
                <div className="divide-y divide-border">
                  {g.items.map((it) =>
                    it.kind === "single" ? (
                      <DebitRow
                        key={it.debit.id}
                        debit={it.debit}
                        onToggle={() =>
                          toggleDebit.mutate({ id: it.debit.id, paid: !it.debit.paid })
                        }
                        onRemove={() => removeDebit.mutate(it.debit.id)}
                      />
                    ) : (
                      <ParcelledRow
                        key={it.installment.id}
                        kind="debit"
                        installment={it.installment}
                        parent={it.debit}
                        onToggle={() => toggleInst(it.installment.id, !it.installment.paid)}
                        onEdit={() =>
                          setEditing({
                            inst: it.installment,
                            label: it.debit.description,
                            subtitle: `Débito parcelado · Total ${formatCurrency(it.debit.amount)} em ${it.debit.installmentsCount}x`,
                            onDeleteParent: () => removeDebit.mutate(it.debit.id),
                          })
                        }
                      />
                    ),
                  )}
                </div>
              </GroupedRow>
            ));
          })()}
        </GroupedSection>

        {/* INCOMES */}
        <GroupedSection
          icon={Download}
          title="RECEBIMENTOS"
          description="Entradas de dinheiro na conta"
          tone="income"
          onAdd={() => setOpenIncome(true)}
          addLabel="Novo recebimento"
          empty={
            monthIncomes.single.length === 0 && monthIncomes.parcelled.length === 0
          }
          emptyText="Nenhum recebimento neste mês."
        >
          {(() => {
            type GroupItem =
              | { kind: "single"; income: Income }
              | { kind: "parcelled"; installment: Installment; income: Income };
            const groups = new Map<
              string,
              { label: string; subtitle: string; total: number; items: GroupItem[] }
            >();
            for (const i of monthIncomes.single) {
              const key = `s:${i.description.toLowerCase()}`;
              const g = groups.get(key) ?? {
                label: i.description,
                subtitle: "Recebimento",
                total: 0,
                items: [],
              };
              g.total += i.amount;
              g.items.push({ kind: "single", income: i });
              groups.set(key, g);
            }
            for (const p of monthIncomes.parcelled) {
              const key = `p:${p.income!.id}`;
              const g = groups.get(key) ?? {
                label: p.income!.description,
                subtitle: `Parcelado em ${p.income!.installmentsCount}x`,
                total: 0,
                items: [],
              };
              g.total += p.installment.amount;
              g.items.push({ kind: "parcelled", installment: p.installment, income: p.income! });
              groups.set(key, g);
            }
            return Array.from(groups.entries()).map(([key, g]) => (
              <GroupedRow
                key={key}
                label={g.label}
                subtitle={g.subtitle}
                value={g.total}
                count={g.items.length}
                tone="income"
                initial={g.label.charAt(0).toUpperCase()}
              >
                <div className="divide-y divide-border">
                  {g.items.map((it) =>
                    it.kind === "single" ? (
                      <IncomeRow
                        key={it.income.id}
                        income={it.income}
                        onToggle={() =>
                          toggleIncome.mutate({
                            id: it.income.id,
                            received: !it.income.received,
                          })
                        }
                        onRemove={() => removeIncome.mutate(it.income.id)}
                      />
                    ) : (
                      <ParcelledRow
                        key={it.installment.id}
                        kind="income"
                        installment={it.installment}
                        parent={it.income}
                        onToggle={() => toggleInst(it.installment.id, !it.installment.paid)}
                        onEdit={() =>
                          setEditing({
                            inst: it.installment,
                            label: it.income.description,
                            subtitle: `Recebimento parcelado · Total ${formatCurrency(it.income.amount)} em ${it.income.installmentsCount}x`,
                            onDeleteParent: () => removeIncome.mutate(it.income.id),
                          })
                        }
                      />
                    ),
                  )}
                </div>
              </GroupedRow>
            ));
          })()}
        </GroupedSection>

        {/* INVESTMENTS */}
        <GroupedSection
          icon={TrendingUp}
          title="INVESTIMENTOS"
          description="Aplicações e resgates"
          tone="primary"
          onAdd={() => setOpenInvest(true)}
          addLabel="Novo investimento"
          empty={investments.length === 0}
          emptyText="Nenhum investimento nesta conta."
        >
          {(() => {
            const groups = new Map<
              string,
              { label: string; subtitle: string; total: number; items: Investment[] }
            >();
            for (const inv of investments) {
              const key = inv.type.toLowerCase();
              const g = groups.get(key) ?? {
                label: inv.type,
                subtitle: inv.percentage > 0 ? `${inv.percentage}% rendimento` : "Aplicação",
                total: 0,
                items: [],
              };
              g.total += inv.amount;
              g.items.push(inv);
              groups.set(key, g);
            }
            return Array.from(groups.entries()).map(([key, g]) => (
              <GroupedRow
                key={key}
                label={g.label}
                subtitle={g.subtitle}
                value={g.total}
                count={g.items.length}
                tone="primary"
                initial={g.label.charAt(0).toUpperCase()}
              >
                <div className="divide-y divide-border">
                  {g.items.map((inv) => (
                    <InvestmentRow
                      key={inv.id}
                      inv={inv}
                      onRemove={() => removeInvestment.mutate(inv.id)}
                    />
                  ))}
                </div>
              </GroupedRow>
            ));
          })()}
        </GroupedSection>

        {/* CARDS */}
        <GroupedSection
          icon={CreditCard}
          title="CARTÕES DE CRÉDITO"
          description="Faturas e compras no crédito"
          tone="credit"
          empty={accountCards.length === 0}
          emptyText="Nenhum cartão vinculado a esta conta."
        >
          {accountCards
            .filter((c) => !hiddenCardIds.includes(c.id))
            .map((c) => {
              const cardInst = monthInst.filter((i) => {
                if (i.parentType !== "purchase") return false;
                const pur = purchases.find((p) => p.id === i.parentId);
                return pur?.cardId === c.id;
              });
              const total = cardInst.reduce((s, i) => s + i.amount, 0);
              const paid = isCardFullyPaid(installments, purchases, cardPayments, c.id, year, month);
              // due date approx: due_day of card in current month
              const dueDay = (c as { dueDay?: number }).dueDay ?? 5;
              const dueDate = new Date(year, month, Math.min(dueDay, 28));
              return (
                <CardRow
                  key={c.id}
                  cardName={c.name}
                  cardColor={c.color}
                  total={total}
                  paid={paid}
                  count={cardInst.length}
                  dueLabel={`Vence: ${dueDate.toLocaleDateString("pt-BR")}`}
                  onTogglePaid={() =>
                    setCardPaid.mutate({ cardId: c.id, year, month, paid: !paid })
                  }
                  onAdd={() => setPurchaseFor(c.id)}
                  onHideMonth={
                    cardInst.length === 0 ? () => hideCardForMonth(c.id) : undefined
                  }
                  detailHref={{ contaId, ano, mes, cartaoId: c.id }}
                  items={cardInst}
                  purchases={purchases}
                  onToggleInst={(id, p) => toggleInst(id, p)}
                  onEditInst={(inst) => {
                    const pur = purchases.find((p) => p.id === inst.parentId);
                    if (!pur) return;
                    setEditing({
                      inst,
                      label: pur.description,
                      subtitle: `Compra em ${formatDate(pur.date)} · Total ${formatCurrency(pur.totalAmount)}${
                        pur.installmentsCount > 1 ? ` em ${pur.installmentsCount}x` : ""
                      }`,
                      onDeleteParent: () => removePurchase.mutate(pur.id),
                    });
                  }}
                />
              );
            })}
          {hiddenCardIds.length > 0 && (
            <button
              onClick={restoreHiddenCards}
              className="mt-2 w-full rounded-xl border border-dashed border-border py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              Mostrar {hiddenCardIds.length}{" "}
              {hiddenCardIds.length === 1 ? "cartão oculto" : "cartões ocultos"} neste mês
            </button>
          )}
        </GroupedSection>
      </div>

      <AddDebitDialog
        open={openDebit}
        onClose={() => setOpenDebit(false)}
        defaultYear={year}
        defaultMonth={month}
      />
      <AddIncomeDialog
        open={openIncome}
        onClose={() => setOpenIncome(false)}
        defaultYear={year}
        defaultMonth={month}
      />
      <AddPurchaseDialog
        open={!!purchaseFor}
        onClose={() => setPurchaseFor(null)}
        defaultYear={year}
        defaultMonth={month}
        fixedCardId={purchaseFor ?? undefined}
      />
      <AddInvestmentDialog
        open={openInvest}
        onClose={() => setOpenInvest(false)}
        fixedAccountId={contaId}
      />
      <EditInstallmentDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        installment={editing?.inst ?? null}
        parentLabel={editing?.label}
        parentSubtitle={editing?.subtitle}
        onDeleteParent={editing?.onDeleteParent}
      />
    </div>
  );
}

/* ───────── BIG SUMMARY (top cards) ───────── */

type Tone = "debit" | "income" | "primary" | "credit";

const toneText: Record<Tone, string> = {
  debit: "text-debit",
  income: "text-success",
  credit: "text-credit",
  primary: "text-primary",
};
const toneBg: Record<Tone, string> = {
  debit: "bg-debit/15",
  income: "bg-success/15",
  credit: "bg-credit/15",
  primary: "bg-primary/15",
};

function BigSummary({
  icon: Icon,
  label,
  value,
  count,
  countLabel,
  tone,
}: {
  icon: typeof Building2;
  label: string;
  value: number;
  count: number;
  countLabel: string;
  tone: Tone;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 md:p-5">
      <div className="flex items-start gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${toneBg[tone]} ${toneText[tone]}`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className={`mt-1 text-lg font-bold leading-tight md:text-xl ${toneText[tone]}`}>
            {formatCurrency(value)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {count} {countLabel}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ───────── GROUPED SECTION (header + children list) ───────── */

function GroupedSection({
  icon: Icon,
  title,
  description,
  tone,
  onAdd,
  addLabel,
  empty,
  emptyText,
  children,
}: {
  icon: typeof Building2;
  title: string;
  description: string;
  tone: Tone;
  onAdd?: () => void;
  addLabel?: string;
  empty: boolean;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      {/* Section header */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${toneBg[tone]} ${toneText[tone]}`}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider">{title}</h2>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        {onAdd && addLabel && (
          <button
            onClick={onAdd}
            className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-semibold transition-colors hover:bg-secondary ${toneText[tone]}`}
          >
            <Plus className="h-3 w-3" /> {addLabel}
          </button>
        )}
      </div>

      {/* Body */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {empty ? (
          <Empty text={emptyText} />
        ) : (
          <div className="divide-y divide-border">{children}</div>
        )}
      </div>
    </section>
  );
}

/* ───────── GROUPED ROW (collapsible inside a section) ───────── */

function GroupedRow({
  label,
  subtitle,
  value,
  count,
  tone,
  initial,
  children,
}: {
  label: string;
  subtitle: string;
  value: number;
  count: number;
  tone: Tone;
  initial: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-secondary/30"
      >
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${toneBg[tone]} ${toneText[tone]} text-sm font-bold`}
        >
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{label}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex flex-col items-end">
          <p className={`text-sm font-bold ${toneText[tone]}`}>{formatCurrency(value)}</p>
          <p className="text-[10px] text-muted-foreground">
            {count} {count === 1 ? "lançamento" : "lançamentos"}
          </p>
        </div>
        {open ? (
          <ChevronUp className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>
      {open && <div className="border-t border-border bg-background/30">{children}</div>}
    </div>
  );
}

/* ───────── CARD ROW (collapsible card inside CARDS section) ───────── */

function CardRow({
  cardName,
  cardColor,
  total,
  paid,
  count,
  dueLabel,
  onTogglePaid,
  onAdd,
  onHideMonth,
  detailHref,
  items,
  purchases,
  onToggleInst,
  onEditInst,
}: {
  cardName: string;
  cardColor: string;
  total: number;
  paid: boolean;
  count: number;
  dueLabel: string;
  onTogglePaid: () => void;
  onAdd: () => void;
  onHideMonth?: () => void;
  detailHref: { contaId: string; ano: string; mes: string; cartaoId: string };
  items: Installment[];
  purchases: ReturnType<typeof usePurchases>["data"] extends infer T
    ? T extends Array<infer P>
      ? P[]
      : never
    : never;
  onToggleInst: (id: string, paid: boolean) => void;
  onEditInst: (inst: Installment) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-secondary/30"
      >
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: cardColor }}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{cardName}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Fatura atual: {formatCurrency(total)} • {dueLabel}
          </p>
        </div>
        <p className="text-sm font-bold text-credit">{formatCurrency(total)}</p>
        <span
          className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            paid ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
          }`}
        >
          {paid ? "Pago" : "Em aberto"}
        </span>
        {open ? (
          <ChevronUp className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="border-t border-border bg-background/30">
          <div className="flex items-center justify-end gap-2 px-4 py-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePaid();
              }}
              className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                paid
                  ? "bg-success/15 text-success hover:bg-success/25"
                  : "bg-warning/15 text-warning hover:bg-warning/25"
              }`}
            >
              {paid ? "✓ Paga" : "Marcar paga"}
            </button>
            <Link
              to="/contas/$contaId/$ano/$mes/cartao/$cartaoId"
              params={detailHref}
              className="rounded-full bg-secondary px-3 py-1.5 text-[11px] font-semibold text-foreground hover:bg-secondary/80"
            >
              Detalhes
            </Link>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAdd();
              }}
              className="rounded-full bg-primary/15 px-3 py-1.5 text-[11px] font-semibold text-primary hover:bg-primary/25"
            >
              + Compra
            </button>
          </div>

          {items.length === 0 ? (
            <div className="space-y-3 px-4 py-6 text-center">
              <p className="text-xs text-muted-foreground">
                Nenhum lançamento neste mês.
              </p>
              {onHideMonth && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onHideMonth();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-3 py-1.5 text-[11px] font-semibold text-destructive transition-colors hover:bg-destructive/25"
                >
                  <Trash2 className="h-3 w-3" /> Remover deste mês
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {items
                .slice()
                .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
                .map((inst) => {
                  const pur = purchases.find((p) => p.id === inst.parentId);
                  if (!pur) return null;
                  return (
                    <PurchaseInstRow
                      key={inst.id}
                      inst={inst}
                      purchase={pur}
                      cardColor={cardColor}
                      onToggle={() => onToggleInst(inst.id, !inst.paid)}
                      onEdit={() => onEditInst(inst)}
                    />
                  );
                })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ───────── ROWS ───────── */

function PurchaseInstRow({
  inst,
  purchase,
  cardColor,
  onToggle,
  onEdit,
}: {
  inst: Installment;
  purchase: { description: string; date: string; totalAmount: number; installmentsCount: number };
  cardColor: string;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const isInstallment = inst.total > 1;
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <button
        onClick={onToggle}
        title={inst.paid ? "Marcar como não pago" : "Marcar como pago"}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{
          backgroundColor: inst.paid
            ? "transparent"
            : `color-mix(in oklab, ${cardColor} 25%, transparent)`,
          border: inst.paid ? `2px solid var(--success)` : "none",
          color: inst.paid ? "var(--success)" : cardColor,
        }}
      >
        {inst.paid ? (
          <Check className="h-4 w-4" />
        ) : (
          <span className="text-[10px] font-bold">
            {purchase.description.charAt(0).toUpperCase()}
          </span>
        )}
      </button>
      <button onClick={onEdit} className="min-w-0 flex-1 text-left">
        <p
          className={`truncate text-sm font-semibold ${
            inst.paid ? "text-muted-foreground line-through" : ""
          }`}
        >
          {purchase.description}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {formatDate(purchase.date)} ·{" "}
          {isInstallment
            ? `${inst.total}x de ${formatCurrency(inst.amount)}`
            : "1x sem juros"}
        </p>
      </button>
      <div className="flex flex-col items-end gap-0.5">
        <p className="text-sm font-bold">
          {formatCurrency(isInstallment ? purchase.totalAmount : inst.amount)}
        </p>
        {isInstallment && (
          <span className="rounded-full bg-credit/15 px-1.5 py-0.5 text-[9px] font-bold text-credit">
            {inst.number}/{inst.total}
          </span>
        )}
      </div>
      <button
        onClick={onEdit}
        className="text-muted-foreground hover:text-primary"
        title="Editar parcela"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function DebitRow({
  debit,
  onToggle,
  onRemove,
}: {
  debit: Debit;
  onToggle: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <button
        onClick={onToggle}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          debit.paid
            ? "border-success bg-success text-success-foreground"
            : "border-border hover:border-primary"
        }`}
      >
        {debit.paid && <Check className="h-3.5 w-3.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <p
            className={`truncate text-sm font-semibold ${
              debit.paid ? "text-muted-foreground line-through" : ""
            }`}
          >
            {debit.description}
          </p>
          {debit.required && (
            <span className="rounded-full bg-debit/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-debit">
              Obrig.
            </span>
          )}
          {debit.autoDebit && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary">
              <Zap className="h-2.5 w-2.5" />
              Auto{debit.autoDebitDay ? ` d${debit.autoDebitDay}` : ""}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{formatDate(debit.date)}</p>
      </div>
      <p className="text-sm font-bold text-debit">{formatCurrency(debit.amount)}</p>
      <button
        onClick={onRemove}
        className="text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function IncomeRow({
  income,
  onToggle,
  onRemove,
}: {
  income: Income;
  onToggle: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <button
        onClick={onToggle}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          income.received
            ? "border-success bg-success text-success-foreground"
            : "border-border hover:border-primary"
        }`}
      >
        {income.received && <Check className="h-3.5 w-3.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <p
          className={`truncate text-sm font-semibold ${
            income.received ? "text-muted-foreground" : ""
          }`}
        >
          {income.description}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{formatDate(income.date)}</p>
      </div>
      <p className="text-sm font-bold text-success">{formatCurrency(income.amount)}</p>
      <button
        onClick={onRemove}
        className="text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function ParcelledRow({
  kind,
  installment,
  parent,
  onToggle,
  onEdit,
}: {
  kind: "debit" | "income";
  installment: Installment;
  parent: Debit | Income;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const tone = kind === "debit" ? "text-debit" : "text-success";
  const auto = kind === "debit" && (parent as Debit).autoDebit;
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <button
        onClick={onToggle}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          installment.paid
            ? "border-success bg-success text-success-foreground"
            : "border-border hover:border-primary"
        }`}
      >
        {installment.paid && <Check className="h-3.5 w-3.5" />}
      </button>
      <button onClick={onEdit} className="flex-1 min-w-0 text-left">
        <div className="flex flex-wrap items-center gap-1.5">
          <p
            className={`truncate text-sm font-semibold ${
              installment.paid ? "text-muted-foreground line-through" : ""
            }`}
          >
            {parent.description}
          </p>
          <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-bold uppercase text-muted-foreground">
            {installment.number}/{installment.total}
          </span>
          {auto && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary">
              <Zap className="h-2.5 w-2.5" />
              Auto
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          venc. {formatDate(installment.dueDate)}
        </p>
      </button>
      <p className={`text-sm font-bold ${tone}`}>{formatCurrency(installment.amount)}</p>
      <button
        onClick={onEdit}
        className="text-muted-foreground hover:text-primary"
        title="Editar parcela"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function InvestmentRow({ inv, onRemove }: { inv: Investment; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
        <TrendingUp className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-semibold capitalize">{inv.type}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{inv.percentage}% rendimento</p>
      </div>
      <p className="text-sm font-bold text-primary">{formatCurrency(inv.amount)}</p>
      <button
        onClick={onRemove}
        className="text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="px-4 py-6 text-center text-xs text-muted-foreground">{text}</div>
  );
}
