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
  ArrowUpRight,
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
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-5 md:py-10">
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

      {/* Summary pills */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryPill label="Recebido" value={formatCurrency(totalIncome)} tone="income" />
        <SummaryPill label="Débitos" value={formatCurrency(totalDebits)} tone="debit" />
        <SummaryPill label="Cartões" value={formatCurrency(totalCards)} tone="credit" />
        <SummaryPill label="Investido" value={formatCurrency(totalInvested)} tone="primary" />
      </div>

      {/* Stacked sections */}
      <div className="space-y-3">
        {/* CARDS */}
        {accountCards.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            Nenhum cartão vinculado a esta conta.
          </div>
        ) : (
          accountCards.map((c) => {
            const cardInst = monthInst.filter((i) => {
              if (i.parentType !== "purchase") return false;
              const pur = purchases.find((p) => p.id === i.parentId);
              return pur?.cardId === c.id;
            });
            const total = cardInst.reduce((s, i) => s + i.amount, 0);
            const paid = isCardFullyPaid(installments, purchases, cardPayments, c.id, year, month);
            const isOpen = expanded[`card:${c.id}`] ?? false;
            return (
              <CardSection
                key={c.id}
                cardName={c.name}
                cardColor={c.color}
                count={cardInst.length}
                total={total}
                paid={paid}
                open={isOpen}
                onToggleOpen={() => toggle(`card:${c.id}`)}
                onTogglePaid={() =>
                  setCardPaid.mutate({ cardId: c.id, year, month, paid: !paid })
                }
                onAdd={() => setPurchaseFor(c.id)}
                detailHref={{
                  contaId,
                  ano,
                  mes,
                  cartaoId: c.id,
                }}
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
          })
        )}

        {/* DEBITS */}
        <SectionFrame
          icon={Building2}
          title="DÉBITO"
          subtitle={`(${account.name})`}
          count={monthDebits.single.length + monthDebits.parcelled.length}
          total={totalDebits}
          tone="debit"
          open={expanded.debits ?? true}
          onToggle={() => toggle("debits")}
          onAdd={() => setOpenDebit(true)}
          addLabel="Novo débito"
        >
          {monthDebits.single.length === 0 && monthDebits.parcelled.length === 0 ? (
            <Empty text="Nenhum débito neste mês." />
          ) : (
            <div className="divide-y divide-border">
              {monthDebits.single.map((d) => (
                <DebitRow
                  key={d.id}
                  debit={d}
                  onToggle={() => toggleDebit.mutate({ id: d.id, paid: !d.paid })}
                  onRemove={() => removeDebit.mutate(d.id)}
                />
              ))}
              {monthDebits.parcelled.map((p) => (
                <ParcelledRow
                  key={p.installment.id}
                  kind="debit"
                  installment={p.installment}
                  parent={p.debit!}
                  onToggle={() => toggleInst(p.installment.id, !p.installment.paid)}
                  onEdit={() =>
                    setEditing({
                      inst: p.installment,
                      label: p.debit!.description,
                      subtitle: `Débito parcelado · Total ${formatCurrency(p.debit!.amount)} em ${p.debit!.installmentsCount}x`,
                      onDeleteParent: () => removeDebit.mutate(p.debit!.id),
                    })
                  }
                />
              ))}
            </div>
          )}
        </SectionFrame>

        {/* INCOMES */}
        <SectionFrame
          icon={Download}
          title="RECEBÍVEIS"
          count={monthIncomes.single.length + monthIncomes.parcelled.length}
          total={totalIncome}
          tone="income"
          open={expanded.incomes ?? true}
          onToggle={() => toggle("incomes")}
          onAdd={() => setOpenIncome(true)}
          addLabel="Novo recebimento"
        >
          {monthIncomes.single.length === 0 && monthIncomes.parcelled.length === 0 ? (
            <Empty text="Nenhum recebimento neste mês." />
          ) : (
            <div className="divide-y divide-border">
              {monthIncomes.single.map((i) => (
                <IncomeRow
                  key={i.id}
                  income={i}
                  onToggle={() => toggleIncome.mutate({ id: i.id, received: !i.received })}
                  onRemove={() => removeIncome.mutate(i.id)}
                />
              ))}
              {monthIncomes.parcelled.map((p) => (
                <ParcelledRow
                  key={p.installment.id}
                  kind="income"
                  installment={p.installment}
                  parent={p.income!}
                  onToggle={() => toggleInst(p.installment.id, !p.installment.paid)}
                  onEdit={() =>
                    setEditing({
                      inst: p.installment,
                      label: p.income!.description,
                      subtitle: `Recebimento parcelado · Total ${formatCurrency(p.income!.amount)} em ${p.income!.installmentsCount}x`,
                      onDeleteParent: () => removeIncome.mutate(p.income!.id),
                    })
                  }
                />
              ))}
            </div>
          )}
        </SectionFrame>

        {/* INVESTMENTS */}
        <SectionFrame
          icon={TrendingUp}
          title="INVESTIMENTOS"
          count={investments.length}
          total={totalInvested}
          tone="primary"
          open={expanded.investments ?? false}
          onToggle={() => toggle("investments")}
        >
          {investments.length === 0 ? (
            <Empty text="Nenhum investimento nesta conta." />
          ) : (
            <div className="divide-y divide-border">
              {investments.map((inv) => (
                <InvestmentRow
                  key={inv.id}
                  inv={inv}
                  onRemove={() => removeInvestment.mutate(inv.id)}
                />
              ))}
            </div>
          )}
        </SectionFrame>
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

/* ───────── CARD SECTION (expandable) ───────── */

function CardSection({
  cardName,
  cardColor,
  count,
  total,
  paid,
  open,
  onToggleOpen,
  onTogglePaid,
  onAdd,
  detailHref,
  items,
  purchases,
  onToggleInst,
  onEditInst,
}: {
  cardName: string;
  cardColor: string;
  count: number;
  total: number;
  paid: boolean;
  open: boolean;
  onToggleOpen: () => void;
  onTogglePaid: () => void;
  onAdd: () => void;
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
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      {/* HEADER */}
      <button
        onClick={onToggleOpen}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-secondary/30"
      >
        <span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: cardColor }}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold uppercase tracking-wide">{cardName}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {count} {count === 1 ? "lançamento" : "lançamentos"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <p className="text-base font-bold">{formatCurrency(total)}</p>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              paid ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
            }`}
          >
            {paid ? "Pago" : "Em aberto"}
          </span>
        </div>
        {open ? (
          <ChevronUp className="ml-1 h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="ml-1 h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {/* BODY */}
      {open && (
        <div className="border-t border-border">
          {/* fatura summary */}
          <div className="flex items-center justify-between gap-3 bg-background/30 px-4 py-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Fatura atual
              </p>
              <p className="mt-0.5 text-xl font-bold text-credit">{formatCurrency(total)}</p>
            </div>
            <div className="flex items-center gap-2">
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
            </div>
          </div>

          {/* items */}
          {items.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">
              Nenhum lançamento neste mês.
            </div>
          ) : (
            <div>
              <p className="px-4 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Lançamentos da fatura
              </p>
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
            </div>
          )}

          <button
            onClick={onAdd}
            className="flex w-full items-center justify-center gap-2 border-t border-border py-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/30 hover:text-primary"
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar compra
          </button>
        </div>
      )}
    </section>
  );
}

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
          backgroundColor: inst.paid ? "transparent" : `color-mix(in oklab, ${cardColor} 25%, transparent)`,
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

/* ───────── COLLAPSIBLE SECTION FRAME ───────── */

function SectionFrame({
  icon: Icon,
  title,
  subtitle,
  count,
  total,
  tone,
  open,
  onToggle,
  onAdd,
  addLabel,
  children,
}: {
  icon: typeof Building2;
  title: string;
  subtitle?: string;
  count: number;
  total: number;
  tone: "debit" | "income" | "primary" | "credit";
  open: boolean;
  onToggle: () => void;
  onAdd?: () => void;
  addLabel?: string;
  children: React.ReactNode;
}) {
  const toneClass = {
    debit: "text-debit",
    income: "text-success",
    credit: "text-credit",
    primary: "text-primary",
  } as const;
  const bgClass = {
    debit: "bg-debit/15",
    income: "bg-success/15",
    credit: "bg-credit/15",
    primary: "bg-primary/15",
  } as const;
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-secondary/30"
      >
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${bgClass[tone]} ${toneClass[tone]}`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold uppercase tracking-wide">
            {title}
            {subtitle && (
              <span className="ml-1.5 text-[11px] font-medium normal-case text-muted-foreground">
                {subtitle}
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {count} {count === 1 ? "lançamento" : "lançamentos"}
          </p>
        </div>
        <p className={`text-base font-bold ${toneClass[tone]}`}>{formatCurrency(total)}</p>
        {open ? (
          <ChevronUp className="ml-1 h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="ml-1 h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="border-t border-border">
          {children}
          {onAdd && addLabel && (
            <button
              onClick={onAdd}
              className="flex w-full items-center justify-center gap-2 border-t border-border py-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/30 hover:text-primary"
            >
              <Plus className="h-3.5 w-3.5" /> {addLabel}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/* ───────── ROWS ───────── */

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

function SummaryPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "credit" | "debit" | "income" | "primary";
}) {
  const c =
    tone === "credit"
      ? "text-credit"
      : tone === "debit"
        ? "text-debit"
        : tone === "income"
          ? "text-success"
          : "text-primary";
  const Icon =
    tone === "income"
      ? ArrowUpRight
      : tone === "debit"
        ? ArrowDownRight
        : tone === "credit"
          ? CreditCard
          : TrendingUp;
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <p className={`mt-1.5 text-base font-bold md:text-lg ${c}`}>{value}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="px-4 py-6 text-center text-xs text-muted-foreground">{text}</div>
  );
}
