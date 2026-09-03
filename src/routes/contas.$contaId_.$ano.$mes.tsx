import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  useBulkReceiveIncomes,
  useRemoveIncome,
  useAddIncome,
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
  useCompactInstallmentNumbering,
  useDeleteOverScope,
  useDuplicateOverScope,
  useReorderCards,
  resolveScopeMonths,
  useMoveEntriesToMonth,
  resolveSeriesFromOps,
  isSeriesShiftEmpty,
  PAYMENT_METHOD_BADGES,
  type CardScope,
  type Installment,
  type Debit,
  type Income,
  type Investment,
  type DuplicateSource,
  type MoveMonthOp,
} from "@/store/finance";
import { MoveSeriesConfirmDialog } from "@/components/MoveSeriesConfirmDialog";
import { useAccountFilter } from "@/store/account-filter";
import { usePanes, useMaxPanes } from "@/store/panes";
import { MonthYearPicker } from "@/components/MonthYearPicker";
import { HeaderBand } from "@/components/HeaderBand";
import { useBandScrollProgress, useResetScrollOnChange, useAnchorNode } from "@/hooks/use-band-scroll-progress";
import { formatCurrency, MONTHS, formatDate } from "@/lib/format";
import {
  ChevronDown,
  Plus,
  CreditCard,
  ArrowDownRight,
  ArrowUpRight,
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
  ShoppingBag,
  Wallet,
  Copy,
  MoreHorizontal,
  Settings,
  CalendarClock,
  Banknote,
  FileText,
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
import { FabAction, toneText, toneBg, toneWash, type Tone } from "@/components/FabAction";
import { SettingsFabActions } from "@/components/SettingsFabActions";
import { ManageAccountsDialog } from "@/components/ManageAccountsDialog";
import { PaneTabsBar } from "@/components/PaneTabsBar";
import { MoveToMonthDialog } from "@/components/MoveToMonthDialog";

type SelectionKey = "incomes" | "debits" | "investments" | `card:${string}`;

export const Route = createFileRoute("/contas/$contaId_/$ano/$mes")({
  head: ({ params }) => ({
    meta: [
      {
        title: `${MONTHS[Number(params.mes)]} ${params.ano} — Finanças`,
      },
    ],
  }),
  component: AccountMonthRoute,
});

/**
 * Wrapper fino da rota: lê os params da URL e delega pro componente
 * reutilizável `MonthDetailPane`, que também roda embutido dentro de um
 * painel (ver PanesWorkspace em contas.$contaId.tsx) — nesse caso, "voltar"
 * e "trocar de mês" viram troca de estado local em vez de navegação.
 */
function AccountMonthRoute() {
  const { contaId, ano, mes } = Route.useParams();
  const navigate = useNavigate();
  return (
    <MonthDetailPane
      contaId={contaId}
      year={Number(ano)}
      month={Number(mes)}
      onBack={() => navigate({ to: "/contas/$contaId", params: { contaId } })}
      onMonthChange={(y, m) =>
        navigate({
          to: "/contas/$contaId/$ano/$mes",
          params: { contaId, ano: String(y), mes: String(m) },
        })
      }
    />
  );
}

export function MonthDetailPane({
  contaId,
  year,
  month,
  onBack,
  onMonthChange,
  embedded = false,
  fabPortalTarget = null,
  onClose,
}: {
  contaId: string;
  year: number;
  month: number;
  onBack: () => void;
  onMonthChange: (year: number, month: number) => void;
  /**
   * Quando true, roda dentro de um painel do PanesWorkspace — o FAB e seu
   * scrim são renderizados via portal em `fabPortalTarget` (um elemento
   * IRMÃO da área que rola, dentro do mesmo painel) em vez de inline, que
   * usaria `fixed` (preso à tela inteira, por cima de qualquer outro painel).
   */
  embedded?: boolean;
  /** Nó do DOM onde o FAB deve ser portado quando `embedded` — ver PaneSlot em contas.$contaId.tsx. */
  fabPortalTarget?: HTMLDivElement | null;
  /** Só passado quando há mais de 1 painel aberto — fecha este painel inteiro (distinto de "voltar aos meses"). */
  onClose?: () => void;
}) {
  const [bandAnchor, bandAnchorRef] = useAnchorNode<HTMLDivElement>();
  useBandScrollProgress(bandAnchor, { collapseRange: 130, frameRange: 68 });
  useResetScrollOnChange(bandAnchor, [contaId, year, month]);
  const { data: accounts = [] } = useAccounts();
  const { data: cards = [] } = useCards();
  const { data: purchases } = usePurchases();
  const { data: installments } = useInstallments();
  const purchasesList = purchases ?? [];
  const installmentsList = installments ?? [];
  // Only block render on the *initial* load (no cached data yet).
  // Refetches keep the previous data on screen — no "Carregando..." flash.
  const listsReady = purchases !== undefined && installments !== undefined;
  const { data: allDebits = [] } = useDebits();
  const { data: allIncomes = [] } = useIncomes();
  const { data: allInvestments = [] } = useInvestments();
  const { data: cardPayments = {} } = useCardPayments();

  const { setAccountId } = useAccountFilter();
  useEffect(() => setAccountId(contaId), [contaId, setAccountId]);
  const { panes } = usePanes();
  const maxPanes = useMaxPanes();

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
  const bulkReceiveIncomes = useBulkReceiveIncomes();
  const removeIncome = useRemoveIncome();
  const addIncome = useAddIncome();
  const removeInvestment = useRemoveInvestment();
  const reorderCards = useReorderCards();
  const moveEntries = useMoveEntriesToMonth();
  const confirmDialog = useConfirm();

  const [reorderMode, setReorderMode] = useState(false);
  const [reorderIds, setReorderIds] = useState<string[] | null>(null);

  const [openDebit, setOpenDebit] = useState(false);
  const [openIncome, setOpenIncome] = useState(false);
  const [openInvest, setOpenInvest] = useState(false);
  const [openPurchase, setOpenPurchase] = useState(false);
  const [openCard, setOpenCard] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [fabView, setFabView] = useState<"create" | "settings">("create");
  const [manageOpen, setManageOpen] = useState(false);
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const [moveMonthOpen, setMoveMonthOpen] = useState(false);
  const [askMoveSeries, setAskMoveSeries] = useState<{
    ops: MoveMonthOp[];
    year: number;
    month: number;
  } | null>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  /** Quando um item é aberto via ícone de duplicar (em vez de editar), pula direto pro fluxo de duplicar. */
  const [rowStartAction, setRowStartAction] = useState<"duplicate" | undefined>(undefined);
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
  const compactInstallments = useCompactInstallmentNumbering();
  const deleteOverScope = useDeleteOverScope();
  const duplicateOverScope = useDuplicateOverScope();

  // Diálogo único "Aplicar em" reutilizado por todas as exclusões.
  const [scopeDelete, setScopeDelete] = useState<{
    title: string;
    description?: React.ReactNode;
    execute: (scope: CardScope) => Promise<void>;
    availableMonths?: Array<{ year: number; month: number }>;
  } | null>(null);

  /** Abre o "Aplicar em" para uma compra/débito/recebimento parcelado. */
  const askDeleteParcelled = (
    parentId: string,
    parentType: "purchase" | "debit" | "income" | "investment",
    label: string,
  ) => {
    const months = (installments ?? [])
      .filter((i) => i.parentId === parentId && i.parentType === parentType)
      .map((i) => ({ year: i.year, month: i.month }));
    setScopeDelete({
      title:
        parentType === "purchase"
          ? "Excluir compra parcelada"
          : parentType === "debit"
            ? "Excluir débito parcelado"
            : parentType === "investment"
              ? "Excluir investimento parcelado"
              : "Excluir recebimento parcelado",
      description: (
        <>
          Você está excluindo <span className="font-semibold text-foreground">{label}</span>.
        </>
      ),
      execute: async (scope) => {
        const result = await deleteParcelledScoped.mutateAsync({ parentId, parentType, scope });
        if (result?.hasGap && result.remainingCount > 0) {
          const renumber = await confirmDialog({
            title: "Renumerar parcelas restantes?",
            description: `Restaram ${result.remainingCount} parcela(s) com numeração fora de sequência. Deseja renumerá-las automaticamente (1..${result.remainingCount})?`,
            confirmLabel: "Renumerar",
            cancelLabel: "Manter como está",
          });
          if (renumber) {
            await compactInstallments.mutateAsync({ parentId, parentType });
          }
        }
      },
      availableMonths: months.length > 0 ? months : undefined,
    });
  };

  /** Abre o "Aplicar em" para uma série recorrente (débito/recebimento/compra). */
  const askDeleteRecurring = (
    kind: "debit" | "income" | "purchase" | "investment",
    groupId: string,
    label: string,
    target: { cardId?: string; accountId?: string; amount?: number },
  ) => {
    setScopeDelete({
      title:
        kind === "debit"
          ? "Excluir débito recorrente"
          : kind === "income"
            ? "Excluir recebimento recorrente"
            : kind === "investment"
              ? "Excluir investimento recorrente"
              : "Excluir compra recorrente",
      description: (
        <>
          Você está excluindo a série <span className="font-semibold text-foreground">{label}</span>
          .
        </>
      ),
      // Usa sempre useDeleteOverScope: além de apagar as linhas, ele grava
      // "tombstones" (recurring_deletions) para o(s) mês(es) excluído(s), o
      // que impede useEnsureRecurringForMonth de recriar o lançamento
      // (parcelado/recorrente/débito automático) ao reabrir o app.
      execute: async (scope) => {
        const source =
          kind === "purchase"
            ? {
                kind: "purchase" as const,
                cardId: target.cardId!,
                description: label,
                amount: 0,
                groupId,
              }
            : kind === "investment"
              ? {
                  kind: "investment" as const,
                  accountId: target.accountId!,
                  type: label,
                  amount: target.amount ?? 0,
                  groupId,
                }
              : {
                  kind,
                  accountId: target.accountId!,
                  description: label,
                  amount: target.amount ?? 0,
                  groupId,
                };
        await deleteOverScope.mutateAsync({
          source,
          scope,
          anchorYear: year,
          anchorMonth: month,
        });
      },
    });
  };

  /** Abre o "Aplicar em" para um lançamento avulso (ex.: débito automático): só este mês ou tudo. */
  const askDeleteSingle = (
    id: string,
    parentType: "purchase" | "debit" | "income",
    label: string,
    date: string,
  ) => {
    setScopeDelete({
      title:
        parentType === "debit"
          ? "Excluir débito"
          : parentType === "income"
            ? "Excluir recebimento"
            : "Excluir compra",
      description: (
        <>
          Você está excluindo <span className="font-semibold text-foreground">{label}</span>.
        </>
      ),
      execute: async (scope) => {
        const [iy, im] = date.slice(0, 10).split("-").map(Number);
        const targets = resolveScopeMonths(scope, year, month);
        const withinScope = targets.some((t) => t.year === iy && t.month === im - 1);
        if (!withinScope) return;
        if (parentType === "debit") await removeDebit.mutateAsync(id);
        else if (parentType === "income") await removeIncome.mutateAsync(id);
        else await removePurchase.mutateAsync(id);
      },
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
  const clearSelection = () => {
    setSelection(null);
    setBulkMenuOpen(false);
  };

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

  /** Duplica os itens selecionados como cópias avulsas no mês corrente (sem diálogo de escopo). */
  const bulkDuplicate = async (key: SelectionKey) => {
    if (!selection || selection.key !== key) return;
    const ids = Array.from(selection.ids);
    const scope: CardScope = { kind: "month", year, month };
    const dup = (source: DuplicateSource) =>
      duplicateOverScope.mutateAsync({ source, scope, anchorYear: year, anchorMonth: month });
    if (key === "incomes") {
      for (const id of ids) {
        const i = allIncomes.find((x) => x.id === id);
        if (!i) continue;
        await dup({
          kind: "income",
          accountId: i.accountId,
          description: i.description,
          amount: i.amount,
          date: i.date,
          received: i.received,
          paymentMethod: i.paymentMethod,
        });
      }
    } else if (key === "debits") {
      for (const id of ids) {
        const d = allDebits.find((x) => x.id === id);
        if (!d) continue;
        await dup({
          kind: "debit",
          accountId: d.accountId,
          description: d.description,
          amount: d.amount,
          date: d.date,
          required: false,
          paid: d.paid,
          paymentMethod: d.paymentMethod,
          autoDebitDay: d.autoDebitDay,
        });
      }
    } else if (key === "investments") {
      for (const id of ids) {
        const v = allInvestments.find((x) => x.id === id);
        if (!v) continue;
        await dup({
          kind: "investment",
          accountId: v.accountId,
          type: v.type,
          amount: v.amount,
          percentage: v.percentage,
          date: v.date,
        });
      }
    } else if (key.startsWith("card:")) {
      for (const id of ids) {
        const p = purchasesList.find((x) => x.id === id);
        if (!p) continue;
        await dup({
          kind: "purchase",
          cardId: p.cardId,
          description: p.description,
          totalAmount: p.totalAmount,
          date: p.date,
        });
      }
    }
    clearSelection();
  };

  /**
   * Gera um recebimento avulso equivalente a cada débito/compra selecionado
   * (ex.: emprestou o cartão pra alguém que parcelou uma compra — em vez de
   * lançar manualmente o recebimento todo mês, seleciona a parcela da fatura
   * daquele mês e gera o recebível correspondente). Só disponível nas seções
   * de débitos e cartões (ver botão condicional mais abaixo).
   * Usa o valor/data da parcela deste mês quando o item é parcelado/recorrente
   * ou de cartão; senão usa o valor/data do lançamento avulso.
   */
  const bulkGenerateReceivable = async (key: SelectionKey) => {
    if (!selection || selection.key !== key) return;
    if (key !== "debits" && !key.startsWith("card:")) return;
    const ids = Array.from(selection.ids);
    const instFor = (parentType: "debit" | "purchase", parentId: string) =>
      installmentsList.find(
        (i) =>
          i.parentType === parentType &&
          i.parentId === parentId &&
          i.year === year &&
          i.month === month,
      );
    for (const id of ids) {
      let description: string;
      let amount: number;
      let date: string;
      if (key === "debits") {
        const d = allDebits.find((x) => x.id === id);
        if (!d) continue;
        if (d.isParent) {
          const inst = instFor("debit", id);
          if (!inst) continue;
          amount = inst.amount;
          date = inst.referenceDate ?? inst.dueDate;
        } else {
          amount = d.amount;
          date = d.date;
        }
        description = d.description;
      } else {
        const pur = purchasesList.find((x) => x.id === id);
        if (!pur) continue;
        const inst = instFor("purchase", id);
        if (!inst) continue;
        amount = inst.amount;
        date = inst.referenceDate ?? inst.dueDate;
        description = pur.description;
      }
      await addIncome.mutateAsync({ accountId: contaId, description, amount, date });
    }
    clearSelection();
  };

  const selectionSectionLabel = (key: SelectionKey) => {
    if (key === "incomes") return "Recebimentos";
    if (key === "debits") return "Débitos";
    if (key === "investments") return "Investimentos";
    const cardId = key.slice("card:".length);
    const card = accountCards.find((c) => c.id === cardId);
    return card ? `Compras — ${card.name}` : "Compras";
  };

  /** Resolve cada id selecionado para uma linha de relatório (descrição/data/valor/status),
   *  usando o valor/data da parcela deste mês quando o item é parcelado/de cartão. */
  const resolveSelectionRows = (key: SelectionKey, ids: string[]) => {
    const instFor = (
      parentType: "debit" | "income" | "investment" | "purchase",
      parentId: string,
    ) =>
      installmentsList.find(
        (i) =>
          i.parentType === parentType &&
          i.parentId === parentId &&
          i.year === year &&
          i.month === month,
      );
    const rows: { description: string; date: string; amount: number; status: string }[] = [];
    if (key === "incomes") {
      for (const id of ids) {
        const i = allIncomes.find((x) => x.id === id);
        if (!i) continue;
        if (i.isParent) {
          const inst = instFor("income", id);
          if (!inst) continue;
          rows.push({
            description: i.description,
            date: inst.referenceDate ?? inst.dueDate,
            amount: inst.amount,
            status: inst.paid ? "Recebido" : "Pendente",
          });
        } else {
          rows.push({
            description: i.description,
            date: i.date,
            amount: i.amount,
            status: i.received ? "Recebido" : "Pendente",
          });
        }
      }
    } else if (key === "debits") {
      for (const id of ids) {
        const d = allDebits.find((x) => x.id === id);
        if (!d) continue;
        if (d.isParent) {
          const inst = instFor("debit", id);
          if (!inst) continue;
          rows.push({
            description: d.description,
            date: inst.referenceDate ?? inst.dueDate,
            amount: inst.amount,
            status: inst.paid ? "Pago" : "Pendente",
          });
        } else {
          rows.push({
            description: d.description,
            date: d.date,
            amount: d.amount,
            status: d.paid ? "Pago" : "Pendente",
          });
        }
      }
    } else if (key === "investments") {
      for (const id of ids) {
        const v = allInvestments.find((x) => x.id === id);
        if (!v) continue;
        if (v.isParent) {
          const inst = instFor("investment", id);
          if (!inst) continue;
          rows.push({
            description: v.type,
            date: inst.referenceDate ?? inst.dueDate,
            amount: inst.amount,
            status: "",
          });
        } else {
          rows.push({ description: v.type, date: v.date, amount: v.amount, status: "" });
        }
      }
    } else if (key.startsWith("card:")) {
      for (const id of ids) {
        const pur = purchasesList.find((x) => x.id === id);
        if (!pur) continue;
        const inst = instFor("purchase", id);
        if (!inst) continue;
        rows.push({
          description: pur.description,
          date: inst.referenceDate ?? inst.dueDate,
          amount: inst.amount,
          status: inst.paid ? "Pago" : "Pendente",
        });
      }
    }
    return rows.sort((a, b) => a.date.localeCompare(b.date));
  };

  /**
   * Gera e baixa um PDF com os itens selecionados (descrição/data/status/valor) e o total.
   * jsPDF (~475kB) é importado dinamicamente aqui para não pesar o bundle da
   * rota do mês, que carrega sempre — só baixa quando o usuário realmente
   * clica em "Gerar PDF".
   */
  const bulkGeneratePdf = async (key: SelectionKey) => {
    if (!selection || selection.key !== key) return;
    const rows = resolveSelectionRows(key, Array.from(selection.ids));
    if (rows.length === 0) return;
    const total = rows.reduce((s, r) => s + r.amount, 0);
    const title = selectionSectionLabel(key);
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(title, 14, 16);
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text(`${account?.name ?? ""} · ${MONTHS[month]} ${year}`, 14, 22);
    autoTable(doc, {
      startY: 28,
      head: [["Descrição", "Data", "Status", "Valor"]],
      body: rows.map((r) => [r.description, formatDate(r.date), r.status, formatCurrency(r.amount)]),
      foot: [["", "", "Total", formatCurrency(total)]],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [16, 122, 87] },
      footStyles: { fillColor: [240, 240, 240], textColor: [20, 20, 20], fontStyle: "bold" },
    });
    const safeTitle = title.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w-]+/g, "_");
    doc.save(`${safeTitle}_${MONTHS[month]}_${year}.pdf`);
    clearSelection();
  };

  /**
   * Resolve os ids selecionados (sempre o id da linha "pai" — débito/
   * recebimento/investimento/compra, ver `selProps`) para as operações
   * concretas que `useMoveEntriesToMonth` sabe executar:
   *  - avulso OU uma ocorrência isolada de recorrente (`isParent === false`)
   *    → move a própria linha ("single").
   *  - parcelado (`isParent === true`) ou compra de cartão (sempre via
   *    installment, mesmo 1x) → move só a parcela deste mês
   *    ("installment") — as demais parcelas da série ficam onde estão.
   */
  const resolveMoveOps = (key: SelectionKey, ids: string[]): MoveMonthOp[] => {
    const ops: MoveMonthOp[] = [];
    const instFor = (
      parentType: "debit" | "income" | "investment" | "purchase",
      parentId: string,
    ) =>
      installmentsList.find(
        (i) =>
          i.parentType === parentType &&
          i.parentId === parentId &&
          i.year === year &&
          i.month === month,
      );
    if (key === "incomes") {
      for (const id of ids) {
        const i = allIncomes.find((x) => x.id === id);
        if (!i) continue;
        if (i.isParent) {
          const inst = instFor("income", id);
          if (inst) ops.push({ kind: "installment", id: inst.id });
        } else {
          ops.push({ kind: "single", table: "incomes", id });
        }
      }
    } else if (key === "debits") {
      for (const id of ids) {
        const d = allDebits.find((x) => x.id === id);
        if (!d) continue;
        if (d.isParent) {
          const inst = instFor("debit", id);
          if (inst) ops.push({ kind: "installment", id: inst.id });
        } else {
          ops.push({ kind: "single", table: "debits", id });
        }
      }
    } else if (key === "investments") {
      for (const id of ids) {
        const v = allInvestments.find((x) => x.id === id);
        if (!v) continue;
        if (v.isParent) {
          const inst = instFor("investment", id);
          if (inst) ops.push({ kind: "installment", id: inst.id });
        } else {
          ops.push({ kind: "single", table: "investments", id });
        }
      }
    } else if (key.startsWith("card:")) {
      for (const id of ids) {
        const inst = instFor("purchase", id);
        if (inst) ops.push({ kind: "installment", id: inst.id });
      }
    }
    return ops;
  };

  const seriesResolveData = {
    purchases: purchasesList,
    installments: installmentsList,
    debits: allDebits,
    incomes: allIncomes,
    investments: allInvestments,
  };

  /** Quantas linhas (parcelas/ocorrências) uma série resolvida abrange ao todo. */
  const countSeriesRows = (ids: ReturnType<typeof resolveSeriesFromOps>["ids"]) => {
    let n = 0;
    for (const pid of ids.purchaseIds)
      n += installmentsList.filter((i) => i.parentType === "purchase" && i.parentId === pid).length;
    for (const pid of ids.debitParentIds)
      n += installmentsList.filter((i) => i.parentType === "debit" && i.parentId === pid).length;
    for (const pid of ids.incomeParentIds)
      n += installmentsList.filter((i) => i.parentType === "income" && i.parentId === pid).length;
    for (const pid of ids.investmentParentIds)
      n += installmentsList.filter((i) => i.parentType === "investment" && i.parentId === pid).length;
    for (const gid of ids.recurringGroups.purchases)
      n += purchasesList.filter((p) => p.recurrenceGroupId === gid).length;
    for (const gid of ids.recurringGroups.debits)
      n += allDebits.filter((d) => d.recurrenceGroupId === gid && !d.isParent).length;
    for (const gid of ids.recurringGroups.incomes)
      n += allIncomes.filter((i) => i.recurrenceGroupId === gid && !i.isParent).length;
    for (const gid of ids.recurringGroups.investments)
      n += allInvestments.filter((v) => v.recurrenceGroupId === gid && !v.isParent).length;
    return n;
  };

  const runMove = async (
    ops: MoveMonthOp[],
    targetYear: number,
    targetMonth: number,
    expandSeries: boolean,
  ) => {
    if (expandSeries) {
      const { ids, standaloneOps } = resolveSeriesFromOps(ops, seriesResolveData);
      const deltaMonths = targetYear * 12 + targetMonth - (year * 12 + month);
      await moveEntries.mutateAsync({
        ops: standaloneOps,
        year: targetYear,
        month: targetMonth,
        seriesShift: { ids, deltaMonths },
      });
    } else if (ops.length > 0) {
      await moveEntries.mutateAsync({ ops, year: targetYear, month: targetMonth });
    }
    clearSelection();
    setMoveMonthOpen(false);
    setAskMoveSeries(null);
  };

  const bulkMove = async (targetYear: number, targetMonth: number) => {
    if (!selection) return;
    const ops = resolveMoveOps(selection.key, Array.from(selection.ids));
    if (ops.length === 0) {
      clearSelection();
      setMoveMonthOpen(false);
      return;
    }
    const { ids } = resolveSeriesFromOps(ops, seriesResolveData);
    if (!isSeriesShiftEmpty(ids)) {
      setMoveMonthOpen(false);
      setAskMoveSeries({ ops, year: targetYear, month: targetMonth });
      return;
    }
    await runMove(ops, targetYear, targetMonth, false);
  };

  const askDeleteInst = (
    _inst: Installment,
    label: string,
    parentType: "purchase" | "debit" | "income" | "investment",
    parentId: string,
  ) => askDeleteParcelled(parentId, parentType, label);

  /**
   * Exclusão de compra no cartão:
   * - parceladas (>1x) → diálogo de escopo (este mês / período / tudo)
   * - 1x → confirmação simples + remove
   */
  const askDeletePurchase = async (pur: {
    id: string;
    cardId: string;
    description: string;
    installmentsCount: number;
    recurrenceGroupId?: string | null;
  }) => {
    if (pur.recurrenceGroupId) {
      askDeleteRecurring("purchase", pur.recurrenceGroupId, pur.description, {
        cardId: pur.cardId,
      });
      return;
    }
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
    () => cards.filter((c) => c.accountId === contaId && isCardVisibleInMonth(c, year, month)),
    [cards, contaId, year, month],
  );

  const accountCardIds = new Set(accountCards.map((c) => c.id));
  const debits = allDebits.filter((d) => d.accountId === contaId);
  const incomes = allIncomes.filter((i) => i.accountId === contaId);
  const investmentsAcc = allInvestments.filter((i) => i.accountId === contaId);
  const monthInvestments = getMonthInvestments(investmentsAcc, installmentsList, year, month);

  const visiblePurchaseIds = new Set(
    purchasesList.filter((p) => accountCardIds.has(p.cardId)).map((p) => p.id),
  );

  const monthInst = getMonthInstallments(installmentsList, year, month).filter((i) =>
    i.parentType === "purchase" ? visiblePurchaseIds.has(i.parentId) : true,
  );
  const monthDebits = getMonthDebits(debits, installmentsList, year, month);
  const monthIncomes = getMonthIncomes(incomes, installmentsList, year, month);

  // Ordem desejada para todas as listas: recorrentes → parcelados → à vista.
  // Dentro de cada grupo, ordenar por data (asc) com desempate estável por id.
  const byDateAsc = <T extends { date: string; id: string }>(a: T, b: T) =>
    a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
  // Ordena parcelas pela data da COMPRA original (parent.date) — não pela
  // data da fatura (dueDate) — para que a ordem bata com o que é exibido.
  const byParcelDateAsc =
    <T extends { installment: { parentId: string; number: number; id: string } }>(
      dateOf: (t: T) => string,
    ) =>
    (a: T, b: T) =>
      dateOf(a).localeCompare(dateOf(b)) ||
      a.installment.parentId.localeCompare(b.installment.parentId) ||
      a.installment.number - b.installment.number ||
      a.installment.id.localeCompare(b.installment.id);

  // "Fixos" = recorrentes + débito automático (nos débitos) e recorrentes (nos recebimentos).
  const debitsFixedSingle = monthDebits.single
    .filter((d) => !!d.recurrenceGroupId || d.paymentMethod === "auto_debit" || d.required)
    .slice()
    .sort(byDateAsc);
  const debitsCash = monthDebits.single
    .filter((d) => !d.recurrenceGroupId && d.paymentMethod !== "auto_debit" && !d.required)
    .slice()
    .sort(byDateAsc);
  const debitsParcelled = monthDebits.parcelled.slice().sort(byParcelDateAsc((p) => p.debit.date));
  const debitsAllPaid =
    monthDebits.single.length + monthDebits.parcelled.length > 0 &&
    monthDebits.single.every((d) => d.paid) &&
    monthDebits.parcelled.every((p) => p.installment.paid);
  const incomesAllReceived =
    monthIncomes.single.length + monthIncomes.parcelled.length > 0 &&
    monthIncomes.single.every((i) => i.received) &&
    monthIncomes.parcelled.every((p) => p.installment.paid);

  const incomesFixedSingle = monthIncomes.single
    .filter((i) => !!i.recurrenceGroupId)
    .slice()
    .sort(byDateAsc);
  const incomesCash = monthIncomes.single
    .filter((i) => !i.recurrenceGroupId)
    .slice()
    .sort(byDateAsc);
  const incomesParcelled = monthIncomes.parcelled
    .slice()
    .sort(byParcelDateAsc((p) => p.income.date));

  const investmentsFixedSingle = monthInvestments.single
    .filter((i) => !!i.recurrenceGroupId)
    .slice()
    .sort(byDateAsc);
  const investmentsCash = monthInvestments.single
    .filter((i) => !i.recurrenceGroupId)
    .slice()
    .sort(byDateAsc);
  const investmentsParcelled = monthInvestments.parcelled
    .slice()
    .sort(byParcelDateAsc((p) => p.investment.date));

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
  type InvestmentEntry =
    | { kind: "single"; investment: Investment }
    | { kind: "parcelled"; entry: (typeof investmentsParcelled)[number] };

  // Ordem padrão: mescla recorrentes + parcelados + débito automático
  // em um único grupo ordenado por data; à-vista fica ao final.
  const debitsFixedMerged: DebitEntry[] = [
    ...debitsFixedSingle.map<DebitEntry>((d) => ({ kind: "single", debit: d })),
    ...debitsParcelled.map<DebitEntry>((p) => ({ kind: "parcelled", entry: p })),
  ].sort((a, b) => {
    const da = a.kind === "single" ? a.debit.date : a.entry.debit.date;
    const db = b.kind === "single" ? b.debit.date : b.entry.debit.date;
    const ia = a.kind === "single" ? a.debit.id : a.entry.installment.id;
    const ib = b.kind === "single" ? b.debit.id : b.entry.installment.id;
    return da.localeCompare(db) || ia.localeCompare(ib);
  });
  const debitsDefaultOrder: DebitEntry[] = [
    ...debitsFixedMerged,
    ...debitsCash.map<DebitEntry>((d) => ({ kind: "single", debit: d })),
  ];
  const debitsOrdered =
    debitsSort.sort.option === "default"
      ? debitsDefaultOrder
      : applySort(debitsDefaultOrder, debitsSort.sort, {
          name: (e) => (e.kind === "single" ? e.debit.description : e.entry.debit!.description),
          amount: (e) => (e.kind === "single" ? e.debit.amount : e.entry.installment.amount),
          date: (e) => (e.kind === "single" ? e.debit.date : e.entry.debit.date),
          id: (e) => (e.kind === "single" ? e.debit.id : e.entry.installment.id),
        });

  const incomesFixedMerged: IncomeEntry[] = [
    ...incomesFixedSingle.map<IncomeEntry>((i) => ({ kind: "single", income: i })),
    ...incomesParcelled.map<IncomeEntry>((p) => ({ kind: "parcelled", entry: p })),
  ].sort((a, b) => {
    const da = a.kind === "single" ? a.income.date : a.entry.income.date;
    const db = b.kind === "single" ? b.income.date : b.entry.income.date;
    const ia = a.kind === "single" ? a.income.id : a.entry.installment.id;
    const ib = b.kind === "single" ? b.income.id : b.entry.installment.id;
    return da.localeCompare(db) || ia.localeCompare(ib);
  });
  const incomesDefaultOrder: IncomeEntry[] = [
    ...incomesFixedMerged,
    ...incomesCash.map<IncomeEntry>((i) => ({ kind: "single", income: i })),
  ];
  const incomesOrdered =
    incomesSort.sort.option === "default"
      ? incomesDefaultOrder
      : applySort(incomesDefaultOrder, incomesSort.sort, {
          name: (e) => (e.kind === "single" ? e.income.description : e.entry.income!.description),
          amount: (e) => (e.kind === "single" ? e.income.amount : e.entry.installment.amount),
          date: (e) => (e.kind === "single" ? e.income.date : e.entry.income.date),
          id: (e) => (e.kind === "single" ? e.income.id : e.entry.installment.id),
        });

  const investmentsFixedMerged: InvestmentEntry[] = [
    ...investmentsFixedSingle.map<InvestmentEntry>((i) => ({ kind: "single", investment: i })),
    ...investmentsParcelled.map<InvestmentEntry>((p) => ({ kind: "parcelled", entry: p })),
  ].sort((a, b) => {
    const da = a.kind === "single" ? a.investment.date : a.entry.investment.date;
    const db = b.kind === "single" ? b.investment.date : b.entry.investment.date;
    const ia = a.kind === "single" ? a.investment.id : a.entry.installment.id;
    const ib = b.kind === "single" ? b.investment.id : b.entry.installment.id;
    return da.localeCompare(db) || ia.localeCompare(ib);
  });
  const investmentsDefaultOrder: InvestmentEntry[] = [
    ...investmentsFixedMerged,
    ...investmentsCash.map<InvestmentEntry>((i) => ({ kind: "single", investment: i })),
  ];
  const investmentsOrdered =
    investmentsSort.sort.option === "default"
      ? investmentsDefaultOrder
      : applySort(investmentsDefaultOrder, investmentsSort.sort, {
          name: (e) => (e.kind === "single" ? e.investment.type : e.entry.investment!.type),
          amount: (e) => (e.kind === "single" ? e.investment.amount : e.entry.installment.amount),
          date: (e) => (e.kind === "single" ? e.investment.date : e.entry.investment.date),
          id: (e) => (e.kind === "single" ? e.investment.id : e.entry.installment.id),
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
  const totalInvested =
    monthInvestments.single.reduce((s, i) => s + i.amount, 0) +
    monthInvestments.parcelled.reduce((s, p) => s + p.installment.amount, 0);

  // Totais pagos/recebidos: só contabiliza itens marcados (paid/received = true).
  // Itens não marcados valem 0 -- não entram negativos.
  const totalIncomeNet =
    monthIncomes.single.reduce((s, i) => s + (i.received ? i.amount : 0), 0) +
    monthIncomes.parcelled.reduce((s, p) => s + (p.installment.paid ? p.installment.amount : 0), 0);
  const totalDebitsNet =
    monthDebits.single.reduce((s, d) => s + (d.paid ? d.amount : 0), 0) +
    monthDebits.parcelled.reduce((s, p) => s + (p.installment.paid ? p.installment.amount : 0), 0);
  const totalCardsNet = monthInst
    .filter((i) => i.parentType === "purchase")
    .reduce((s, i) => s + (i.paid ? i.amount : 0), 0);

  // Saldo Atual = saldo final do mês anterior + recebíveis do mês atual
  const saldoAtual = (() => {
    if (!account) return 0;
    const monthly = computeMonthlyAccountBalance(
      account,
      cards,
      purchasesList,
      installmentsList,
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

  if (!account || !listsReady) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-12 text-center text-muted-foreground">
        {!account ? "Conta não encontrada." : "Carregando..."}
      </div>
    );
  }

  const prevMonth = month === 0 ? { y: year - 1, m: 11 } : { y: year, m: month - 1 };
  const nextMonth = month === 11 ? { y: year + 1, m: 0 } : { y: year, m: month + 1 };

  return (
    <div>
      {!embedded && maxPanes > 1 && panes.length > 0 && (
        <div className="hidden items-center border-b border-border/60 bg-muted px-4 py-2 md:flex md:px-6">
          <PaneTabsBar />
        </div>
      )}
      {/* Top nav — sticky so the year picker stays accessible while scrolling.
          Quando embutido num painel, o cabeçalho da conta (ícone/nome/saldo)
          já aparece logo acima (AccountPane) — repetir o nome aqui só duplicaria. */}
      <div ref={bandAnchorRef} className={`sticky top-0 z-10 ${embedded ? "" : "relative"}`}>
        <HeaderBand
          collapsible
          title="Lançamentos"
          eyebrow={account?.name}
          onBack={onBack}
          onClose={onClose}
          right={
            <MonthYearPicker
              contaId={contaId}
              year={year}
              month={month}
              prev={prevMonth}
              next={nextMonth}
              onNavigate={onMonthChange}
            />
          }
        />
      </div>

      <div className="mx-auto max-w-5xl px-4 pb-6 md:px-6 md:pb-10">
      {/* Frame com saldo atual e gastos totais */}
      <MonthSummaryFrame
        saldoAtual={normalizeZero(saldoAtual)}
        gastosTotais={normalizeZero(totalDebits + totalInvested + totalCards)}
      />

      {/* Stacked sections — order: Recebimentos → Investimentos → Débitos → Cartões.
          pb-24 reserva o espaço do FAB no fim da lista, pra ele nunca cobrir
          o último card ao rolar até embaixo. */}
      <div className="mt-4 space-y-4 pb-24">
        {/* CONTA CORRENTE header — recebimentos, débitos e investimentos são
            todos movimentação da mesma conta corrente, por isso o cabeçalho
            vem antes de recebimentos (não só entre investimentos/débitos). */}
        <div className="flex items-center justify-between gap-3 px-1">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold uppercase tracking-wider">CONTA CORRENTE</h2>
            <p className="truncate text-[11px] text-muted-foreground">
              Recebimentos − débitos − investimentos
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p
              className={`text-sm font-bold ${
                totalIncomeNet - totalDebits - totalInvested >= 0
                  ? "text-foreground"
                  : "text-destructive"
              }`}
            >
              {formatCurrency(totalIncomeNet - totalDebits - totalInvested)}
            </p>
          </div>
        </div>

        {/* INCOMES */}
        <GroupedSection
          icon={Download}
          title="RECEBIMENTOS"
          description="Entradas de dinheiro na conta"
          tone="income"
          total={totalIncomeNet}
          count={monthIncomes.single.length + monthIncomes.parcelled.length}
          paidState={incomesAllReceived ? "paid" : null}
          empty={monthIncomes.single.length === 0 && monthIncomes.parcelled.length === 0}
          emptyText="Nenhum recebimento neste mês."
          sortControl={
            <SortMenu scope="incomes" state={incomesSort.sort} onChange={incomesSort.set} />
          }
          paidControl={
            !isSelMode("incomes") &&
            monthIncomes.single.length + monthIncomes.parcelled.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  const target = !incomesAllReceived;
                  bulkReceiveIncomes.mutate({
                    incomeIds: monthIncomes.single
                      .filter((i) => i.received !== target)
                      .map((i) => i.id),
                    installmentIds: monthIncomes.parcelled
                      .filter((p) => p.installment.paid !== target)
                      .map((p) => p.installment.id),
                    received: target,
                  });
                }}
                className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                  incomesAllReceived
                    ? "bg-success/15 text-success hover:bg-success/25"
                    : "bg-warning/15 text-warning hover:bg-warning/25"
                }`}
              >
                {incomesAllReceived ? "✓ Recebido" : "Marcar recebido"}
              </button>
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
                      onDeleteParent: () =>
                        askDeleteParcelled(p.income!.id, "income", p.income!.description),
                      parentSource: {
                        kind: "income",
                        accountId: p.income!.accountId,
                        description: p.income!.description,
                        amount: p.income!.amount,
                        date: p.income!.date,
                        paymentMethod: p.income!.paymentMethod,
                      },
                    })
                  }
                  onRemove={() =>
                    askDeleteInst(p.installment, p.income!.description, "income", p.income!.id)
                  }
                  {...selProps("incomes", p.income!.id)}
                />
              );
            }
            const i = e.income;
            const isRecurring = !!i.recurrenceGroupId;
            const openIncomeEdit = () => {
              if (isRecurring) {
                setEditingRecurring({
                  kind: "income",
                  id: i.id,
                  groupId: i.recurrenceGroupId!,
                  description: i.description,
                  amount: i.amount,
                  date: i.date,
                  accountId: i.accountId,
                  notifyDaysBefore: i.notifyDaysBefore,
                  paymentMethod: i.paymentMethod === "auto_debit" ? null : i.paymentMethod,
                  paid: i.received,
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
                    notifyDaysBefore: i.notifyDaysBefore,
                    paymentMethod: i.paymentMethod,
                  },
                  onDeleteParent: () => removeIncome.mutate(i.id),
                });
              }
            };
            return (
              <IncomeRow
                key={i.id}
                income={i}
                onToggle={() => toggleIncome.mutate({ id: i.id, received: !i.received })}
                onEdit={openIncomeEdit}
                onDuplicate={() => {
                  setRowStartAction("duplicate");
                  openIncomeEdit();
                }}
                onRemove={
                  isRecurring
                    ? () =>
                        askDeleteRecurring("income", i.recurrenceGroupId!, i.description, {
                          accountId: i.accountId,
                          amount: i.amount,
                        })
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

        {/* INVESTMENTS */}
        <GroupedSection
          icon={TrendingUp}
          title="INVESTIMENTOS"
          description="Aplicações e resgates"
          tone="primary"
          total={totalInvested}
          count={monthInvestments.single.length + monthInvestments.parcelled.length}
          defaultOpen={false}
          empty={monthInvestments.single.length === 0 && monthInvestments.parcelled.length === 0}
          emptyText="Nenhum investimento nesta conta."
          sortControl={
            <SortMenu
              scope="investments"
              state={investmentsSort.sort}
              onChange={investmentsSort.set}
            />
          }
        >
          {investmentsOrdered.map((e) => {
            if (e.kind === "parcelled") {
              const p = e.entry;
              return (
                <ParcelledRow
                  key={p.installment.id}
                  kind="investment"
                  installment={p.installment}
                  parent={p.investment!}
                  onToggle={() => {}}
                  onEdit={() =>
                    setEditing({
                      inst: p.installment,
                      label: p.investment!.type,
                      subtitle: `Investimento parcelado · Total ${formatCurrency(p.investment!.amount)} em ${p.investment!.installmentsCount}x`,
                      onDeleteParent: () =>
                        askDeleteParcelled(p.investment!.id, "investment", p.investment!.type),
                      parentSource: {
                        kind: "investment",
                        accountId: p.investment!.accountId,
                        type: p.investment!.type,
                        amount: p.investment!.amount,
                        percentage: p.investment!.percentage,
                        date: p.investment!.date,
                      },
                    })
                  }
                  onRemove={() =>
                    askDeleteInst(p.installment, p.investment!.type, "investment", p.investment!.id)
                  }
                  {...selProps("investments", p.investment!.id)}
                />
              );
            }
            const inv = e.investment;
            const isRecurring = !!inv.recurrenceGroupId;
            const openInvestmentEdit = () => {
              if (isRecurring) {
                setEditingRecurring({
                  kind: "investment",
                  id: inv.id,
                  groupId: inv.recurrenceGroupId!,
                  description: inv.type,
                  amount: inv.amount,
                  date: inv.date,
                  accountId: inv.accountId,
                  percentage: inv.percentage,
                });
              } else {
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
                });
              }
            };
            return (
              <InvestmentRow
                key={inv.id}
                inv={inv}
                onEdit={openInvestmentEdit}
                onDuplicate={() => {
                  setRowStartAction("duplicate");
                  openInvestmentEdit();
                }}
                onRemove={
                  isRecurring
                    ? () =>
                        askDeleteRecurring("investment", inv.recurrenceGroupId!, inv.type, {
                          accountId: inv.accountId,
                          amount: inv.amount,
                        })
                    : async () => {
                        const ok = await confirmDialog({
                          title: "Excluir investimento",
                          description: `Excluir "${inv.type}"?`,
                          variant: "destructive",
                          confirmLabel: "Excluir",
                        });
                        if (ok) removeInvestment.mutate(inv.id);
                      }
                }
                {...selProps("investments", inv.id)}
              />
            );
          })}
        </GroupedSection>

        {/* DEBITS */}

        <GroupedSection
          icon={Building2}
          title="DÉBITOS"
          description="Gastos diretos da conta corrente"
          tone="debit"
          total={totalDebitsNet}
          count={monthDebits.single.length + monthDebits.parcelled.length}
          paidState={
            monthDebits.single.length + monthDebits.parcelled.length > 0
              ? debitsAllPaid
                ? "paid"
                : "open"
              : null
          }
          empty={monthDebits.single.length === 0 && monthDebits.parcelled.length === 0}
          emptyText="Nenhum débito neste mês."
          sortControl={
            <SortMenu scope="debits" state={debitsSort.sort} onChange={debitsSort.set} />
          }
          paidControl={
            !isSelMode("debits") && monthDebits.single.length + monthDebits.parcelled.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  const target = !debitsAllPaid;
                  monthDebits.single.forEach((d) => {
                    if (d.paid !== target) toggleDebit.mutate({ id: d.id, paid: target });
                  });
                  monthDebits.parcelled.forEach((p) => {
                    if (p.installment.paid !== target) toggleInst(p.installment.id, target);
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
                      onDeleteParent: () =>
                        askDeleteParcelled(p.debit!.id, "debit", p.debit!.description),
                      parentSource: {
                        kind: "debit",
                        accountId: p.debit!.accountId,
                        description: p.debit!.description,
                        amount: p.debit!.amount,
                        date: p.debit!.date,
                        required: p.debit!.required,
                        paymentMethod: p.debit!.paymentMethod,
                        autoDebitDay: p.debit!.autoDebitDay,
                      },
                    })
                  }
                  onRemove={() =>
                    askDeleteInst(p.installment, p.debit!.description, "debit", p.debit!.id)
                  }
                  {...selProps("debits", p.debit!.id)}
                />
              );
            }
            const d = e.debit;
            const isRecurring = !!d.recurrenceGroupId;
            const openDebitEdit = () => {
              if (isRecurring) {
                setEditingRecurring({
                  kind: "debit",
                  id: d.id,
                  groupId: d.recurrenceGroupId!,
                  description: d.description,
                  amount: d.amount,
                  date: d.date,
                  accountId: d.accountId,
                  notifyDaysBefore: d.notifyDaysBefore,
                  paymentMethod: d.paymentMethod === "auto_debit" ? null : d.paymentMethod,
                  paid: d.paid,
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
                    notifyDaysBefore: d.notifyDaysBefore,
                    paymentMethod: d.paymentMethod,
                    autoDebitDay: d.autoDebitDay,
                  },
                  onDeleteParent: () => removeDebit.mutate(d.id),
                });
              }
            };
            return (
              <DebitRow
                key={d.id}
                debit={d}
                onToggle={() => toggleDebit.mutate({ id: d.id, paid: !d.paid })}
                onEdit={openDebitEdit}
                onDuplicate={() => {
                  setRowStartAction("duplicate");
                  openDebitEdit();
                }}
                onRemove={
                  isRecurring
                    ? () =>
                        askDeleteRecurring("debit", d.recurrenceGroupId!, d.description, {
                          accountId: d.accountId,
                          amount: d.amount,
                        })
                    : d.paymentMethod === "auto_debit"
                      ? () => askDeleteSingle(d.id, "debit", d.description, d.date)
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

          const cardsAll = accountCards
            .map((c) => {
              const items = monthInst.filter((i) => {
                if (i.parentType !== "purchase") return false;
                const pur = purchasesList.find((p) => p.id === i.parentId);
                return pur?.cardId === c.id;
              });
              return { card: c, items };
            })
            // Cartão sem nenhum item/fatura neste mês some da lista — mas
            // continua selecionável ao lançar uma nova compra (e volta a
            // aparecer automaticamente no mês em que tiver movimento).
            .filter(({ items }) => items.length > 0);

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
                  {accountCards.length === 0
                    ? "Nenhum cartão vinculado a esta conta."
                    : "Nenhum cartão com movimento neste mês."}
                </p>
              ) : (
                <div className="grid gap-3">
                  {cardsAll.map(({ card: c, items: cardInst }) => {
                    const total = cardInst.reduce((s, i) => s + i.amount, 0);
                    const faturaIsPaid = isCardFullyPaid(
                      installmentsList,
                      purchasesList,
                      cardPayments,
                      c.id,
                      year,
                      month,
                    );
                    const allChecked = cardInst.length > 0 && cardInst.every((i) => i.paid);
                    const cardState: "paid" | "allChecked" | "open" = faturaIsPaid
                      ? "paid"
                      : allChecked
                        ? "allChecked"
                        : "open";
                    const countRevisado = cardInst.filter((i) => i.paid).length;
                    const dueDay = (c as { dueDay?: number }).dueDay ?? 5;
                    const dueDate = new Date(year, month, Math.min(dueDay, 28));
                    return (
                      <div
                        key={c.id}
                        className={`rounded-2xl border border-l-4 bg-card transition-colors ${
                          cardState === "paid"
                            ? "border-success/50 shadow-[0_4px_18px_-6px_color-mix(in_oklab,var(--success)_45%,transparent)]"
                            : cardState === "allChecked"
                              ? "border-credit/50 shadow-[0_4px_18px_-6px_color-mix(in_oklab,var(--credit)_45%,transparent)]"
                              : "border-warning/50 shadow-[0_4px_18px_-6px_color-mix(in_oklab,var(--warning)_40%,transparent)]"
                        }`}
                        style={{ borderLeftColor: c.color }}
                      >
                        <CardRowSorted
                          card={c}
                          cardInst={cardInst}
                          purchases={purchasesList}
                          total={total}
                          paid={faturaIsPaid}
                          cardState={cardState}
                          countRevisado={countRevisado}
                          paymentPending={setCardPaid.isPending}
                          dueLabel={`Vence: ${dueDate.toLocaleDateString("pt-BR")}`}
                          onTogglePaid={() => {
                            if (!setCardPaid.isPending) {
                              const newPaid = !faturaIsPaid;
                              setCardPaid.mutate({ cardId: c.id, year, month, paid: newPaid });
                              if (newPaid) {
                                cardInst.forEach((i) => {
                                  if (!i.paid) toggleInst(i.id, true);
                                });
                              }
                            }
                          }}
                          onEditCard={() => setEditingCardId(c.id)}
                          onRequestReorder={enterReorder}
                          onToggleInst={(id, p) => toggleInst(id, p)}
                          onEditInst={(inst) => {
                            const pur = purchasesList.find((p) => p.id === inst.parentId);
                            if (!pur) return;
                            if (pur.recurrenceGroupId) {
                              setEditingRecurring({
                                kind: "purchase",
                                id: pur.id,
                                groupId: pur.recurrenceGroupId,
                                description: pur.description,
                                amount: pur.totalAmount,
                                date: pur.date,
                                cardId: c.id,
                                notifyDaysBefore: pur.notifyDaysBefore,
                              });
                              return;
                            }
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
                            const pur = purchasesList.find((p) => p.id === inst.parentId);
                            if (!pur) return;
                            askDeletePurchase(pur);
                          }}
                          itemSelProps={(_inst, parentId) => selProps(`card:${c.id}`, parentId)}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })()}
      </div>

      {(() => {
        // Some enquanto qualquer diálogo aberto por ele estiver na tela — senão
        // fica flutuando por cima dos botões do próprio diálogo (ex.: Cancelar/Adicionar).
        const anyFabDialogOpen = openDebit || openIncome || openInvest || openPurchase || openCard;
        if (anyFabDialogOpen) return null;

        // Modo seleção múltipla: o FAB (+) vira um menu "•••" com Duplicar/Mover/Excluir
        // dos itens selecionados, em vez do menu de "adicionar novo item".
        if (selection) {
          const bulkUi = (
            <>
              {bulkMenuOpen && (
                <div
                  className={`pointer-events-auto ${embedded ? "absolute" : "fixed"} inset-0 z-30`}
                  onClick={() => setBulkMenuOpen(false)}
                  aria-hidden="true"
                />
              )}
              <div
                className={`pointer-events-auto ${embedded ? "absolute" : "fixed"} bottom-10 right-4 z-40 flex flex-col items-end gap-3 md:right-8`}
              >
                {bulkMenuOpen && (
                  <div className="flex flex-col items-end gap-2.5">
                    {(selection.key === "debits" || selection.key.startsWith("card:")) && (
                      <FabAction
                        icon={Banknote}
                        label="Gerar recebível"
                        tone="income"
                        onClick={() => {
                          bulkGenerateReceivable(selection.key);
                          setBulkMenuOpen(false);
                        }}
                      />
                    )}
                    <FabAction
                      icon={FileText}
                      label="Gerar PDF"
                      tone="primary"
                      onClick={() => {
                        bulkGeneratePdf(selection.key);
                        setBulkMenuOpen(false);
                      }}
                    />
                    <FabAction
                      icon={Copy}
                      label="Duplicar"
                      tone="primary"
                      onClick={() => {
                        bulkDuplicate(selection.key);
                        setBulkMenuOpen(false);
                      }}
                    />
                    <FabAction
                      icon={CalendarClock}
                      label="Mover para outro mês"
                      tone="credit"
                      onClick={() => {
                        setMoveMonthOpen(true);
                        setBulkMenuOpen(false);
                      }}
                    />
                    <FabAction
                      icon={Trash2}
                      label="Excluir"
                      tone="destructive"
                      onClick={() => {
                        bulkDelete(selection.key);
                        setBulkMenuOpen(false);
                      }}
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setBulkMenuOpen((v) => !v)}
                  aria-label="Ações da seleção"
                  aria-expanded={bulkMenuOpen}
                  className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card text-destructive shadow-elevated transition-colors hover:border-destructive/50"
                >
                  <MoreHorizontal className="h-6 w-6" />
                </button>
              </div>
            </>
          );
          return embedded && fabPortalTarget ? createPortal(bulkUi, fabPortalTarget) : bulkUi;
        }

        const fabUi = (
          <>
            {fabOpen && (
              <div
                className={`pointer-events-auto ${embedded ? "absolute" : "fixed"} inset-0 z-30`}
                onClick={() => setFabOpen(false)}
                aria-hidden="true"
              />
            )}
            <div
              className={`pointer-events-auto ${embedded ? "absolute" : "fixed"} bottom-10 right-4 z-40 flex flex-col items-end gap-3 md:right-8`}
            >
              {fabOpen && fabView === "create" && (
                <div className="flex flex-col items-end gap-2.5">
                  <FabAction
                    icon={CreditCard}
                    label="Novo cartão"
                    tone="credit"
                    onClick={() => {
                      setOpenCard(true);
                      setFabOpen(false);
                    }}
                  />
                  <FabAction
                    icon={ShoppingBag}
                    label="Nova compra"
                    tone="credit"
                    onClick={() => {
                      setOpenPurchase(true);
                      setFabOpen(false);
                    }}
                  />
                  <FabAction
                    icon={ArrowDownRight}
                    label="Novo débito"
                    tone="debit"
                    onClick={() => {
                      setOpenDebit(true);
                      setFabOpen(false);
                    }}
                  />
                  <FabAction
                    icon={TrendingUp}
                    label="Novo investimento"
                    tone="primary"
                    onClick={() => {
                      setOpenInvest(true);
                      setFabOpen(false);
                    }}
                  />
                  <FabAction
                    icon={Download}
                    label="Novo recebimento"
                    tone="income"
                    onClick={() => {
                      setOpenIncome(true);
                      setFabOpen(false);
                    }}
                  />
                  <FabAction
                    icon={Settings}
                    label="Configurações"
                    tone="primary"
                    onClick={() => setFabView("settings")}
                  />
                </div>
              )}
              {fabOpen && fabView === "settings" && (
                <div className="flex flex-col items-end gap-2.5">
                  <SettingsFabActions
                    onNavigate={() => setFabOpen(false)}
                    onBack={() => setFabView("create")}
                    onManageAccounts={() => setManageOpen(true)}
                  />
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setFabOpen((v) => !v);
                  setFabView("create");
                }}
                aria-label={fabOpen ? "Fechar menu de adicionar" : "Adicionar novo item"}
                aria-expanded={fabOpen}
                className={`flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card text-primary shadow-elevated transition-transform duration-200 hover:border-primary/50 ${
                  fabOpen ? "rotate-45" : ""
                }`}
              >
                <Plus className="h-6 w-6" />
              </button>
            </div>
          </>
        );
        return embedded && fabPortalTarget ? createPortal(fabUi, fabPortalTarget) : fabUi;
      })()}

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
        open={openPurchase}
        onClose={() => setOpenPurchase(false)}
        defaultYear={year}
        defaultMonth={month}
        fixedAccountId={contaId}
      />
      <AddInvestmentDialog
        open={openInvest}
        onClose={() => setOpenInvest(false)}
        defaultYear={year}
        defaultMonth={month}
        fixedAccountId={contaId}
      />
      <EditInstallmentDialog
        open={!!editing}
        onClose={() => {
          setEditing(null);
          setRowStartAction(undefined);
        }}
        installment={editing?.inst ?? null}
        parentLabel={editing?.label}
        parentSubtitle={editing?.subtitle}
        onDeleteParent={editing?.onDeleteParent}
        parentSource={editing?.parentSource}
        defaultYear={year}
        defaultMonth={month}
        startAction={rowStartAction}
      />
      <EditInstallmentDialog
        open={!!editingSingle}
        onClose={() => {
          setEditingSingle(null);
          setRowStartAction(undefined);
        }}
        single={editingSingle?.item ?? null}
        onDeleteParent={editingSingle?.onDeleteParent}
        defaultYear={year}
        defaultMonth={month}
        startAction={rowStartAction}
      />
      <AddCardDialog
        open={openCard}
        onClose={() => setOpenCard(false)}
        defaultYear={year}
        defaultMonth={month}
        fixedAccountId={contaId}
      />
      <EditCardDialog
        open={!!editingCardId}
        onClose={() => setEditingCardId(null)}
        card={accountCards.find((c) => c.id === editingCardId) ?? null}
        defaultYear={year}
        defaultMonth={month}
      />
      <EditRecurringDialog
        open={!!editingRecurring}
        onClose={() => {
          setEditingRecurring(null);
          setRowStartAction(undefined);
        }}
        target={editingRecurring}
        defaultYear={year}
        defaultMonth={month}
        startAction={rowStartAction}
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
        loading={deleteParcelledScoped.isPending || deleteOverScope.isPending}
        availableMonths={scopeDelete?.availableMonths}
        onConfirm={async (scope) => {
          if (!scopeDelete) return;
          await scopeDelete.execute(scope);
          setScopeDelete(null);
        }}
      />
      <MoveToMonthDialog
        open={moveMonthOpen}
        onClose={() => setMoveMonthOpen(false)}
        count={selection?.ids.size ?? 0}
        currentYear={year}
        currentMonth={month}
        loading={moveEntries.isPending}
        onConfirm={bulkMove}
      />
      <MoveSeriesConfirmDialog
        open={!!askMoveSeries}
        onClose={() => setAskMoveSeries(null)}
        loading={moveEntries.isPending}
        targetLabel={askMoveSeries ? `${MONTHS[askMoveSeries.month]} de ${askMoveSeries.year}` : ""}
        extraCount={
          askMoveSeries
            ? (() => {
              const { ids, standaloneOps } = resolveSeriesFromOps(askMoveSeries.ops, seriesResolveData);
              const covered = askMoveSeries.ops.length - standaloneOps.length;
              return Math.max(0, countSeriesRows(ids) - covered);
            })()
            : 0
        }
        onConfirm={async (expandSeries) => {
          if (!askMoveSeries) return;
          await runMove(askMoveSeries.ops, askMoveSeries.year, askMoveSeries.month, expandSeries);
        }}
      />
      <ManageAccountsDialog open={manageOpen} onClose={() => setManageOpen(false)} />
      </div>
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
  const saldoFinal = saldoAtual - gastosTotais;
  const inicialTone = saldoAtual >= 0 ? "text-primary" : "text-destructive";
  const inicialBg =
    saldoAtual >= 0 ? "border-primary/20 bg-primary/10" : "border-destructive/20 bg-destructive/10";
  const finalTone = saldoFinal >= 0 ? "text-primary" : "text-destructive";
  const finalBg =
    saldoFinal >= 0 ? "border-primary/20 bg-primary/10" : "border-destructive/20 bg-destructive/10";
  return (
    <div className="header-frame-fade relative z-20 -mt-6 animate-fade-slide-in grid grid-cols-2 gap-3 rounded-3xl border border-border bg-card p-3 shadow-elegant sm:p-4 md:grid-cols-3">
      <div className={`rounded-xl border p-3 ${inicialBg}`}>
        <div className={`flex items-center gap-1.5 text-[11px] font-semibold ${inicialTone}`}>
          <Wallet className="h-3 w-3" /> Saldo Inicial
        </div>
        <p className={`mt-1 text-base font-bold sm:text-lg ${inicialTone}`}>
          {formatCurrency(saldoAtual)}
        </p>
      </div>
      <div className={`rounded-xl border p-3 ${finalBg}`}>
        <div className={`flex items-center gap-1.5 text-[11px] font-semibold ${finalTone}`}>
          <Check className="h-3 w-3" /> Saldo Final
        </div>
        <p className={`mt-1 text-base font-bold sm:text-lg ${finalTone}`}>
          {formatCurrency(saldoFinal)}
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">saldo inicial − gastos totais</p>
      </div>
      <div className="col-span-2 rounded-xl border border-debit/20 bg-debit/10 p-3 md:col-span-1">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-debit">
          <ArrowDownRight className="h-3 w-3" /> Gastos Totais
        </div>
        <p className="mt-1 text-base font-bold text-debit sm:text-lg">
          {formatCurrency(gastosTotais)}
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          débitos + investimentos + cartões
        </p>
      </div>
    </div>
  );
}

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
      <div className={`flex flex-col gap-1.5 px-3 py-3 md:px-4 md:py-3.5 ${toneWash[tone]}`}>
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
          {open && paidControl ? (
            <div className="hidden shrink-0 md:block">{paidControl}</div>
          ) : null}
          {open && sortControl ? (
            <div className="hidden shrink-0 md:block">{sortControl}</div>
          ) : null}
          <button
            type="button"
            onClick={toggle}
            aria-label={open ? "Recolher" : "Expandir"}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-secondary"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            />
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
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
              {open && paidControl ? <div className="shrink-0">{paidControl}</div> : null}
              {open && sortControl ? <div className="shrink-0">{sortControl}</div> : null}
            </div>
          </div>
        )}
      </div>

      {/* Body — grid-rows 0fr/1fr anima a altura sem precisar medir nada em JS. */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
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
        </div>
      </div>
    </section>
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
  cardState,
  countRevisado,
  paymentPending,
  dueLabel,
  onTogglePaid,
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
  cardState: "paid" | "allChecked" | "open";
  countRevisado: number;
  paymentPending?: boolean;
  dueLabel: string;
  onTogglePaid: () => void;
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
      cardState={cardState}
      countRevisado={countRevisado}
      paymentPending={paymentPending}
      count={cardInst.length}
      dueLabel={dueLabel}
      onTogglePaid={onTogglePaid}
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
      sortControl={<SortMenu scope={`card:${card.id}`} state={sort} onChange={set} />}
    />
  );
}

function CardRow({
  cardName,
  cardColor,
  total,
  paid,
  cardState,
  countRevisado,
  paymentPending,
  count,
  dueLabel,
  onTogglePaid,
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
  cardState: "paid" | "allChecked" | "open";
  countRevisado: number;
  paymentPending?: boolean;
  count: number;
  dueLabel: string;
  onTogglePaid: () => void;
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
        className="flex w-full cursor-pointer flex-col gap-1.5 px-3 py-3 text-left transition-colors hover:bg-secondary/30 md:px-4 md:py-3.5"
      >
        {/* Linha 1: cor + nome + (desktop: valor + controles) */}
        <div className="flex items-center gap-2.5 md:gap-3">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: cardColor }}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{cardName}</p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{dueLabel}</p>
          </div>
          <div className="hidden shrink-0 flex-col items-end gap-0.5 md:flex">
            <p className="text-sm font-bold text-credit">{formatCurrency(total)}</p>
            <p className="text-[10px] text-muted-foreground">
              {cardState === "paid"
                ? `${count} ${count === 1 ? "item" : "itens"} · fatura paga`
                : cardState === "allChecked"
                  ? `${count} ${count === 1 ? "item" : "itens"} · todos revisados`
                  : `${count} ${count === 1 ? "item" : "itens"} · ${countRevisado} revisados`}
            </p>
          </div>
          <button
            type="button"
            disabled={paymentPending}
            onClick={(e) => {
              e.stopPropagation();
              if (!paymentPending) onTogglePaid();
            }}
            className={`hidden shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-70 md:inline-flex ${
              cardState === "paid"
                ? "bg-success/15 text-success hover:bg-success/25"
                : cardState === "allChecked"
                  ? "bg-credit/15 text-credit hover:bg-credit/25"
                  : "bg-warning/15 text-warning hover:bg-warning/25"
            }`}
          >
            {paymentPending ? "Salvando..." : cardState === "paid" ? "Pago" : "Marcar pago"}
          </button>
          {open && sortControl ? (
            <div className="hidden shrink-0 md:block" onClick={(e) => e.stopPropagation()}>
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
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            />
          </button>
        </div>

        {/* Linha 2 (mobile only): valor + controles */}
        <div className="flex items-center justify-between gap-2 md:hidden">
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-bold text-credit">{formatCurrency(total)}</p>
            <p className="text-[10px] text-muted-foreground">
              {cardState === "paid"
                ? `${count} ${count === 1 ? "item" : "itens"} · fatura paga`
                : cardState === "allChecked"
                  ? `${count} ${count === 1 ? "item" : "itens"} · todos revisados`
                  : `${count} ${count === 1 ? "item" : "itens"} · ${countRevisado} revisados`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={paymentPending}
              onClick={(e) => {
                e.stopPropagation();
                if (!paymentPending) onTogglePaid();
              }}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
                cardState === "paid"
                  ? "bg-success/15 text-success hover:bg-success/25"
                  : cardState === "allChecked"
                    ? "bg-blue-500/15 text-blue-400 hover:bg-blue-500/25"
                    : "bg-warning/15 text-warning hover:bg-warning/25"
              }`}
            >
              {paymentPending ? "Salvando..." : cardState === "paid" ? "Pago" : "Marcar pago"}
            </button>
            {open && sortControl ? (
              <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                {sortControl}
              </div>
            ) : null}
          </div>
        </div>
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

      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="border-t border-border bg-background/30">
            {selectionBar}

            {items.length === 0 ? (
              <div className="space-y-3 px-4 py-6 text-center">
                <p className="text-xs text-muted-foreground">Nenhum lançamento neste mês.</p>
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
                  .filter(
                    (x): x is { inst: (typeof items)[number]; pur: NonNullable<typeof x.pur> } =>
                      !!x.pur,
                  )
                  .sort((a, b) => {
                    if (sortedItems) return 0; // respect provided order
                    // Prioriza parcelados + recorrentes (tier 0) sobre à-vista (tier 1),
                    // igual à regra já aplicada em débitos/recebimentos.
                    const aParc = a.pur.installmentsCount > 1 || !!a.pur.recurrenceGroupId ? 0 : 1;
                    const bParc = b.pur.installmentsCount > 1 || !!b.pur.recurrenceGroupId ? 0 : 1;
                    return (
                      aParc - bParc ||
                      // Ordena pela data da COMPRA original (pur.date), não pela
                      // fatura (dueDate) — mesma regra aplicada a débitos/recebimentos.
                      a.pur.date.localeCompare(b.pur.date) ||
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
          </div>
        </div>
      </div>
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

function PurchaseInstRow({
  inst,
  purchase,
  cardColor,
  onToggle,
  onEdit,
  onRemove,
  onDuplicate,
  selectionMode,
  selected,
  onSelectToggle,
  onLongPress,
}: {
  inst: Installment;
  purchase: {
    description: string;
    date: string;
    totalAmount: number;
    installmentsCount: number;
    recurrenceGroupId?: string | null;
  };
  cardColor: string;
  onToggle: () => void;
  onEdit: () => void;
  onRemove?: () => void;
  onDuplicate?: () => void;
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
  const isRecurring = !isInstallment && !!purchase.recurrenceGroupId;
  return (
    <div
      className={`flex items-center gap-2.5 px-3 py-3 transition-colors md:gap-3 md:px-4 ${selected ? "bg-primary/10" : ""}`}
      {...lp.handlers}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: cardColor }}
        aria-hidden="true"
      />
      <button onClick={guard(onEdit)} className="min-w-0 flex-1 text-left">
        <p className={`truncate text-sm font-semibold ${inst.paid ? "text-muted-foreground" : ""}`}>
          {purchase.description}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>{formatDate(inst.referenceDate || purchase.date)}</span>
          {isInstallment && (
            <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-bold uppercase text-muted-foreground">
              PAR
            </span>
          )}
          {isInstallment && (
            <span className="rounded-full bg-credit/15 px-1.5 py-0.5 text-[9px] font-bold text-credit">
              {inst.number}/{inst.total}
            </span>
          )}
          {isRecurring && (
            <span className="rounded-full bg-credit/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-credit">
              REC
            </span>
          )}
        </p>
      </button>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-bold">{formatCurrency(inst.amount)}</p>
        </div>
        <button
          onClick={guard(onToggle)}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors ${
            inst.paid
              ? "bg-success/15 text-success hover:bg-success/25"
              : "bg-secondary text-muted-foreground hover:bg-secondary/70"
          }`}
          title={inst.paid ? "Desmarcar" : "Marcar como revisado"}
        >
          {inst.paid ? (
            <>
              <Check className="h-3 w-3" /> Validado
            </>
          ) : (
            "Não validado"
          )}
        </button>
      </div>
    </div>
  );
}

function DebitRow({
  debit,
  onToggle,
  onEdit,
  onRemove,
  onDuplicate,
  selectionMode,
  selected,
  onSelectToggle,
  onLongPress,
}: {
  debit: Debit;
  onToggle: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onDuplicate?: () => void;
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
      className={`flex items-center gap-2.5 px-3 py-3 transition-colors md:gap-3 md:px-4 ${selected ? "bg-primary/10" : ""}`}
      {...lp.handlers}
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-debit/15 text-debit">
        <ArrowDownRight className="h-3.5 w-3.5" />
      </div>
      <button onClick={guard(onEdit)} className="flex-1 min-w-0 text-left">
        <p
          className={`truncate text-sm font-semibold ${debit.paid ? "text-muted-foreground" : ""}`}
        >
          {debit.description}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>{formatDate(debit.date)}</span>
          {debit.required && (
            <span className="rounded-full bg-debit/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-debit">
              REC
            </span>
          )}
          {debit.paymentMethod === "auto_debit" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary">
              <Zap className="h-2.5 w-2.5" />
              AUT{debit.autoDebitDay ? ` d${debit.autoDebitDay}` : ""}
            </span>
          ) : (
            debit.paymentMethod && (
              <span className="rounded-full bg-cyan-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-cyan-600 dark:text-cyan-400">
                {PAYMENT_METHOD_BADGES[debit.paymentMethod]}
              </span>
            )
          )}
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
    </div>
  );
}

function IncomeRow({
  income,
  onToggle,
  onEdit,
  onRemove,
  onDuplicate,
  selectionMode,
  selected,
  onSelectToggle,
  onLongPress,
}: {
  income: Income;
  onToggle: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onDuplicate?: () => void;
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
      className={`flex items-center gap-2.5 px-3 py-3 transition-colors md:gap-3 md:px-4 ${selected ? "bg-primary/10" : ""}`}
      {...lp.handlers}
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
        <ArrowUpRight className="h-3.5 w-3.5" />
      </div>
      <button onClick={guard(onEdit)} className="flex-1 min-w-0 text-left">
        <p
          className={`truncate text-sm font-semibold ${
            income.received ? "text-muted-foreground" : ""
          }`}
        >
          {income.description}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>{formatDate(income.date)}</span>
          {income.recurrenceGroupId && (
            <span className="rounded-full bg-success/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-success">
              REC
            </span>
          )}
          {income.paymentMethod && (
            <span className="rounded-full bg-cyan-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-cyan-600 dark:text-cyan-400">
              {PAYMENT_METHOD_BADGES[income.paymentMethod]}
            </span>
          )}
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
  kind: "debit" | "income" | "investment";
  installment: Installment;
  parent: Debit | Income | Investment;
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
  const tone =
    kind === "debit" ? "text-debit" : kind === "income" ? "text-success" : "text-primary";
  const auto = kind === "debit" && (parent as Debit).paymentMethod === "auto_debit";
  const otherMethod =
    kind !== "investment" && !auto ? (parent as Debit | Income).paymentMethod : null;
  const label =
    kind === "investment" ? (parent as Investment).type : (parent as Debit | Income).description;
  const badgeClass =
    kind === "debit"
      ? "bg-debit/15 text-debit"
      : kind === "income"
        ? "bg-success/15 text-success"
        : "bg-primary/15 text-primary";
  const iconWrapClass =
    kind === "debit"
      ? "bg-debit/15 text-debit"
      : kind === "income"
        ? "bg-success/15 text-success"
        : "bg-primary/15 text-primary";
  return (
    <div
      className={`flex items-center gap-2.5 px-3 py-3 transition-colors md:gap-3 md:px-4 ${selected ? "bg-primary/10" : ""}`}
      {...lp.handlers}
    >
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${iconWrapClass}`}
      >
        {kind === "debit" ? (
          <ArrowDownRight className="h-3.5 w-3.5" />
        ) : kind === "income" ? (
          <ArrowUpRight className="h-3.5 w-3.5" />
        ) : (
          <TrendingUp className="h-3.5 w-3.5" />
        )}
      </div>
      <button onClick={guard(onEdit)} className="min-w-0 flex-1 text-left">
        <p
          className={`truncate text-sm font-semibold ${
            kind !== "investment" && installment.paid ? "text-muted-foreground" : ""
          }`}
        >
          {label}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>{formatDate(installment.referenceDate || parent.date)}</span>
          <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-bold uppercase text-muted-foreground">
            PAR
          </span>
          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${badgeClass}`}>
            {installment.number}/{installment.total}
          </span>
          {auto && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary">
              <Zap className="h-2.5 w-2.5" />
              AUT
            </span>
          )}
          {otherMethod && (
            <span className="rounded-full bg-cyan-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-cyan-600 dark:text-cyan-400">
              {PAYMENT_METHOD_BADGES[otherMethod]}
            </span>
          )}
        </p>
      </button>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <div className="flex items-center gap-1.5">
          <p className={`text-sm font-bold ${tone}`}>{formatCurrency(installment.amount)}</p>
        </div>
        {kind !== "investment" && (
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
                <Check className="h-3 w-3" /> {kind === "income" ? "Recebido" : "Pago"}
              </>
            ) : kind === "income" ? (
              "Marcar recebido"
            ) : (
              "Marcar pago"
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function InvestmentRow({
  inv,
  onEdit,
  onRemove,
  onDuplicate,
  selectionMode,
  selected,
  onSelectToggle,
  onLongPress,
}: {
  inv: Investment;
  onEdit: () => void;
  onRemove: () => void;
  onDuplicate?: () => void;
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
      className={`flex items-center gap-2.5 px-3 py-3 transition-colors md:gap-3 md:px-4 ${selected ? "bg-primary/10" : ""}`}
      {...lp.handlers}
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
        <TrendingUp className="h-3.5 w-3.5" />
      </div>
      <button onClick={guard(onEdit)} className="flex-1 min-w-0 text-left">
        <p className="truncate text-sm font-semibold capitalize">{inv.type}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>{formatDate(inv.date)}</span>
          <span>· {inv.percentage}% rendimento</span>
          {inv.recurrenceGroupId && (
            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary">
              REC
            </span>
          )}
        </p>
      </button>
      <p className="text-sm font-bold text-primary">{formatCurrency(inv.amount)}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="px-4 py-6 text-center text-xs text-muted-foreground">{text}</div>;
}
