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
  getMonthInvestments,
  isCardFullyPaid,
  computeAccountBalanceUntilNow,
  normalizeZero,
  type Installment,
  type Debit,
  type Income,
  type Investment,
} from "@/store/finance";
import { useAccountFilter } from "@/store/account-filter";
import { MonthYearPicker } from "@/components/MonthYearPicker";
import { formatCurrency, MONTHS, formatDate } from "@/lib/format";
import {
  ChevronLeft,
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
import { EditInstallmentDialog, type SingleEditTarget } from "@/components/EditInstallmentDialog";

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
  const [openPurchase, setOpenPurchase] = useState(false);
  const [purchaseFor, setPurchaseFor] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    inst: Installment;
    label: string;
    subtitle?: string;
    onDeleteParent?: () => void;
  } | null>(null);
  const [editingSingle, setEditingSingle] = useState<{
    item: SingleEditTarget;
    onDeleteParent?: () => void;
  } | null>(null);

  const accountCards = useMemo(
    () => cards.filter((c) => c.accountId === contaId),
    [cards, contaId],
  );

  const accountCardIds = new Set(accountCards.map((c) => c.id));
  const debits = allDebits.filter((d) => d.accountId === contaId);
  const incomes = allIncomes.filter((i) => i.accountId === contaId);
  const investments = getMonthInvestments(
    allInvestments.filter((i) => i.accountId === contaId),
    year,
    month,
  );

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
        <MonthYearPicker
          contaId={contaId}
          year={year}
          month={month}
          prev={prevMonth}
          next={nextMonth}
        />
      </div>

      {/* Header */}
      <header className="mb-4">
        <p className="text-sm font-medium" style={{ color: account.color }}>
          {account.name} · {year}
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl capitalize">
          {MONTHS[month]}
        </h1>
      </header>

      {/* Frame com saldo atual e gastos totais */}
      <MonthSummaryFrame
        saldoAtual={normalizeZero(
          computeAccountBalanceUntilNow(
            account,
            cards,
            purchases,
            installments,
            allDebits,
            allIncomes,
            allInvestments,
          ),
        )}
        gastosTotais={normalizeZero(totalDebits + totalInvested + totalCards)}
      />

      {/* Stacked sections — order: Recebimentos → Investimentos → Débitos → Cartões */}
      <div className="mt-4 space-y-4">
        {/* INCOMES */}
        <GroupedSection
          icon={Download}
          title="RECEBIMENTOS"
          description="Entradas de dinheiro na conta"
          tone="income"
          onAdd={() => setOpenIncome(true)}
          addLabel="Novo recebimento"
          total={totalIncome}
          count={monthIncomes.single.length + monthIncomes.parcelled.length}
          empty={
            monthIncomes.single.length === 0 && monthIncomes.parcelled.length === 0
          }
          emptyText="Nenhum recebimento neste mês."
        >
          {monthIncomes.single.map((i) => (
            <IncomeRow
              key={i.id}
              income={i}
              onToggle={() =>
                toggleIncome.mutate({ id: i.id, received: !i.received })
              }
              onEdit={() =>
                setEditingSingle({
                  item: {
                    kind: "income",
                    id: i.id,
                    description: i.description,
                    amount: i.amount,
                    date: i.date,
                    paid: i.received,
                  },
                  onDeleteParent: () => removeIncome.mutate(i.id),
                })
              }
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
        </GroupedSection>

        {/* INVESTMENTS */}
        <GroupedSection
          icon={TrendingUp}
          title="INVESTIMENTOS"
          description="Aplicações e resgates"
          tone="primary"
          onAdd={() => setOpenInvest(true)}
          addLabel="Novo investimento"
          total={totalInvested}
          count={investments.length}
          defaultOpen={false}
          empty={investments.length === 0}
          emptyText="Nenhum investimento nesta conta."
        >
          {investments.map((inv) => (
            <InvestmentRow
              key={inv.id}
              inv={inv}
              onEdit={() =>
                setEditingSingle({
                  item: {
                    kind: "investment",
                    id: inv.id,
                    description: inv.type,
                    amount: inv.amount,
                    date: inv.date,
                  },
                  onDeleteParent: () => removeInvestment.mutate(inv.id),
                })
              }
              onRemove={() => removeInvestment.mutate(inv.id)}
            />
          ))}
        </GroupedSection>

        {/* DEBITS */}
        <GroupedSection
          icon={Building2}
          title="DÉBITOS"
          description="Gastos diretos da conta corrente"
          tone="debit"
          onAdd={() => setOpenDebit(true)}
          addLabel="Novo débito"
          total={totalDebits}
          count={monthDebits.single.length + monthDebits.parcelled.length}
          empty={
            monthDebits.single.length === 0 && monthDebits.parcelled.length === 0
          }
          emptyText="Nenhum débito neste mês."
        >
          {monthDebits.single.map((d) => (
            <DebitRow
              key={d.id}
              debit={d}
              onToggle={() => toggleDebit.mutate({ id: d.id, paid: !d.paid })}
              onEdit={() =>
                setEditingSingle({
                  item: {
                    kind: "debit",
                    id: d.id,
                    description: d.description,
                    amount: d.amount,
                    date: d.date,
                    paid: d.paid,
                  },
                  onDeleteParent: () => removeDebit.mutate(d.id),
                })
              }
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
        </GroupedSection>

        {/* CARDS — design da imagem 1: header simples + cartões soltos */}
        {(() => {
          const cardsWithMovement = accountCards
            .map((c) => {
              const items = monthInst.filter((i) => {
                if (i.parentType !== "purchase") return false;
                const pur = purchases.find((p) => p.id === i.parentId);
                return pur?.cardId === c.id;
              });
              return { card: c, items };
            })
            .filter(({ items }) => items.length > 0);

          return (
            <section className="space-y-3 pt-2">
              <div className="flex items-center justify-between gap-3 px-1">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-bold uppercase tracking-wider">
                    CARTÕES DE CRÉDITO
                  </h2>
                  <p className="truncate text-[11px] text-muted-foreground">
                    Faturas e compras no crédito
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-debit">{formatCurrency(totalCards)}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {cardsWithMovement.length} {cardsWithMovement.length === 1 ? "item" : "itens"}
                  </p>
                </div>
              </div>

              {cardsWithMovement.length === 0 ? (
                <p className="rounded-2xl border border-border bg-card px-4 py-3 text-center text-xs text-muted-foreground">
                  {accountCards.length === 0
                    ? "Nenhum cartão vinculado a esta conta."
                    : "Nenhum cartão com lançamentos neste mês."}
                </p>
              ) : (
                cardsWithMovement.map(({ card: c, items: cardInst }) => {
                  const total = cardInst.reduce((s, i) => s + i.amount, 0);
                  const paid = isCardFullyPaid(installments, purchases, cardPayments, c.id, year, month);
                  const dueDay = (c as { dueDay?: number }).dueDay ?? 5;
                  const dueDate = new Date(year, month, Math.min(dueDay, 28));
                  return (
                    <div key={c.id} className="rounded-2xl border border-border bg-card">
                      <CardRow
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
                        onRemoveInst={(inst) => {
                          const pur = purchases.find((p) => p.id === inst.parentId);
                          if (pur) removePurchase.mutate(pur.id);
                        }}
                      />
                    </div>
                  );
                })
              )}

              {accountCards.length > 0 && (
                <button
                  onClick={() => setOpenPurchase(true)}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border bg-card px-3 py-3 text-sm font-semibold text-primary transition-colors hover:bg-secondary"
                >
                  <Plus className="h-4 w-4" /> Adicionar um cartão
                </button>
              )}
            </section>
          );
        })()}
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
      <AddPurchaseDialog
        open={openPurchase}
        onClose={() => setOpenPurchase(false)}
        defaultYear={year}
        defaultMonth={month}
        fixedAccountId={contaId}
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
      <EditInstallmentDialog
        open={!!editingSingle}
        onClose={() => setEditingSingle(null)}
        single={editingSingle?.item ?? null}
        onDeleteParent={editingSingle?.onDeleteParent}
      />
    </div>
  );
}

/* ───────── MONTH SUMMARY FRAME ───────── */

function MonthSummaryFrame({
  saldoAtual,
  gastosTotais,
}: {
  saldoAtual: number;
  gastosTotais: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border bg-card p-3 sm:p-4">
      <div className="rounded-xl bg-background/40 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Saldo atual
        </p>
        <p
          className={`mt-1 text-base font-bold sm:text-lg ${
            saldoAtual >= 0 ? "text-foreground" : "text-destructive"
          }`}
        >
          {formatCurrency(saldoAtual)}
        </p>
      </div>
      <div className="rounded-xl bg-background/40 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Gastos totais
        </p>
        <p className="mt-1 text-base font-bold text-debit sm:text-lg">
          {formatCurrency(gastosTotais)}
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">débitos + investimentos + cartões</p>
      </div>
    </div>
  );
}

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


/* ───────── GROUPED SECTION (collapsible category accordion) ───────── */

function GroupedSection({
  icon: Icon,
  title,
  description,
  tone,
  totalTone,
  onAdd,
  addLabel,
  empty,
  emptyText,
  total,
  count,
  defaultOpen = false,
  children,
}: {
  icon: typeof Building2;
  title: string;
  description: string;
  tone: Tone;
  totalTone?: Tone;
  onAdd?: () => void;
  addLabel?: string;
  empty: boolean;
  emptyText: string;
  total?: number;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const totalColor = toneText[totalTone ?? tone];
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      {/* Header (clickable to toggle) */}
      <div className="flex items-center gap-2 px-3 py-3 md:px-4 md:py-3.5">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left md:gap-3"
        >
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${toneBg[tone]} ${toneText[tone]}`}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-bold uppercase tracking-wider">{title}</h2>
            <p className="truncate text-[11px] text-muted-foreground">{description}</p>
          </div>
          {typeof total === "number" && (
            <div className="flex shrink-0 flex-col items-end">
              <p className={`text-sm font-bold ${totalColor}`}>{formatCurrency(total)}</p>
              {typeof count === "number" && (
                <p className="text-[10px] text-muted-foreground">
                  {count} {count === 1 ? "item" : "itens"}
                </p>
              )}
            </div>
          )}
          {open ? (
            <ChevronUp className="ml-1 h-4 w-4 shrink-0 text-muted-foreground md:ml-2" />
          ) : (
            <ChevronDown className="ml-1 h-4 w-4 shrink-0 text-muted-foreground md:ml-2" />
          )}
        </button>
      </div>

      {/* Body */}
      {open && (
        <div className="border-t border-border">
          {empty ? (
            <Empty text={emptyText} />
          ) : (
            <div className="divide-y divide-border">{children}</div>
          )}
          {onAdd && addLabel && (
            <div className="border-t border-border bg-background/30 p-3 md:p-4">
              <button
                onClick={onAdd}
                className={`inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-transparent px-3 py-2.5 text-xs font-semibold transition-colors hover:bg-secondary ${toneText[tone]}`}
              >
                <Plus className="h-3.5 w-3.5" /> {addLabel}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
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
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-3 text-left transition-colors hover:bg-secondary/30 md:gap-3 md:px-4 md:py-3.5"
      >
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: cardColor }}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{cardName}</p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {dueLabel}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <p className="text-sm font-bold text-credit">{formatCurrency(total)}</p>
          <span
            className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
              paid ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
            }`}
          >
            {paid ? "Pago" : "Em aberto"}
          </span>
        </div>
        {open ? (
          <ChevronUp className="ml-1 h-4 w-4 shrink-0 text-muted-foreground md:ml-2" />
        ) : (
          <ChevronDown className="ml-1 h-4 w-4 shrink-0 text-muted-foreground md:ml-2" />
        )}
      </div>

      {open && (
        <div className="border-t border-border bg-background/30">
          <div className="flex flex-wrap items-center justify-end gap-2 px-3 py-2 md:px-4">
            <button
              type="button"
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
          </div>

          {items.length === 0 ? (
            <div className="space-y-3 px-4 py-6 text-center">
              <p className="text-xs text-muted-foreground">
                Nenhum lançamento neste mês.
              </p>
              {onHideMonth && (
                <button
                  type="button"
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

          <div className="border-t border-border p-3 md:p-4">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAdd();
              }}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-transparent px-3 py-2.5 text-xs font-semibold text-credit transition-colors hover:bg-secondary"
            >
              <Plus className="h-3.5 w-3.5" /> Nova compra
            </button>
          </div>
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
    <div className="flex items-center gap-2.5 px-3 py-3 md:gap-3 md:px-4">
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
            ? `${formatCurrency(purchase.totalAmount)} em ${inst.total}x`
            : `${formatCurrency(purchase.totalAmount)} à vista`}
        </p>
      </button>
      <div className="flex flex-col items-end gap-0.5">
        <p className="text-sm font-bold">{formatCurrency(inst.amount)}</p>
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
  onEdit,
  onRemove,
}: {
  debit: Debit;
  onToggle: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-3 md:gap-3 md:px-4">
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
      <button onClick={onEdit} className="flex-1 min-w-0 text-left">
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
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {formatDate(debit.date)} · {formatCurrency(debit.amount)} à vista
        </p>
      </button>
      <p className="text-sm font-bold text-debit">{formatCurrency(debit.amount)}</p>
      <button
        onClick={onEdit}
        className="text-muted-foreground hover:text-primary"
        title="Editar débito"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
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
  onEdit,
  onRemove,
}: {
  income: Income;
  onToggle: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-3 md:gap-3 md:px-4">
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
      <button onClick={onEdit} className="flex-1 min-w-0 text-left">
        <p
          className={`truncate text-sm font-semibold ${
            income.received ? "text-muted-foreground" : ""
          }`}
        >
          {income.description}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {formatDate(income.date)} · {formatCurrency(income.amount)} à vista
        </p>
      </button>
      <p className="text-sm font-bold text-success">{formatCurrency(income.amount)}</p>
      <button
        onClick={onEdit}
        className="text-muted-foreground hover:text-primary"
        title="Editar recebimento"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
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
    <div className="flex items-center gap-2.5 px-3 py-3 md:gap-3 md:px-4">
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
          {formatDate(parent.date)} · {formatCurrency(parent.amount)} em {installment.total}x · venc.{" "}
          {formatDate(installment.dueDate)}
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

function InvestmentRow({ inv, onEdit, onRemove }: { inv: Investment; onEdit: () => void; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-3 md:gap-3 md:px-4">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
        <TrendingUp className="h-3.5 w-3.5" />
      </div>
      <button onClick={onEdit} className="flex-1 min-w-0 text-left">
        <p className="truncate text-sm font-semibold capitalize">{inv.type}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{inv.percentage}% rendimento</p>
      </button>
      <p className="text-sm font-bold text-primary">{formatCurrency(inv.amount)}</p>
      <button
        onClick={onEdit}
        className="text-muted-foreground hover:text-primary"
        title="Editar investimento"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
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
