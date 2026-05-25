import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
  useEnsureRecurringForMonth,
  useDeleteParcelledByScope,
  useDeleteRecurringByScope,
  useReorderCards,
  type CardScope,
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
  Pencil,
  ArrowUp,
  ArrowDown,
  GripVertical,
} from "lucide-react";
import { AddDebitDialog } from "@/components/AddDebitDialog";
import { AddIncomeDialog } from "@/components/AddIncomeDialog";
import { AddPurchaseDialog } from "@/components/AddPurchaseDialog";
import { AddInvestmentDialog } from "@/components/AddInvestmentDialog";
import { EditInstallmentDialog, type SingleEditTarget } from "@/components/EditInstallmentDialog";
import { AddCardDialog } from "@/components/AddCardDialog";
import { EditCardDialog } from "@/components/EditCardDialog";
import { CardScopeConfirmDialog } from "@/components/CardScopeConfirmDialog";
import { EditRecurringDialog, type RecurringEditTarget } from "@/components/EditRecurringDialog";
import { useConfirm } from "@/store/confirm";
import { useLongPress } from "@/hooks/use-long-press";
import { SortMenu, useSortPreference, applySort, type SortState } from "@/components/SortMenu";

type SelectionKey = "incomes" | "debits" | "investments" | `card:${string}`;

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

  // Persiste o ano atual no sessionStorage para que, ao voltar para a tela
  // de lista de meses, ela abra exatamente no ano do mês que estava sendo
  // editado (ex.: navegou de Dez/2015 para Jan/2016 → voltar abre em 2016).
  useEffect(() => {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(`selected-year-${contaId}`, String(year));
  }, [contaId, year]);

  const account = accounts.find((a) => a.id === contaId);

  const toggleInst = useToggleInstallmentPaid();
  const setCardPaid = useSetCardPaid();
  const removePurchase = useRemovePurchase();
  const toggleDebit = useToggleDebitPaid();
  const removeDebit = useRemoveDebit();
  const toggleIncome = useToggleIncomeReceived();
  const removeIncome = useRemoveIncome();
  const removeInvestment = useRemoveInvestment();
  const reorderCards = useReorderCards();
  const confirmDialog = useConfirm();

  const [reorderMode, setReorderMode] = useState(false);
  const [reorderIds, setReorderIds] = useState<string[] | null>(null);

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
    parentSource?: import("@/store/finance").DuplicateSource;
  } | null>(null);
  const [editingSingle, setEditingSingle] = useState<{
    item: SingleEditTarget;
    onDeleteParent?: () => void;
  } | null>(null);
  const [editingRecurring, setEditingRecurring] = useState<RecurringEditTarget | null>(null);

  const deleteParcelledScoped = useDeleteParcelledByScope();
  const deleteRecurringScoped = useDeleteRecurringByScope();

  // Diálogo único "Aplicar em" reutilizado por todas as exclusões.
  const [scopeDelete, setScopeDelete] = useState<{
    title: string;
    description?: React.ReactNode;
    execute: (scope: CardScope) => Promise<void>;
  } | null>(null);

  /** Abre o "Aplicar em" para uma compra/débito/recebimento parcelado. */
  const askDeleteParcelled = (
    parentId: string,
    parentType: "purchase" | "debit" | "income",
    label: string,
  ) => {
    setScopeDelete({
      title:
        parentType === "purchase"
          ? "Excluir compra parcelada"
          : parentType === "debit"
            ? "Excluir débito parcelado"
            : "Excluir recebimento parcelado",
      description: (
        <>
          Você está excluindo <span className="font-semibold text-foreground">{label}</span>.
        </>
      ),
      execute: (scope) =>
        deleteParcelledScoped.mutateAsync({ parentId, parentType, scope }),
    });
  };

  /** Abre o "Aplicar em" para uma série recorrente (débito/recebimento). */
  const askDeleteRecurring = (
    kind: "debit" | "income",
    groupId: string,
    label: string,
  ) => {
    setScopeDelete({
      title: kind === "debit" ? "Excluir débito recorrente" : "Excluir recebimento recorrente",
      description: (
        <>
          Você está excluindo a série <span className="font-semibold text-foreground">{label}</span>.
        </>
      ),
      execute: (scope) =>
        deleteRecurringScoped.mutateAsync({ kind, groupId, scope }),
    });
  };

  /** Abre o "Aplicar em" para uma compra à vista (1x): só este mês ou tudo. */
  const askDeleteSingle = (
    parentId: string,
    parentType: "purchase" | "debit" | "income",
    label: string,
  ) => {
    setScopeDelete({
      title:
        parentType === "purchase"
          ? "Excluir compra"
          : parentType === "debit"
            ? "Excluir débito"
            : "Excluir recebimento",
      description: (
        <>
          Você está excluindo <span className="font-semibold text-foreground">{label}</span>.
        </>
      ),
      execute: (scope) =>
        deleteParcelledScoped.mutateAsync({ parentId, parentType, scope }),
    });
  };

  useEnsureRecurringForMonth(year, month);

  // ── Modo seleção múltipla (long-press) ─────────────────────────────────
  const [selection, setSelection] = useState<{ key: SelectionKey; ids: Set<string> } | null>(null);
  const isSelMode = (key: SelectionKey) => selection?.key === key;
  const isSelected = (key: SelectionKey, id: string) =>
    selection?.key === key && selection.ids.has(id);
  const startSelection = (key: SelectionKey, id: string) =>
    setSelection({ key, ids: new Set([id]) });
  const toggleSelect = (key: SelectionKey, id: string) =>
    setSelection((prev) => {
      if (!prev || prev.key !== key) return { key, ids: new Set([id]) };
      const ids = new Set(prev.ids);
      if (ids.has(id)) ids.delete(id);
      else ids.add(id);
      if (ids.size === 0) return null;
      return { key, ids };
    });
  const clearSelection = () => setSelection(null);

  const selProps = (key: SelectionKey, id: string) => ({
    selectionMode: isSelMode(key),
    selected: isSelected(key, id),
    onSelectToggle: () => toggleSelect(key, id),
    onLongPress: () => startSelection(key, id),
  });

  const bulkDelete = async (key: SelectionKey) => {
    if (!selection || selection.key !== key) return;
    const ids = Array.from(selection.ids);
    const labelMap: Record<string, string> = {
      incomes: ids.length === 1 ? "recebimento" : "recebimentos",
      debits: ids.length === 1 ? "débito" : "débitos",
      investments: ids.length === 1 ? "investimento" : "investimentos",
    };
    const label = key.startsWith("card:")
      ? ids.length === 1
        ? "compra"
        : "compras"
      : labelMap[key];
    const ok = await confirmDialog({
      title: "Excluir selecionados",
      description: `Excluir ${ids.length} ${label}? Esta ação não pode ser desfeita.`,
      variant: "destructive",
      confirmLabel: "Excluir",
    });
    if (!ok) return;
    if (key === "incomes") ids.forEach((id) => removeIncome.mutate(id));
    else if (key === "debits") ids.forEach((id) => removeDebit.mutate(id));
    else if (key === "investments") ids.forEach((id) => removeInvestment.mutate(id));
    else if (key.startsWith("card:")) ids.forEach((id) => removePurchase.mutate(id));
    clearSelection();
  };

  const askDeleteInst = (
    _inst: Installment,
    label: string,
    parentType: "purchase" | "debit" | "income",
    parentId: string,
  ) => askDeleteParcelled(parentId, parentType, label);

  /**
   * Exclusão de compra no cartão:
   * - parceladas (>1x) → diálogo de escopo (este mês / período / tudo)
   * - 1x → confirmação simples + remove
   */
  const askDeletePurchase = async (pur: {
    id: string;
    description: string;
    installmentsCount: number;
  }) => {
    if (pur.installmentsCount > 1) {
      askDeleteParcelled(pur.id, "purchase", pur.description);
      return;
    }
    const ok = await confirmDialog({
      title: "Excluir compra",
      description: `Excluir "${pur.description}"?`,
      variant: "destructive",
      confirmLabel: "Excluir",
    });
    if (ok) removePurchase.mutate(pur.id);
  };

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
  const debitsAllPaid =
    monthDebits.single.length + monthDebits.parcelled.length > 0 &&
    monthDebits.single.every((d) => d.paid) &&
    monthDebits.parcelled.every((p) => p.installment.paid);

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

  // ───── Sort prefs (per-section, persisted in localStorage) ─────
  const debitsSort = useSortPreference("debits");
  const incomesSort = useSortPreference("incomes");
  const investmentsSort = useSortPreference("investments");

  // Tagged unions for sort-aware flat rendering of debits/incomes.
  type DebitEntry =
    | { kind: "single"; debit: Debit }
    | { kind: "parcelled"; entry: (typeof debitsParcelled)[number] };
  type IncomeEntry =
    | { kind: "single"; income: Income }
    | { kind: "parcelled"; entry: (typeof incomesParcelled)[number] };

  const debitsDefaultOrder: DebitEntry[] = [
    ...debitsRecurring.map<DebitEntry>((d) => ({ kind: "single", debit: d })),
    ...debitsParcelled.map<DebitEntry>((p) => ({ kind: "parcelled", entry: p })),
    ...debitsCash.map<DebitEntry>((d) => ({ kind: "single", debit: d })),
  ];
  const debitsOrdered =
    debitsSort.sort.option === "default"
      ? debitsDefaultOrder
      : applySort(debitsDefaultOrder, debitsSort.sort, {
          name: (e) => (e.kind === "single" ? e.debit.description : e.entry.debit!.description),
          amount: (e) => (e.kind === "single" ? e.debit.amount : e.entry.installment.amount),
          date: (e) => (e.kind === "single" ? e.debit.date : e.entry.installment.dueDate),
          id: (e) => (e.kind === "single" ? e.debit.id : e.entry.installment.id),
        });

  const incomesDefaultOrder: IncomeEntry[] = [
    ...incomesRecurring.map<IncomeEntry>((i) => ({ kind: "single", income: i })),
    ...incomesParcelled.map<IncomeEntry>((p) => ({ kind: "parcelled", entry: p })),
    ...incomesCash.map<IncomeEntry>((i) => ({ kind: "single", income: i })),
  ];
  const incomesOrdered =
    incomesSort.sort.option === "default"
      ? incomesDefaultOrder
      : applySort(incomesDefaultOrder, incomesSort.sort, {
          name: (e) => (e.kind === "single" ? e.income.description : e.entry.income!.description),
          amount: (e) => (e.kind === "single" ? e.income.amount : e.entry.installment.amount),
          date: (e) => (e.kind === "single" ? e.income.date : e.entry.installment.dueDate),
          id: (e) => (e.kind === "single" ? e.income.id : e.entry.installment.id),
        });

  const investmentsOrdered =
    investmentsSort.sort.option === "default"
      ? investmentsSorted
      : applySort(investmentsSorted, investmentsSort.sort, {
          name: (i) => i.type,
          amount: (i) => i.amount,
          date: (i) => i.date,
          id: (i) => i.id,
        });


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

  // Totais pagos/recebidos: só contabiliza itens marcados (paid/received = true).
  // Itens não marcados valem 0 -- não entram negativos.
  const totalIncomeNet =
    monthIncomes.single.reduce((s, i) => s + (i.received ? i.amount : 0), 0) +
    monthIncomes.parcelled.reduce(
      (s, p) => s + (p.installment.paid ? p.installment.amount : 0),
      0,
    );
  const totalDebitsNet =
    monthDebits.single.reduce((s, d) => s + (d.paid ? d.amount : 0), 0) +
    monthDebits.parcelled.reduce(
      (s, p) => s + (p.installment.paid ? p.installment.amount : 0),
      0,
    );
  const totalCardsNet = monthInst
    .filter((i) => i.parentType === "purchase")
    .reduce((s, i) => s + (i.paid ? i.amount : 0), 0);


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
    // Find the most recent month with data BEFORE the current month.
    // Using only `month - 1` breaks when the immediate previous month has no
    // entries (e.g. Nov 2020 → Oct 2020 is empty → must fall back to Sep 2020),
    // otherwise we'd silently revert to account.initialBalance.
    let saldoAnterior = account.initialBalance;
    let bestY = -Infinity;
    let bestM = -Infinity;
    for (const [, mb] of monthly) {
      const isBefore = mb.year < year || (mb.year === year && mb.month < month);
      if (!isBefore) continue;
      if (mb.year > bestY || (mb.year === bestY && mb.month > bestM)) {
        bestY = mb.year;
        bestM = mb.month;
        saldoAnterior = mb.saldoEmConta;
      }
    }
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
          total={totalIncomeNet}
          count={monthIncomes.single.length + monthIncomes.parcelled.length}
          empty={
            monthIncomes.single.length === 0 && monthIncomes.parcelled.length === 0
          }

          emptyText="Nenhum recebimento neste mês."
          sortControl={
            <SortMenu
              scope="incomes"
              state={incomesSort.sort}
              onChange={incomesSort.set}
            />
          }
          headerBar={
            isSelMode("incomes") ? (
              <SelectionBar
                count={selection!.ids.size}
                onCancel={clearSelection}
                onDelete={() => bulkDelete("incomes")}
              />
            ) : null
          }
        >
          {incomesOrdered.map((e) => {
            if (e.kind === "parcelled") {
              const p = e.entry;
              return (
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
                      onDeleteParent: () => askDeleteParcelled(p.income!.id, "income", p.income!.description),
                      parentSource: {
                        kind: "income",
                        accountId: p.income!.accountId,
                        description: p.income!.description,
                        amount: p.income!.amount,
                        date: p.income!.date,
                      },
                    })
                  }
                  onRemove={() => askDeleteInst(p.installment, p.income!.description, "income", p.income!.id)}
                  {...selProps("incomes", p.income!.id)}
                />
              );
            }
            const i = e.income;
            const isRecurring = !!i.recurrenceGroupId;
            return (
              <IncomeRow
                key={i.id}
                income={i}
                onToggle={() =>
                  toggleIncome.mutate({ id: i.id, received: !i.received })
                }
                onEdit={() => {
                  if (isRecurring) {
                    setEditingRecurring({
                      kind: "income",
                      id: i.id,
                      groupId: i.recurrenceGroupId!,
                      description: i.description,
                      amount: i.amount,
                      date: i.date,
                      accountId: i.accountId,
                    });
                  } else {
                    setEditingSingle({
                      item: {
                        kind: "income",
                        id: i.id,
                        accountId: i.accountId,
                        description: i.description,
                        amount: i.amount,
                        date: i.date,
                        paid: i.received,
                      },
                      onDeleteParent: () => removeIncome.mutate(i.id),
                    });
                  }
                }}
                onRemove={
                  isRecurring
                    ? () => askDeleteRecurring("income", i.recurrenceGroupId!, i.description)
                    : async () => {
                        const ok = await confirmDialog({
                          title: "Excluir recebimento",
                          description: `Excluir "${i.description}"?`,
                          variant: "destructive",
                          confirmLabel: "Excluir",
                        });
                        if (ok) removeIncome.mutate(i.id);
                      }
                }
                {...selProps("incomes", i.id)}
              />
            );
          })}
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
            <p className={`text-sm font-bold ${(totalDebits + totalInvested) >= 0 ? "text-foreground" : "text-destructive"}`}>
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
          sortControl={
            <SortMenu
              scope="investments"
              state={investmentsSort.sort}
              onChange={investmentsSort.set}
            />
          }
          headerBar={
            isSelMode("investments") ? (
              <SelectionBar
                count={selection!.ids.size}
                onCancel={clearSelection}
                onDelete={() => bulkDelete("investments")}
              />
            ) : null
          }
        >
          {investmentsOrdered.map((inv) => (
            <InvestmentRow
              key={inv.id}
              inv={inv}
              onEdit={() =>
                setEditingSingle({
                  item: {
                    kind: "investment",
                    id: inv.id,
                    accountId: inv.accountId,
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
              {...selProps("investments", inv.id)}
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
          total={totalDebitsNet}
          count={monthDebits.single.length + monthDebits.parcelled.length}
          paidState={
            monthDebits.single.length + monthDebits.parcelled.length > 0
              ? debitsAllPaid
                ? "paid"
                : "open"
              : null
          }
          empty={
            monthDebits.single.length === 0 && monthDebits.parcelled.length === 0
          }
          emptyText="Nenhum débito neste mês."
          sortControl={
            <SortMenu
              scope="debits"
              state={debitsSort.sort}
              onChange={debitsSort.set}
            />
          }
          headerBar={
            isSelMode("debits") ? (
              <SelectionBar
                count={selection!.ids.size}
                onCancel={clearSelection}
                onDelete={() => bulkDelete("debits")}
              />
            ) : null
          }
          paidControl={
            !isSelMode("debits") &&
            monthDebits.single.length + monthDebits.parcelled.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  const target = !debitsAllPaid;
                  monthDebits.single.forEach((d) => {
                    if (d.paid !== target)
                      toggleDebit.mutate({ id: d.id, paid: target });
                  });
                  monthDebits.parcelled.forEach((p) => {
                    if (p.installment.paid !== target)
                      toggleInst(p.installment.id, target);
                  });
                }}
                className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                  debitsAllPaid
                    ? "bg-success/15 text-success hover:bg-success/25"
                    : "bg-warning/15 text-warning hover:bg-warning/25"
                }`}
              >
                {debitsAllPaid ? "✓ Pago" : "Marcar pago"}
              </button>
            ) : null
          }
        >
          {debitsOrdered.map((e) => {
            if (e.kind === "parcelled") {
              const p = e.entry;
              return (
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
                      onDeleteParent: () => askDeleteParcelled(p.debit!.id, "debit", p.debit!.description),
                      parentSource: {
                        kind: "debit",
                        accountId: p.debit!.accountId,
                        description: p.debit!.description,
                        amount: p.debit!.amount,
                        date: p.debit!.date,
                        required: p.debit!.required,
                      },
                    })
                  }
                  onRemove={() => askDeleteInst(p.installment, p.debit!.description, "debit", p.debit!.id)}
                  {...selProps("debits", p.debit!.id)}
                />
              );
            }
            const d = e.debit;
            const isRecurring = !!d.recurrenceGroupId;
            return (
              <DebitRow
                key={d.id}
                debit={d}
                onToggle={() => toggleDebit.mutate({ id: d.id, paid: !d.paid })}
                onEdit={() => {
                  if (isRecurring) {
                    setEditingRecurring({
                      kind: "debit",
                      id: d.id,
                      groupId: d.recurrenceGroupId!,
                      description: d.description,
                      amount: d.amount,
                      date: d.date,
                      accountId: d.accountId,
                    });
                  } else {
                    setEditingSingle({
                      item: {
                        kind: "debit",
                        id: d.id,
                        accountId: d.accountId,
                        description: d.description,
                        amount: d.amount,
                        date: d.date,
                        paid: d.paid,
                      },
                      onDeleteParent: () => removeDebit.mutate(d.id),
                    });
                  }
                }}
                onRemove={
                  isRecurring
                    ? () => askDeleteRecurring("debit", d.recurrenceGroupId!, d.description)
                    : async () => {
                        const ok = await confirmDialog({
                          title: "Excluir débito",
                          description: `Excluir "${d.description}"?`,
                          variant: "destructive",
                          confirmLabel: "Excluir",
                        });
                        if (ok) removeDebit.mutate(d.id);
                      }
                }
                {...selProps("debits", d.id)}
              />
            );
          })}
        </GroupedSection>

        {/* CARDS — mostra TODOS os cartões da conta, mesmo sem movimento no mês */}
        {(() => {
          // Todos os cartões da conta (incluindo escondidos no mês) para o modo reordenar.
          const allAccountCards = cards.filter((c) => c.accountId === contaId);
          const orderedAllCards =
            reorderMode && reorderIds
              ? (reorderIds
                  .map((id) => allAccountCards.find((c) => c.id === id))
                  .filter(Boolean) as typeof allAccountCards)
              : allAccountCards;

          const cardsAll = accountCards.map((c) => {
            const items = monthInst.filter((i) => {
              if (i.parentType !== "purchase") return false;
              const pur = purchases.find((p) => p.id === i.parentId);
              return pur?.cardId === c.id;
            });
            return { card: c, items };
          });

          const moveCard = (idx: number, dir: -1 | 1) => {
            setReorderIds((prev) => {
              const base = prev ?? allAccountCards.map((c) => c.id);
              const next = [...base];
              const swap = idx + dir;
              if (swap < 0 || swap >= next.length) return prev;
              [next[idx], next[swap]] = [next[swap], next[idx]];
              return next;
            });
          };

          const enterReorder = () => {
            setReorderIds(allAccountCards.map((c) => c.id));
            setReorderMode(true);
          };

          const cancelReorder = () => {
            setReorderMode(false);
            setReorderIds(null);
          };

          const saveReorder = async () => {
            if (!reorderIds) {
              cancelReorder();
              return;
            }
            await reorderCards.mutateAsync({
              accountId: contaId,
              orderedIds: reorderIds,
            });
            cancelReorder();
          };

          return (
            <section className="space-y-3 pt-2">
              <div className="flex items-center justify-between gap-3 px-1">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-bold uppercase tracking-wider">
                    CARTÕES DE CRÉDITO
                  </h2>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {reorderMode
                      ? "Arraste a ordem dos cartões — vale para a conta inteira"
                      : "Faturas e compras no crédito"}
                  </p>
                </div>
                {reorderMode ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={cancelReorder}
                      className="rounded-full border border-border bg-background px-3 py-1.5 text-[11px] font-semibold hover:bg-secondary"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={saveReorder}
                      disabled={reorderCards.isPending}
                      className="rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
                    >
                      {reorderCards.isPending ? "Salvando..." : "Concluir"}
                    </button>
                  </div>
                ) : (
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-debit">{formatCurrency(totalCardsNet)}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {accountCards.length} {accountCards.length === 1 ? "cartão" : "cartões"}
                    </p>
                  </div>
                )}
              </div>

              {reorderMode ? (
                orderedAllCards.length === 0 ? (
                  <p className="rounded-2xl border border-border bg-card px-4 py-3 text-center text-xs text-muted-foreground">
                    Nenhum cartão para reordenar.
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-border bg-card">
                    {orderedAllCards.map((c, idx) => (
                      <div
                        key={c.id}
                        className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0 md:px-4"
                      >
                        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: c.color }}
                        />
                        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{c.name}</p>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => moveCard(idx, -1)}
                            disabled={idx === 0}
                            aria-label="Subir"
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary disabled:opacity-30"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveCard(idx, 1)}
                            disabled={idx === orderedAllCards.length - 1}
                            aria-label="Descer"
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary disabled:opacity-30"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : cardsAll.length === 0 ? (
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
                    <div
                      key={c.id}
                      className={`rounded-2xl border bg-card transition-colors ${
                        paid
                          ? "border-success/50 shadow-[0_4px_18px_-6px_color-mix(in_oklab,var(--success)_45%,transparent)]"
                          : "border-warning/50 shadow-[0_4px_18px_-6px_color-mix(in_oklab,var(--warning)_40%,transparent)]"
                      }`}
                    >
                      <CardRowSorted
                        card={c}
                        cardInst={cardInst}
                        purchases={purchases}
                        total={total}
                        paid={paid}
                        paymentPending={setCardPaid.isPending}
                        dueLabel={`Vence: ${dueDate.toLocaleDateString("pt-BR")}`}
                        onTogglePaid={() => {
                          if (!setCardPaid.isPending) {
                            setCardPaid.mutate({ cardId: c.id, year, month, paid: !paid });
                          }
                        }}
                        onAdd={() => setPurchaseFor(c.id)}
                        onEditCard={() => setEditingCardId(c.id)}
                        onRequestReorder={enterReorder}
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
                            onDeleteParent: () => askDeletePurchase(pur),
                            parentSource: {
                              kind: "purchase",
                              cardId: c.id,
                              description: pur.description,
                              totalAmount: pur.totalAmount,
                              date: pur.date,
                            },
                          });
                        }}
                        onRemoveInst={(inst) => {
                          const pur = purchases.find((p) => p.id === inst.parentId);
                          if (!pur) return;
                          askDeletePurchase(pur);
                        }}
                        itemSelProps={(_inst, parentId) =>
                          selProps(`card:${c.id}`, parentId)
                        }
                        selectionBar={
                          isSelMode(`card:${c.id}`) ? (
                            <SelectionBar
                              count={selection!.ids.size}
                              onCancel={clearSelection}
                              onDelete={() => bulkDelete(`card:${c.id}`)}
                            />
                          ) : null
                        }
                      />

                    </div>
                  );
                })
              )}

              {!reorderMode && (
                <button
                  onClick={() => setOpenCard(true)}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border bg-card px-3 py-3 text-sm font-semibold text-primary transition-colors hover:bg-secondary"
                >
                  <Plus className="h-4 w-4" /> Novo cartão
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
        parentSource={editing?.parentSource}
        defaultYear={year}
        defaultMonth={month}
      />
      <EditInstallmentDialog
        open={!!editingSingle}
        onClose={() => setEditingSingle(null)}
        single={editingSingle?.item ?? null}
        onDeleteParent={editingSingle?.onDeleteParent}
        defaultYear={year}
        defaultMonth={month}
      />
      <AddCardDialog open={openCard} onClose={() => setOpenCard(false)} defaultYear={year} defaultMonth={month} />
      <EditCardDialog
        open={!!editingCardId}
        onClose={() => setEditingCardId(null)}
        card={accountCards.find((c) => c.id === editingCardId) ?? null}
        defaultYear={year}
        defaultMonth={month}
      />
      <EditRecurringDialog
        open={!!editingRecurring}
        onClose={() => setEditingRecurring(null)}
        target={editingRecurring}
        defaultYear={year}
        defaultMonth={month}
      />
      <CardScopeConfirmDialog
        open={!!scopeDelete}
        onClose={() => setScopeDelete(null)}
        title={scopeDelete?.title ?? "Excluir"}
        description={scopeDelete?.description}
        confirmLabel="Excluir"
        variant="destructive"
        defaultYear={year}
        defaultMonth={month}
        initialKind="month"
        loading={deleteParcelledScoped.isPending || deleteRecurringScoped.isPending}
        onConfirm={async (scope) => {
          if (!scopeDelete) return;
          await scopeDelete.execute(scope);
          setScopeDelete(null);
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
  headerBar,
  sortControl,
  paidControl,
  paidState,
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
  headerBar?: React.ReactNode;
  sortControl?: React.ReactNode;
  paidControl?: React.ReactNode;
  paidState?: "paid" | "open" | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const totalColor = toneText[totalTone ?? tone];
  const toggle = () => setOpen((o) => !o);
  const stateClass =
    paidState === "paid"
      ? "border-success/50 shadow-[0_4px_18px_-6px_color-mix(in_oklab,var(--success)_45%,transparent)]"
      : paidState === "open"
        ? "border-warning/50 shadow-[0_4px_18px_-6px_color-mix(in_oklab,var(--warning)_40%,transparent)]"
        : "border-border";
  return (
    <section className={`overflow-hidden rounded-2xl border bg-card ${stateClass}`}>

      {/* Header */}
      <div className="flex flex-col gap-1.5 px-3 py-3 md:px-4 md:py-3.5">
        {/* Linha 1: ícone + título (+ valor/controles no desktop) */}
        <div className="flex items-center gap-2.5 md:gap-3">
          <button onClick={toggle} className="shrink-0" aria-label={open ? "Recolher" : "Expandir"}>
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full ${toneBg[tone]} ${toneText[tone]}`}
            >
              <Icon className="h-4 w-4" />
            </div>
          </button>
          <button onClick={toggle} className="min-w-0 flex-1 text-left">
            <h2 className="truncate text-sm font-bold uppercase tracking-wider">{title}</h2>
            <p className="truncate text-[11px] text-muted-foreground">{description}</p>
          </button>
          {typeof total === "number" && (
            <div className="hidden shrink-0 flex-col items-end md:flex">
              <p className={`text-sm font-bold ${totalColor}`}>{formatCurrency(total)}</p>
              {typeof count === "number" && (
                <p className="text-[10px] text-muted-foreground">
                  {count} {count === 1 ? "item" : "itens"}
                </p>
              )}
            </div>
          )}
          {open && paidControl ? <div className="hidden shrink-0 md:block">{paidControl}</div> : null}
          {open && sortControl ? <div className="hidden shrink-0 md:block">{sortControl}</div> : null}
          <button
            type="button"
            onClick={toggle}
            aria-label={open ? "Recolher" : "Expandir"}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-secondary"
          >
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {/* Linha 2 (mobile only): valor + controles */}
        {(typeof total === "number" || (open && (paidControl || sortControl))) && (
          <div className="flex items-center justify-between gap-2 md:hidden">
            {typeof total === "number" ? (
              <div className="flex flex-col">
                <p className={`text-sm font-bold ${totalColor}`}>{formatCurrency(total)}</p>
                {typeof count === "number" && (
                  <p className="text-[10px] text-muted-foreground">
                    {count} {count === 1 ? "item" : "itens"}
                  </p>
                )}
              </div>
            ) : <div />}
            <div className="flex items-center gap-2">
              {open && paidControl ? <div className="shrink-0">{paidControl}</div> : null}
              {open && sortControl ? <div className="shrink-0">{sortControl}</div> : null}
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      {open && (
        <div className="border-t border-border">
          {headerBar}
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

function SelectionBar({
  count,
  onCancel,
  onDelete,
}: {
  count: number;
  onCancel: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 bg-primary/10 px-3 py-2 md:px-4">
      <p className="text-xs font-semibold text-primary">
        {count} selecionado{count === 1 ? "" : "s"}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={onCancel}
          className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-secondary"
        >
          Cancelar
        </button>
        <button
          onClick={onDelete}
          className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2.5 py-1 text-[11px] font-semibold text-destructive hover:bg-destructive/25"
        >
          <Trash2 className="h-3 w-3" /> Excluir
        </button>
      </div>
    </div>
  );
}


/* ───────── CARD ROW (collapsible card inside CARDS section) ───────── */

type PurchaseList = ReturnType<typeof usePurchases>["data"] extends infer T
  ? T extends Array<infer P>
    ? P[]
    : never
  : never;
type Purchase = PurchaseList[number];
type Card = ReturnType<typeof useCards>["data"] extends infer T
  ? T extends Array<infer C>
    ? C
    : never
  : never;

function CardRowSorted({
  card,
  cardInst,
  purchases,
  total,
  paid,
  paymentPending,
  dueLabel,
  onTogglePaid,
  onAdd,
  onEditCard,
  onToggleInst,
  onEditInst,
  onRemoveInst,
  itemSelProps,
  selectionBar,
  onRequestReorder,
}: {
  card: Card;
  cardInst: Installment[];
  purchases: PurchaseList;
  total: number;
  paid: boolean;
  paymentPending?: boolean;
  dueLabel: string;
  onTogglePaid: () => void;
  onAdd: () => void;
  onEditCard?: () => void;
  onToggleInst: (id: string, paid: boolean) => void;
  onEditInst: (inst: Installment) => void;
  onRemoveInst?: (inst: Installment) => void;
  itemSelProps: (inst: Installment, parentId: string) => SelectionRowProps;
  selectionBar?: React.ReactNode;
  onRequestReorder?: () => void;
}) {
  const { sort, set } = useSortPreference(`card:${card.id}`);
  const sortedItems =
    sort.option === "default"
      ? null
      : applySort(cardInst, sort, {
          name: (i) => {
            const pur = purchases.find((p: Purchase) => p.id === i.parentId);
            return pur?.description ?? "";
          },
          amount: (i) => i.amount,
          date: (i) => i.dueDate,
          id: (i) => i.id,
        });
  return (
    <CardRow
      cardName={card.name}
      cardColor={card.color}
      total={total}
      paid={paid}
      paymentPending={paymentPending}
      count={cardInst.length}
      dueLabel={dueLabel}
      onTogglePaid={onTogglePaid}
      onAdd={onAdd}
      onEditCard={onEditCard}
      items={cardInst}
      purchases={purchases}
      onToggleInst={onToggleInst}
      onEditInst={onEditInst}
      onRemoveInst={onRemoveInst}
      itemSelProps={itemSelProps}
      selectionBar={selectionBar}
      sortedItems={sortedItems}
      onRequestReorder={onRequestReorder}
      sortControl={
        <SortMenu scope={`card:${card.id}`} state={sort} onChange={set} />
      }
    />
  );
}

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
  itemSelProps,
  selectionBar,
  sortControl,
  sortedItems,
  onRequestReorder,
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
  itemSelProps: (inst: Installment, parentId: string) => SelectionRowProps;
  selectionBar?: React.ReactNode;
  sortControl?: React.ReactNode;
  /** When provided, overrides the default sort (parcelled→cash) with this order. */
  sortedItems?: Installment[] | null;
  onRequestReorder?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const lp = useLongPress(() => {
    if (onEditCard || onRequestReorder) setMenuOpen(true);
  });

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: Event) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [menuOpen]);

  const toggle = () => {
    if (lp.didFire()) {
      lp.reset();
      return;
    }
    setOpen((o) => !o);
  };

  return (
    <div className="relative">
      <div
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        {...lp.handlers}
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
          <p className="text-[10px] text-muted-foreground">
            {count} {count === 1 ? "item" : "itens"}
          </p>
        </div>
        {open && (
          <button
            type="button"
            disabled={paymentPending}
            onClick={(e) => {
              e.stopPropagation();
              if (!paymentPending) onTogglePaid();
            }}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
              paid
                ? "bg-success/15 text-success hover:bg-success/25"
                : "bg-warning/15 text-warning hover:bg-warning/25"
            }`}
          >
            {paymentPending ? "Salvando..." : paid ? "✓ Paga" : "Marcar paga"}
          </button>
        )}
        {open && sortControl ? (
          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
            {sortControl}
          </div>
        ) : null}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
          aria-label={open ? "Recolher" : "Expandir"}
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-secondary"
        >
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {menuOpen && (
        <div
          ref={menuRef}
          className="absolute left-4 top-full z-20 mt-1 min-w-[180px] overflow-hidden rounded-xl border border-border bg-popover shadow-lg"
        >
          {onEditCard && (
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onEditCard();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary"
            >
              <Pencil className="h-3.5 w-3.5" /> Editar cartão
            </button>
          )}
          {onRequestReorder && (
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onRequestReorder();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary"
            >
              <GripVertical className="h-3.5 w-3.5" /> Reordenar cartões
            </button>
          )}
        </div>
      )}

      {open && (
        <div className="border-t border-border bg-background/30">
          {selectionBar}

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
              {(sortedItems ?? items)
                .slice()
                .map((inst) => {
                  const pur = purchases.find((p) => p.id === inst.parentId);
                  return { inst, pur };
                })
                .filter((x): x is { inst: typeof items[number]; pur: NonNullable<typeof x.pur> } => !!x.pur)
                .sort((a, b) => {
                  if (sortedItems) return 0; // respect provided order
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
                    {...itemSelProps(inst, inst.parentId)}
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

type SelectionRowProps = {
  selectionMode: boolean;
  selected: boolean;
  onSelectToggle: () => void;
  onLongPress: () => void;
};

function SelectCheckbox({
  selected,
  onClick,
}: {
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border"
      }`}
      aria-label={selected ? "Desmarcar" : "Marcar"}
    >
      {selected && <Check className="h-3.5 w-3.5" />}
    </button>
  );
}

function PurchaseInstRow({
  inst,
  purchase,
  cardColor: _cardColor,
  onToggle,
  onEdit,
  onRemove,
  selectionMode,
  selected,
  onSelectToggle,
  onLongPress,
}: {
  inst: Installment;
  purchase: { description: string; date: string; totalAmount: number; installmentsCount: number };
  cardColor: string;
  onToggle: () => void;
  onEdit: () => void;
  onRemove?: () => void;
} & SelectionRowProps) {
  const lp = useLongPress(onLongPress);
  const guard = (fn: () => void) => (e: React.MouseEvent) => {
    if (lp.didFire()) {
      lp.reset();
      e.preventDefault();
      return;
    }
    if (selectionMode) {
      e.preventDefault();
      onSelectToggle();
      return;
    }
    fn();
  };
  const isInstallment = inst.total > 1;
  return (
    <div
      className="flex items-center gap-2.5 px-3 py-3 md:gap-3 md:px-4"
      {...lp.handlers}
    >
      {selectionMode && <SelectCheckbox selected={selected} onClick={onSelectToggle} />}
      <button onClick={guard(onEdit)} className="min-w-0 flex-1 text-left">
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
      <div className="flex shrink-0 flex-col items-end gap-1">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-bold">{formatCurrency(inst.amount)}</p>
          {isInstallment && (
            <span className="rounded-full bg-credit/15 px-1.5 py-0.5 text-[9px] font-bold text-credit">
              {inst.number}/{inst.total}
            </span>
          )}
        </div>
        <button
          onClick={guard(onToggle)}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors ${
            inst.paid
              ? "bg-success/15 text-success hover:bg-success/25"
              : "bg-secondary text-muted-foreground hover:bg-secondary/70"
          }`}
        >
          {inst.paid ? (
            <>
              <Check className="h-3 w-3" /> Pago
            </>
          ) : (
            "Marcar pago"
          )}
        </button>
      </div>
      {!selectionMode && onRemove && <RemoveInstButton onRemove={onRemove} />}
    </div>
  );
}

function DebitRow({
  debit,
  onToggle,
  onEdit,
  onRemove,
  selectionMode,
  selected,
  onSelectToggle,
  onLongPress,
}: {
  debit: Debit;
  onToggle: () => void;
  onEdit: () => void;
  onRemove: () => void;
} & SelectionRowProps) {
  const lp = useLongPress(onLongPress);
  const guard = (fn: () => void) => (e: React.MouseEvent) => {
    if (lp.didFire()) {
      lp.reset();
      e.preventDefault();
      return;
    }
    if (selectionMode) {
      e.preventDefault();
      onSelectToggle();
      return;
    }
    fn();
  };
  return (
    <div
      className="flex items-center gap-2.5 px-3 py-3 md:gap-3 md:px-4"
      {...lp.handlers}
    >
      {selectionMode && <SelectCheckbox selected={selected} onClick={onSelectToggle} />}
      <button onClick={guard(onEdit)} className="flex-1 min-w-0 text-left">
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
          onClick={guard(onToggle)}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors ${
            debit.paid
              ? "bg-success/15 text-success hover:bg-success/25"
              : "bg-secondary text-muted-foreground hover:bg-secondary/70"
          }`}
        >
          {debit.paid ? (
            <>
              <Check className="h-3 w-3" /> Pago
            </>
          ) : (
            "Marcar pago"
          )}
        </button>
      </div>
      {!selectionMode && (
        <button
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function IncomeRow({
  income,
  onToggle,
  onEdit,
  onRemove,
  selectionMode,
  selected,
  onSelectToggle,
  onLongPress,
}: {
  income: Income;
  onToggle: () => void;
  onEdit: () => void;
  onRemove: () => void;
} & SelectionRowProps) {
  const lp = useLongPress(onLongPress);
  const guard = (fn: () => void) => (e: React.MouseEvent) => {
    if (lp.didFire()) {
      lp.reset();
      e.preventDefault();
      return;
    }
    if (selectionMode) {
      e.preventDefault();
      onSelectToggle();
      return;
    }
    fn();
  };
  return (
    <div
      className="flex items-center gap-2.5 px-3 py-3 md:gap-3 md:px-4"
      {...lp.handlers}
    >
      {selectionMode && <SelectCheckbox selected={selected} onClick={onSelectToggle} />}
      <button onClick={guard(onEdit)} className="flex-1 min-w-0 text-left">
        <div className="flex flex-wrap items-center gap-1.5">
          <p
            className={`truncate text-sm font-semibold ${
              income.received ? "text-muted-foreground" : ""
            }`}
          >
            {income.description}
          </p>
          {income.recurrenceGroupId && (
            <span className="rounded-full bg-success/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-success">
              Obrig.
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {formatDate(income.date)} · {formatCurrency(income.amount)} à vista
        </p>
      </button>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <p className="text-sm font-bold text-success">{formatCurrency(income.amount)}</p>
        <button
          onClick={guard(onToggle)}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors ${
            income.received
              ? "bg-success/15 text-success hover:bg-success/25"
              : "bg-secondary text-muted-foreground hover:bg-secondary/70"
          }`}
        >
          {income.received ? (
            <>
              <Check className="h-3 w-3" /> Recebido
            </>
          ) : (
            "Marcar recebido"
          )}
        </button>
      </div>
      {!selectionMode && (
        <button
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
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
  selectionMode,
  selected,
  onSelectToggle,
  onLongPress,
}: {
  kind: "debit" | "income";
  installment: Installment;
  parent: Debit | Income;
  onToggle: () => void;
  onEdit: () => void;
  onRemove?: () => void;
} & SelectionRowProps) {
  const lp = useLongPress(onLongPress);
  const guard = (fn: () => void) => (e: React.MouseEvent) => {
    if (lp.didFire()) {
      lp.reset();
      e.preventDefault();
      return;
    }
    if (selectionMode) {
      e.preventDefault();
      onSelectToggle();
      return;
    }
    fn();
  };
  const tone = kind === "debit" ? "text-debit" : "text-success";
  const auto = kind === "debit" && (parent as Debit).autoDebit;
  const badgeClass =
    kind === "debit"
      ? "bg-debit/15 text-debit"
      : "bg-success/15 text-success";
  return (
    <div
      className="flex items-center gap-2.5 px-3 py-3 md:gap-3 md:px-4"
      {...lp.handlers}
    >
      {selectionMode && <SelectCheckbox selected={selected} onClick={onSelectToggle} />}
      <button onClick={guard(onEdit)} className="min-w-0 flex-1 text-left">
        <div className="flex flex-wrap items-center gap-1.5">
          <p
            className={`truncate text-sm font-semibold ${
              installment.paid ? "text-muted-foreground line-through" : ""
            }`}
          >
            {parent.description}
          </p>
          {auto && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary">
              <Zap className="h-2.5 w-2.5" />
              Auto
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {formatDate(parent.date)} · {formatCurrency(parent.amount)} em {installment.total}x
        </p>
      </button>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <div className="flex items-center gap-1.5">
          <p className={`text-sm font-bold ${tone}`}>{formatCurrency(installment.amount)}</p>
          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${badgeClass}`}>
            {installment.number}/{installment.total}
          </span>
        </div>
        <button
          onClick={guard(onToggle)}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors ${
            installment.paid
              ? "bg-success/15 text-success hover:bg-success/25"
              : "bg-secondary text-muted-foreground hover:bg-secondary/70"
          }`}
        >
          {installment.paid ? (
            <>
              <Check className="h-3 w-3" /> Pago
            </>
          ) : (
            "Marcar pago"
          )}
        </button>
      </div>
      {!selectionMode && onRemove && (
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

function InvestmentRow({
  inv,
  onEdit,
  onRemove,
  selectionMode,
  selected,
  onSelectToggle,
  onLongPress,
}: {
  inv: Investment;
  onEdit: () => void;
  onRemove: () => void;
} & SelectionRowProps) {
  const lp = useLongPress(onLongPress);
  const guard = (fn: () => void) => (e: React.MouseEvent) => {
    if (lp.didFire()) {
      lp.reset();
      e.preventDefault();
      return;
    }
    if (selectionMode) {
      e.preventDefault();
      onSelectToggle();
      return;
    }
    fn();
  };
  return (
    <div
      className="flex items-center gap-2.5 px-3 py-3 md:gap-3 md:px-4"
      {...lp.handlers}
    >
      {selectionMode ? (
        <SelectCheckbox selected={selected} onClick={onSelectToggle} />
      ) : (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <TrendingUp className="h-3.5 w-3.5" />
        </div>
      )}
      <button onClick={guard(onEdit)} className="flex-1 min-w-0 text-left">
        <p className="truncate text-sm font-semibold capitalize">{inv.type}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{inv.percentage}% rendimento</p>
      </button>
      <p className="text-sm font-bold text-primary">{formatCurrency(inv.amount)}</p>
      {!selectionMode && (
        <button
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
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
