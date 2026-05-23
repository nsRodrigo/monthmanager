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
  computeMonthlyAccountBalance,
  isCardVisibleInMonth,
  normalizeZero,
  useDeleteSingleInstallment,
  useDeleteParentKeepingPaid,
  useEnsureRecurringForMonth,
  useDeleteRecurringSeries,
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
  
  Zap,
  Building2,
  Download,
} from "lucide-react";
import { AddDebitDialog } from "@/components/AddDebitDialog";
import { AddIncomeDialog } from "@/components/AddIncomeDialog";
import { AddPurchaseDialog } from "@/components/AddPurchaseDialog";
import { AddInvestmentDialog } from "@/components/AddInvestmentDialog";
import { EditInstallmentDialog, type SingleEditTarget } from "@/components/EditInstallmentDialog";
import { AddCardDialog } from "@/components/AddCardDialog";
import { EditCardDialog } from "@/components/EditCardDialog";
import { DeleteParcelledDialog } from "@/components/DeleteParcelledDialog";
import { EditRecurringDialog, type RecurringEditTarget } from "@/components/EditRecurringDialog";
import { DeleteRecurringDialog } from "@/components/DeleteRecurringDialog";
import { useConfirm } from "@/store/confirm";

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
  const confirmDialog = useConfirm();

  const [openDebit, setOpenDebit] = useState(false);
  const [openIncome, setOpenIncome] = useState(false);
  const [openInvest, setOpenInvest] = useState(false);
  const [openPurchase, setOpenPurchase] = useState(false);
  const [openCard, setOpenCard] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
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
  const [deletingParcelled, setDeletingParcelled] = useState<{
    inst: Installment;
    label: string;
    parentType: "purchase" | "debit" | "income";
    parentId: string;
  } | null>(null);
  const [editingRecurring, setEditingRecurring] = useState<RecurringEditTarget | null>(null);
  const [deletingRecurring, setDeletingRecurring] = useState<{
    kind: "debit" | "income";
    id: string;
    groupId: string;
    date: string;
    label: string;
  } | null>(null);

  const deleteSingleInst = useDeleteSingleInstallment();
  const deleteParentKeepingPaid = useDeleteParentKeepingPaid();
  const deleteRecurring = useDeleteRecurringSeries();
  useEnsureRecurringForMonth(year, month);

  const askDeleteInst = (
    inst: Installment,
    label: string,
    parentType: "purchase" | "debit" | "income",
    parentId: string,
  ) => setDeletingParcelled({ inst, label, parentType, parentId });

  const accountCards = useMemo(
    () =>
      cards.filter(
        (c) => c.accountId === contaId && isCardVisibleInMonth(c, year, month),
      ),
    [cards, contaId, year, month],
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

  // Ordem desejada para todas as listas: recorrentes → parcelados → à vista.
  // Dentro de cada grupo, ordenar por data (asc) com desempate estável por id.
  const byDateAsc = <T extends { date: string; id: string }>(a: T, b: T) =>
    a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
  const byInstDueAsc = <T extends { installment: { dueDate: string; parentId: string; number: number; id: string } }>(
    a: T,
    b: T,
  ) =>
    a.installment.dueDate.localeCompare(b.installment.dueDate) ||
    a.installment.parentId.localeCompare(b.installment.parentId) ||
    a.installment.number - b.installment.number ||
    a.installment.id.localeCompare(b.installment.id);

  const debitsRecurring = monthDebits.single
    .filter((d) => !!d.recurrenceGroupId)
    .slice()
    .sort(byDateAsc);
  const debitsCash = monthDebits.single
    .filter((d) => !d.recurrenceGroupId)
    .slice()
    .sort(byDateAsc);
  const debitsParcelled = monthDebits.parcelled.slice().sort(byInstDueAsc);

  const incomesRecurring = monthIncomes.single
    .filter((i) => !!i.recurrenceGroupId)
    .slice()
    .sort(byDateAsc);
  const incomesCash = monthIncomes.single
    .filter((i) => !i.recurrenceGroupId)
    .slice()
    .sort(byDateAsc);
  const incomesParcelled = monthIncomes.parcelled.slice().sort(byInstDueAsc);

  const investmentsSorted = investments.slice().sort(byDateAsc);

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

  // Saldo Atual = saldo final do mês anterior + recebíveis do mês atual
  const saldoAtual = (() => {
    if (!account) return 0;
    const monthly = computeMonthlyAccountBalance(
      account,
      cards,
      purchases,
      installments,
      allDebits,
      allIncomes,
      allInvestments,
    );
    const prevKey = month === 0 ? `${year - 1}-11` : `${year}-${month - 1}`;
    const saldoAnterior = monthly.get(prevKey)?.saldoEmConta ?? account.initialBalance;
    return normalizeZero(saldoAnterior + totalIncome);
  })();

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
      {/* Top nav — sticky so the year picker stays accessible while scrolling */}
      <div className="sticky top-0 z-30 -mx-4 mb-5 flex items-center justify-between gap-2 border-b border-border/60 bg-background/85 px-4 py-3 backdrop-blur-md md:-mx-6 md:px-6">
        <Link
          to="/contas/$contaId"
          params={{ contaId }}
          className="inline-flex min-w-0 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" />
          <span className="truncate">{account.name}</span>
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
        <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">
          Lançamentos
        </h1>
      </header>

      {/* Frame com saldo atual e gastos totais */}
      <MonthSummaryFrame
        saldoAtual={normalizeZero(saldoAtual)}
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
          {/* 1) recorrentes */}
          {incomesRecurring.map((i) => (
            <IncomeRow
              key={i.id}
              income={i}
              onToggle={() =>
                toggleIncome.mutate({ id: i.id, received: !i.received })
              }
              onEdit={() => {
                setEditingRecurring({
                  kind: "income",
                  id: i.id,
                  groupId: i.recurrenceGroupId!,
                  description: i.description,
                  amount: i.amount,
                  date: i.date,
                });
              }}
              onRemove={async () => {
                setDeletingRecurring({
                  kind: "income",
                  id: i.id,
                  groupId: i.recurrenceGroupId!,
                  date: i.date,
                  label: i.description,
                });
              }}
            />
          ))}
          {/* 2) parcelados */}
          {incomesParcelled.map((p) => (
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
              onRemove={() => askDeleteInst(p.installment, p.income!.description, "income", p.income!.id)}
            />
          ))}
          {/* 3) à vista */}
          {incomesCash.map((i) => (
            <IncomeRow
              key={i.id}
              income={i}
              onToggle={() =>
                toggleIncome.mutate({ id: i.id, received: !i.received })
              }
              onEdit={() => {
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
                });
              }}
              onRemove={async () => {
                const ok = await confirmDialog({
                  title: "Excluir recebimento",
                  description: `Excluir "${i.description}"?`,
                  variant: "destructive",
                  confirmLabel: "Excluir",
                });
                if (ok) removeIncome.mutate(i.id);
              }}
            />
          ))}
        </GroupedSection>

        {/* CONTA CORRENTE header */}
        <div className="flex items-center justify-between gap-3 px-1">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold uppercase tracking-wider">
              CONTA CORRENTE
            </h2>
            <p className="truncate text-[11px] text-muted-foreground">
              Débitos + investimentos
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className={`text-sm font-bold ${(totalDebits + totalInvested) >= 0 ? "text-foreground" : "text-debit"}`}>
              {formatCurrency(totalDebits + totalInvested)}
            </p>
          </div>
        </div>


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
          {investmentsSorted.map((inv) => (
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
              onRemove={async () => {
                const ok = await confirmDialog({
                  title: "Excluir investimento",
                  description: `Excluir "${inv.type}"?`,
                  variant: "destructive",
                  confirmLabel: "Excluir",
                });
                if (ok) removeInvestment.mutate(inv.id);
              }}
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
          {/* 1) recorrentes */}
          {debitsRecurring.map((d) => (
            <DebitRow
              key={d.id}
              debit={d}
              onToggle={() => toggleDebit.mutate({ id: d.id, paid: !d.paid })}
              onEdit={() =>
                setEditingRecurring({
                  kind: "debit",
                  id: d.id,
                  groupId: d.recurrenceGroupId!,
                  description: d.description,
                  amount: d.amount,
                  date: d.date,
                })
              }
              onRemove={async () =>
                setDeletingRecurring({
                  kind: "debit",
                  id: d.id,
                  groupId: d.recurrenceGroupId!,
                  date: d.date,
                  label: d.description,
                })
              }
            />
          ))}
          {/* 2) parcelados */}
          {debitsParcelled.map((p) => (
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
              onRemove={() => askDeleteInst(p.installment, p.debit!.description, "debit", p.debit!.id)}
            />
          ))}
          {/* 3) à vista */}
          {debitsCash.map((d) => (
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
              onRemove={async () => {
                const ok = await confirmDialog({
                  title: "Excluir débito",
                  description: `Excluir "${d.description}"?`,
                  variant: "destructive",
                  confirmLabel: "Excluir",
                });
                if (ok) removeDebit.mutate(d.id);
              }}
            />
          ))}
        </GroupedSection>

        {/* CARDS — mostra TODOS os cartões da conta, mesmo sem movimento no mês */}
        {(() => {
          const cardsAll = accountCards.map((c) => {
            const items = monthInst.filter((i) => {
              if (i.parentType !== "purchase") return false;
              const pur = purchases.find((p) => p.id === i.parentId);
              return pur?.cardId === c.id;
            });
            return { card: c, items };
          });

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
                    {accountCards.length} {accountCards.length === 1 ? "cartão" : "cartões"}
                  </p>
                </div>
              </div>

              {cardsAll.length === 0 ? (
                <p className="rounded-2xl border border-border bg-card px-4 py-3 text-center text-xs text-muted-foreground">
                  Nenhum cartão vinculado a esta conta.
                </p>
              ) : (
                cardsAll.map(({ card: c, items: cardInst }) => {
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
                        paymentPending={setCardPaid.isPending}
                        count={cardInst.length}
                        dueLabel={`Vence: ${dueDate.toLocaleDateString("pt-BR")}`}
                        onTogglePaid={() => {
                          if (!setCardPaid.isPending) {
                            setCardPaid.mutate({ cardId: c.id, year, month, paid: !paid });
                          }
                        }}
                        onAdd={() => setPurchaseFor(c.id)}
                        onEditCard={() => setEditingCardId(c.id)}
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
                        onRemoveInst={async (inst) => {
                          const pur = purchases.find((p) => p.id === inst.parentId);
                          if (!pur) return;
                          if (pur.installmentsCount > 1) {
                            askDeleteInst(inst, pur.description, "purchase", pur.id);
                          } else {
                            const ok = await confirmDialog({
                              title: "Excluir compra",
                              description: `Excluir "${pur.description}"?`,
                              variant: "destructive",
                              confirmLabel: "Excluir",
                            });
                            if (ok) removePurchase.mutate(pur.id);
                          }
                        }}
                      />
                    </div>
                  );
                })
              )}

              <button
                onClick={() => setOpenCard(true)}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border bg-card px-3 py-3 text-sm font-semibold text-primary transition-colors hover:bg-secondary"
              >
                <Plus className="h-4 w-4" /> Novo cartão
              </button>
            </section>
          );
        })()}
      </div>

      <AddDebitDialog
        open={openDebit}
        onClose={() => setOpenDebit(false)}
        defaultYear={year}
        defaultMonth={month}
        fixedAccountId={contaId}
      />
      <AddIncomeDialog
        open={openIncome}
        onClose={() => setOpenIncome(false)}
        defaultYear={year}
        defaultMonth={month}
        fixedAccountId={contaId}
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
      <AddCardDialog open={openCard} onClose={() => setOpenCard(false)} defaultYear={year} defaultMonth={month} />
      <EditCardDialog
        open={!!editingCardId}
        onClose={() => setEditingCardId(null)}
        card={accountCards.find((c) => c.id === editingCardId) ?? null}
        defaultYear={year}
        defaultMonth={month}
      />
      <DeleteParcelledDialog
        open={!!deletingParcelled}
        onClose={() => setDeletingParcelled(null)}
        itemLabel={deletingParcelled?.label}
        onDeleteOnlyThis={() => {
          if (deletingParcelled) deleteSingleInst.mutate(deletingParcelled.inst.id);
        }}
        onDeleteAllUnpaid={() => {
          if (deletingParcelled)
            deleteParentKeepingPaid.mutate({
              parentId: deletingParcelled.parentId,
              parentType: deletingParcelled.parentType,
            });
        }}
      />
      <EditRecurringDialog
        open={!!editingRecurring}
        onClose={() => setEditingRecurring(null)}
        target={editingRecurring}
      />
      <DeleteRecurringDialog
        open={!!deletingRecurring}
        onClose={() => setDeletingRecurring(null)}
        itemLabel={deletingRecurring?.label}
        onDeleteOnlyThis={() => {
          if (deletingRecurring)
            deleteRecurring.mutate({
              kind: deletingRecurring.kind,
              id: deletingRecurring.id,
              groupId: deletingRecurring.groupId,
              anchorDate: deletingRecurring.date,
              scope: "one",
            });
        }}
        onDeleteThisAndFuture={() => {
          if (deletingRecurring)
            deleteRecurring.mutate({
              kind: deletingRecurring.kind,
              id: deletingRecurring.id,
              groupId: deletingRecurring.groupId,
              anchorDate: deletingRecurring.date,
              scope: "forward",
            });
        }}
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
          Saldo Inicial
        </p>
        <p className={`mt-1 text-base font-bold sm:text-lg ${saldoAtual >= 0 ? "text-foreground" : "text-destructive"}`}>
          {formatCurrency(saldoAtual)}
        </p>
      </div>
      <div className="rounded-xl bg-background/40 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Saldo Final
        </p>
        <p className={`mt-1 text-base font-bold sm:text-lg ${(saldoAtual - gastosTotais) >= 0 ? "text-foreground" : "text-destructive"}`}>
          {formatCurrency(saldoAtual - gastosTotais)}
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">saldo inicial − gastos totais</p>
      </div>
      <div className="col-span-2 rounded-xl bg-background/40 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Gastos Totais
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
  paymentPending,
  count,
  dueLabel,
  onTogglePaid,
  onAdd,
  onEditCard,
  onHideMonth,
  items,
  purchases,
  onToggleInst,
  onEditInst,
  onRemoveInst,
}: {
  cardName: string;
  cardColor: string;
  total: number;
  paid: boolean;
  paymentPending?: boolean;
  count: number;
  dueLabel: string;
  onTogglePaid: () => void;
  onAdd: () => void;
  onEditCard?: () => void;
  onHideMonth?: () => void;
  items: Installment[];
  purchases: ReturnType<typeof usePurchases>["data"] extends infer T
    ? T extends Array<infer P>
      ? P[]
      : never
    : never;
  onToggleInst: (id: string, paid: boolean) => void;
  onEditInst: (inst: Installment) => void;
  onRemoveInst?: (inst: Installment) => void;
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
          {onEditCard ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEditCard();
              }}
              className="block w-full truncate text-left text-sm font-semibold hover:text-primary hover:underline"
              aria-label={`Editar cartão ${cardName}`}
            >
              {cardName}
            </button>
          ) : (
            <p className="truncate text-sm font-semibold">{cardName}</p>
          )}
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
              disabled={paymentPending}
              onClick={(e) => {
                e.stopPropagation();
                if (!paymentPending) onTogglePaid();
              }}
              className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
                paid
                  ? "bg-success/15 text-success hover:bg-success/25"
                  : "bg-warning/15 text-warning hover:bg-warning/25"
              }`}
            >
              {paymentPending ? "Salvando..." : paid ? "✓ Paga" : "Marcar paga"}
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
                .map((inst) => {
                  const pur = purchases.find((p) => p.id === inst.parentId);
                  return { inst, pur };
                })
                .filter((x): x is { inst: typeof items[number]; pur: NonNullable<typeof x.pur> } => !!x.pur)
                .sort((a, b) => {
                  const aParc = a.pur.installmentsCount > 1 ? 0 : 1;
                  const bParc = b.pur.installmentsCount > 1 ? 0 : 1;
                  return (
                    aParc - bParc ||
                    a.inst.dueDate.localeCompare(b.inst.dueDate) ||
                    (a.inst.purchaseId ?? "").localeCompare(b.inst.purchaseId ?? "") ||
                    a.inst.number - b.inst.number ||
                    a.inst.id.localeCompare(b.inst.id)
                  );
                })
                .map(({ inst, pur }) => (
                  <PurchaseInstRow
                    key={inst.id}
                    inst={inst}
                    purchase={pur}
                    cardColor={cardColor}
                    onToggle={() => onToggleInst(inst.id, !inst.paid)}
                    onEdit={() => onEditInst(inst)}
                    onRemove={onRemoveInst ? () => onRemoveInst(inst) : undefined}
                  />
                ))}
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
  onRemove,
}: {
  inst: Installment;
  purchase: { description: string; date: string; totalAmount: number; installmentsCount: number };
  cardColor: string;
  onToggle: () => void;
  onEdit: () => void;
  onRemove?: () => void;
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
      {onRemove && (
        <RemoveInstButton onRemove={onRemove} />
      )}
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
      <div className="flex shrink-0 flex-col items-end gap-1">
        <p className="text-sm font-bold text-debit">{formatCurrency(debit.amount)}</p>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors ${
            debit.paid
              ? "bg-success/15 text-success hover:bg-success/25"
              : "bg-secondary text-muted-foreground hover:bg-secondary/70"
          }`}
        >
          {debit.paid ? <><Check className="h-3 w-3" /> Pago</> : "Marcar pago"}
        </button>
      </div>
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
      <div className="flex shrink-0 flex-col items-end gap-1">
        <p className="text-sm font-bold text-success">{formatCurrency(income.amount)}</p>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors ${
            income.received
              ? "bg-success/15 text-success hover:bg-success/25"
              : "bg-secondary text-muted-foreground hover:bg-secondary/70"
          }`}
        >
          {income.received ? <><Check className="h-3 w-3" /> Recebido</> : "Marcar recebido"}
        </button>
      </div>
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
  onRemove,
}: {
  kind: "debit" | "income";
  installment: Installment;
  parent: Debit | Income;
  onToggle: () => void;
  onEdit: () => void;
  onRemove?: () => void;
}) {
  const tone = kind === "debit" ? "text-debit" : "text-success";
  const auto = kind === "debit" && (parent as Debit).autoDebit;
  return (
    <div className="flex items-center gap-2.5 px-3 py-3 md:gap-3 md:px-4">
      <button
        onClick={() => {
          if (!installment.paid) onToggle();
        }}
        disabled={installment.paid}
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
      {onRemove && (
        <button
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive"
          title="Excluir"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
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

function RemoveInstButton({ onRemove }: { onRemove: () => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onRemove();
      }}
      className="text-muted-foreground hover:text-destructive"
      title="Excluir"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
