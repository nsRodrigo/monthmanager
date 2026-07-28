import { useState, useEffect } from "react";
import { Modal, Field, inputClass } from "./Modal";
import {
  useUpdateInstallment,
  useShiftInstallmentDate,
  useUpdateInstallmentDateScope,
  useUpdateInstallmentAmountScope,
  useAdvanceInstallments,
  usePostponeInstallment,
  useUpdateDebit,
  useUpdateIncome,
  useUpdateInvestment,
  useUpdatePurchase,
  useChangeInstallmentSeries,
  useRenumberInstallment,
  useAddDebit,
  useAddIncome,
  useRemoveDebit,
  useRemoveIncome,
  useDescriptionSuggestions,
  useDuplicateOverScope,
  useDeleteOverScope,
  useDuplicateInstallmentSeries,
  useDuplicateInstallmentsSelection,
  useInstallments,
  usePurchases,
  useDebits,
  useIncomes,
  useLatestAmountAdjustment,
  type Installment,
  type InstallmentScope,
  type CardScope,
  type DeleteSource,
} from "@/store/finance";
import { CurrencyInput } from "./CurrencyInput";
import { AutocompleteInput } from "./AutocompleteInput";
import { formatCurrency, formatDate, MONTHS } from "@/lib/format";
import { Trash2, Copy, FastForward, Rewind, Settings2, ChevronRight, RefreshCw, ArrowLeft } from "lucide-react";
import { useConfirm } from "@/store/confirm";
import { CardScopeConfirmDialog } from "./CardScopeConfirmDialog";


export type SingleEditTarget =
  | { kind: "debit"; id: string; accountId: string; description: string; amount: number; date: string; paid: boolean; notifyDaysBefore?: number | null }
  | { kind: "income"; id: string; accountId: string; description: string; amount: number; date: string; paid: boolean }
  | { kind: "investment"; id: string; accountId: string; description: string; amount: number; date: string };

export function EditInstallmentDialog({
  open,
  onClose,
  installment,
  single,
  parentLabel,
  parentSubtitle,
  onDeleteParent,
  parentSource,
  defaultYear,
  defaultMonth,
}: {
  open: boolean;
  onClose: () => void;
  /** Editing an installment (parcela). */
  installment?: Installment | null;
  /** Editing a single (non-installment) Debit / Income / Investment. */
  single?: SingleEditTarget | null;
  parentLabel?: string;
  parentSubtitle?: string;
  onDeleteParent?: () => void;
  /** Origem para duplicar o lançamento parcelado em outros meses. */
  parentSource?: import("@/store/finance").DuplicateSource;
  defaultYear?: number;
  defaultMonth?: number;
}) {
  const update = useUpdateInstallment();
  const shift = useShiftInstallmentDate();
  const updateDateScope = useUpdateInstallmentDateScope();
  const updateAmountScope = useUpdateInstallmentAmountScope();
  const advance = useAdvanceInstallments();
  const postpone = usePostponeInstallment();
  const updateDebit = useUpdateDebit();
  const updateIncome = useUpdateIncome();
  const updateInvestment = useUpdateInvestment();
  const updatePurchase = useUpdatePurchase();
  const changeInstSeries = useChangeInstallmentSeries();
  const renumberInstallment = useRenumberInstallment();
  const addDebit = useAddDebit();
  const addIncome = useAddIncome();
  const removeDebit = useRemoveDebit();
  const removeIncome = useRemoveIncome();
  const duplicate = useDuplicateOverScope();
  const deleteScope = useDeleteOverScope();
  const duplicateSeries = useDuplicateInstallmentSeries();
  const duplicateSelection = useDuplicateInstallmentsSelection();
  const { data: allInstallments = [] } = useInstallments();
  const { data: purchases = [] } = usePurchases();
  const { data: debits = [] } = useDebits();
  const { data: incomes = [] } = useIncomes();
  const latestAdjustment = useLatestAmountAdjustment(
    installment?.parentId,
    installment?.parentType,
  );

  const confirm = useConfirm();
  const [askDuplicate, setAskDuplicate] = useState(false);
  const [askDuplicateParcelled, setAskDuplicateParcelled] = useState(false);
  const [selectedDupIds, setSelectedDupIds] = useState<Set<string>>(new Set());
  const [askDelete, setAskDelete] = useState(false);
  const dupAnchorY = defaultYear ?? new Date().getFullYear();
  const dupAnchorM = defaultMonth ?? new Date().getMonth();

  // Same-category suggestion source — falls back to "debit" when no item is open.
  const suggestionKind: "debit" | "income" | "purchase" | "investment" = single
    ? single.kind
    : installment
      ? (installment.parentType as "debit" | "income" | "purchase" | "investment")
      : "debit";
  const suggestions = useDescriptionSuggestions(suggestionKind);

  // For installments (parcelas), the editable date is the PARENT's date
  // (purchase_date / debit.date / income.date), shared by all installments —
  // UNLESS this specific installment has its own `referenceDate` override
  // (set via a "só esta"/"esta e as próximas" scoped date edit — P7/P8).
  // Installment.dueDate is the per-month invoice slot and is not touched here.
  const parentDate = (() => {
    if (!installment) return "";
    if (installment.parentType === "purchase") {
      return purchases.find((p) => p.id === installment.parentId)?.date ?? "";
    }
    if (installment.parentType === "debit") {
      return debits.find((d) => d.id === installment.parentId)?.date ?? "";
    }
    if (installment.parentType === "income") {
      return incomes.find((i) => i.id === installment.parentId)?.date ?? "";
    }
    return "";
  })();
  const effectiveDate = installment?.referenceDate || parentDate;

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [dueDate, setDueDate] = useState("");
  const [paid, setPaid] = useState(false);
  const [askDateScope, setAskDateScope] = useState(false);
  const [advanceCount, setAdvanceCount] = useState("");
  const [newInstCount, setNewInstCount] = useState("");
  const [newTotalAmount, setNewTotalAmount] = useState<number>(0);
  const [newCurrentNumber, setNewCurrentNumber] = useState("");
  const [recreateMode, setRecreateMode] = useState<"recalculate" | "keepPerInstallment">("recalculate");
  const [manageView, setManageView] = useState<"none" | "menu" | "advance" | "change">("none");
  // Single-mode type conversion state
  const [singleType, setSingleType] = useState<"cash" | "parcelled" | "recurring">("cash");
  const [convInstallments, setConvInstallments] = useState("2");
  const [convInstNumber, setConvInstNumber] = useState("1");
  const [convMode, setConvMode] = useState<"total" | "perInstallment">("total");
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [notifyDaysBefore, setNotifyDaysBefore] = useState("");

  useEffect(() => {
    if (!open) return;
    if (installment) {
      setDescription(parentLabel ?? "");
      setAmount(installment.amount);
      setDueDate(effectiveDate || installment.dueDate);
      setPaid(installment.paid);
      setNewInstCount(String(installment.total));
      setNewTotalAmount(installment.amount * installment.total);
      setNewCurrentNumber(String(installment.number));
      setRecreateMode("recalculate");
    } else if (single) {
      setDescription(single.description);
      setAmount(single.amount);
      setDueDate(single.date);
      setPaid(single.kind === "investment" ? false : single.paid);
      setSingleType("cash");
      setConvInstallments("2");
      setConvInstNumber("1");
      setConvMode("total");
      const singleNotify = single.kind === "debit" ? single.notifyDaysBefore ?? null : null;
      setNotifyEnabled(singleNotify != null);
      setNotifyDaysBefore(singleNotify != null ? String(singleNotify) : "");
    }
    setAskDateScope(false);
    setAdvanceCount("");
    setManageView("none");
  }, [open, installment, single, parentLabel, parentDate, effectiveDate]);

  if (!installment && !single) return null;

  // ───── SINGLE (Debit / Income / Investment) ─────
  if (single) {
    const canConvert = single.kind === "debit" || single.kind === "income";
    const convN = singleType === "parcelled" ? Math.max(1, parseInt(convInstallments) || 1) : 1;
    const convCur = singleType === "parcelled"
      ? Math.max(1, Math.min(convN, parseInt(convInstNumber) || 1))
      : 1;
    const convTotal = convMode === "perInstallment" && convN > 1 ? amount * convN : amount;
    const convPer = convN > 0 ? convTotal / convN : 0;

    const handleSave = async () => {
      // ── Conversion: cash → parcelled or cash → recurring (debit/income only)
      if (canConvert && singleType !== "cash") {
        // Remove the original single, then create the new shape using the
        // existing add hooks (same code path as the "Add" dialogs).
        if (single.kind === "debit") {
          await removeDebit.mutateAsync(single.id);
          if (singleType === "parcelled") {
            await addDebit.mutateAsync({
              accountId: single.accountId,
              description: description.trim(),
              amount: convTotal,
              date: dueDate,
              required: false,
              installmentsCount: convN,
              installmentNumber: convCur,
            });
          } else {
            await addDebit.mutateAsync({
              accountId: single.accountId,
              description: description.trim(),
              amount,
              date: dueDate,
              required: true,
            });
          }
        } else {
          await removeIncome.mutateAsync(single.id);
          if (singleType === "parcelled") {
            await addIncome.mutateAsync({
              accountId: single.accountId,
              description: description.trim(),
              amount: convTotal,
              date: dueDate,
              installmentsCount: convN,
              installmentNumber: convCur,
            });
          } else {
            await addIncome.mutateAsync({
              accountId: single.accountId,
              description: description.trim(),
              amount,
              date: dueDate,
              recurring: true,
            });
          }
        }
        onClose();
        return;
      }
      // ── Plain edit (no type change)
      if (single.kind === "debit") {
        await updateDebit.mutateAsync({
          id: single.id,
          description: description.trim(),
          amount,
          date: dueDate,
          paid,
          notifyDaysBefore: notifyEnabled ? Math.max(0, parseInt(notifyDaysBefore) || 0) : null,
        });
      } else if (single.kind === "income") {
        await updateIncome.mutateAsync({
          id: single.id,
          description: description.trim(),
          amount,
          date: dueDate,
          received: paid,
        });
      } else {
        await updateInvestment.mutateAsync({
          id: single.id,
          type: description.trim(),
          amount,
          date: dueDate,
        });
      }
      onClose();
    };
    const pending =
      updateDebit.isPending ||
      updateIncome.isPending ||
      updateInvestment.isPending ||
      addDebit.isPending ||
      addIncome.isPending ||
      removeDebit.isPending ||
      removeIncome.isPending;
    return (
      <>
      <Modal open={open && !askDuplicate && !askDelete} onClose={onClose} title="Editar lançamento">
        <div className="space-y-4">
          <Field label={single.kind === "investment" ? "Tipo" : "Descrição"}>
            <AutocompleteInput
              value={description}
              onChange={setDescription}
              suggestions={suggestions}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={singleType === "parcelled" && convMode === "perInstallment" ? "Valor por parcela" : "Valor"}>
              <CurrencyInput value={amount} onValueChange={setAmount} allowNegative />
            </Field>
            <Field label="Data da compra">
              <input
                type="date"
                className={inputClass}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </Field>
          </div>

          {single.kind === "debit" && singleType === "cash" && (
            <div className="rounded-lg border border-border bg-background/50 p-3">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={notifyEnabled}
                  onChange={(e) => {
                    setNotifyEnabled(e.target.checked);
                    if (e.target.checked && !notifyDaysBefore) setNotifyDaysBefore("1");
                  }}
                  className="h-4 w-4 accent-primary"
                />
                <span className="text-sm font-medium">Notificar antes do vencimento</span>
              </label>
              {notifyEnabled && (
                <div className="mt-3">
                  <Field label="Quantos dias antes?">
                    <input
                      type="number"
                      min={0}
                      max={30}
                      className={inputClass}
                      value={notifyDaysBefore}
                      onChange={(e) => setNotifyDaysBefore(e.target.value)}
                    />
                  </Field>
                </div>
              )}
            </div>
          )}

          {canConvert && (
            <>
              <label className="flex items-center gap-3 rounded-lg border border-border bg-background/50 p-3">
                <input
                  type="checkbox"
                  checked={singleType === "parcelled"}
                  onChange={(e) => setSingleType(e.target.checked ? "parcelled" : "cash")}
                  className="h-4 w-4 accent-primary"
                />
                <span className="text-sm font-medium">É parcelado?</span>
              </label>

              {singleType === "parcelled" && (
                <div className="space-y-3 rounded-lg border border-border bg-background/30 p-3">
                  <div className="flex gap-1 rounded-full bg-secondary p-1">
                    <button
                      type="button"
                      onClick={() => setConvMode("total")}
                      className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                        convMode === "total" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                      }`}
                    >
                      Valor total
                    </button>
                    <button
                      type="button"
                      onClick={() => setConvMode("perInstallment")}
                      className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                        convMode === "perInstallment" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                      }`}
                    >
                      Valor por parcela
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Total de parcelas">
                      <input
                        type="number"
                        min="2"
                        max="60"
                        className={inputClass}
                        value={convInstallments}
                        onChange={(e) => setConvInstallments(e.target.value)}
                      />
                    </Field>
                    <Field label="Parcela atual">
                      <input
                        type="number"
                        min="1"
                        max={convN}
                        className={inputClass}
                        value={convInstNumber}
                        onChange={(e) => setConvInstNumber(e.target.value)}
                      />
                    </Field>
                  </div>
                  {amount > 0 && convN > 1 && (
                    <p className="text-xs text-muted-foreground">
                      {convN}x de <span className="font-semibold text-foreground">{formatCurrency(convPer)}</span> · total{" "}
                      <span className="font-semibold text-foreground">{formatCurrency(convTotal)}</span>
                      <br />
                      Esta é a parcela <span className="font-semibold text-foreground">{convCur}/{convN}</span>.
                    </p>
                  )}
                </div>
              )}

              <label className="flex items-start gap-3 rounded-lg border border-border bg-background/50 p-3">
                <input
                  type="checkbox"
                  checked={singleType === "recurring"}
                  onChange={(e) => setSingleType(e.target.checked ? "recurring" : "cash")}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                />
                <span className="text-sm">
                  <span className="font-medium">Recorrente</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    Replicado automaticamente nos próximos 24 meses, mantendo o dia.
                  </span>
                </span>
              </label>

              {singleType !== "cash" && (
                <p className="text-[11px] text-amber-500/90">
                  ⚠ Ao salvar, o lançamento atual será substituído pela nova série.
                </p>
              )}
            </>
          )}

          {single.kind !== "investment" && singleType === "cash" && (
            <label className="flex items-center gap-3 rounded-lg border border-border bg-background/50 p-3">
              <input
                type="checkbox"
                checked={paid}
                onChange={(e) => setPaid(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              <span className="text-sm font-medium">
                {single.kind === "debit" ? "Marcado como pago" : "Marcado como recebido"}
              </span>
            </label>
          )}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setAskDuplicate(true)}
              disabled={duplicate.isPending}
              className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
              title="Duplicar lançamento"
            >
              <Copy className="h-4 w-4" />
            </button>
            {onDeleteParent && (
              <button
                onClick={async () => {
                  const ok = await confirm({
                    title: "Excluir lançamento",
                    description: `Excluir "${single.description}"?`,
                    variant: "destructive",
                    confirmLabel: "Excluir",
                  });
                  if (ok) {
                    onDeleteParent();
                    onClose();
                  }
                }}
                className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/20"
                title="Excluir lançamento"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-border bg-background py-2.5 text-sm font-semibold hover:bg-secondary"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={pending || !description.trim() || amount === 0}
              className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>
      </Modal>

      <CardScopeConfirmDialog
        open={askDuplicate}
        onClose={() => setAskDuplicate(false)}
        title={`Duplicar · ${single.description || "lançamento"}`}
        description="Será criada uma cópia independente em cada mês do escopo selecionado."
        confirmLabel="Duplicar"
        defaultYear={dupAnchorY}
        defaultMonth={dupAnchorM}
        initialKind="month"
        loading={duplicate.isPending}
        onConfirm={async (s: CardScope) => {
          const src =
            single.kind === "debit"
              ? { kind: "debit" as const, accountId: single.accountId, description: single.description, amount: single.amount, date: single.date, required: false, paid: !!single.paid }
              : single.kind === "income"
              ? { kind: "income" as const, accountId: single.accountId, description: single.description, amount: single.amount, date: single.date, received: !!single.paid }
              : { kind: "investment" as const, accountId: single.accountId, type: single.description, amount: single.amount, percentage: 0, date: single.date };
          await duplicate.mutateAsync({ source: src, scope: s, anchorYear: dupAnchorY, anchorMonth: dupAnchorM });
          setAskDuplicate(false);
          onClose();
        }}
      />

      <CardScopeConfirmDialog
        open={askDelete}
        onClose={() => setAskDelete(false)}
        title={`Excluir · ${single.description || "lançamento"}`}
        description="Serão removidos lançamentos correspondentes (mesma descrição e valor) em cada mês do escopo selecionado."
        confirmLabel="Excluir"
        variant="destructive"
        defaultYear={dupAnchorY}
        defaultMonth={dupAnchorM}
        initialKind="month"
        loading={deleteScope.isPending}
        onConfirm={async (s: CardScope) => {
          // For the anchor month, also remove the currently-edited row to ensure
          // it is deleted even if data drifted (e.g. amount edited but not saved).
          if (s.kind === "month" && s.year === dupAnchorY && s.month === dupAnchorM && onDeleteParent) {
            onDeleteParent();
          } else {
            const src: DeleteSource =
              single.kind === "debit"
                ? { kind: "debit", accountId: single.accountId, description: single.description, amount: single.amount }
                : single.kind === "income"
                ? { kind: "income", accountId: single.accountId, description: single.description, amount: single.amount }
                : { kind: "investment", accountId: single.accountId, type: single.description, amount: single.amount };
            await deleteScope.mutateAsync({ source: src, scope: s, anchorYear: dupAnchorY, anchorMonth: dupAnchorM });
          }
          setAskDelete(false);
          onClose();
        }}
      />
      </>
    );
  }

  // ───── INSTALLMENT (parcela) ─────
  const inst = installment!;
  const baselineDate = effectiveDate || inst.dueDate;
  const dateChanged = dueDate !== baselineDate;
  const amountChanged = amount !== inst.amount;
  const paidChanged = paid !== inst.paid;
  const remaining = Math.max(0, inst.total - inst.number);
  const isSingleParcel = inst.total <= 1;

  async function commit(scope: InstallmentScope) {
    // Date edit: the typed date is ONLY a visual reference — it never
    // touches the installment's own month/dueDate (that's a separate,
    // explicit action — renumber/recreate — never a side effect of editing
    // the date).
    //   - Single occurrence (cash purchase / one month of a recurring
    //     series, total=1): there's only one row, so it just updates the
    //     parent's shared date field directly, no scope needed.
    //   - Genuine multi-installment series (total>1): scoped per-parcela via
    //     `reference_date` (só esta / esta e as próximas / toda a conta —
    //     P7-P9), so different parcelas CAN show different dates.
    //   - Fallback (no parent match, e.g. investments): shift the
    //     installment date directly.
    if (dateChanged) {
      if (isSingleParcel && parentDate) {
        if (inst.parentType === "purchase") {
          await updatePurchase.mutateAsync({ id: inst.parentId, date: dueDate });
        } else if (inst.parentType === "debit") {
          await updateDebit.mutateAsync({ id: inst.parentId, date: dueDate });
        } else if (inst.parentType === "income") {
          await updateIncome.mutateAsync({ id: inst.parentId, date: dueDate });
        }
      } else if (!isSingleParcel && parentDate) {
        await updateDateScope.mutateAsync({ installment: inst, newDate: dueDate, scope });
      } else {
        await shift.mutateAsync({ installment: inst, newDate: dueDate, scope });
      }
    }
    if (amountChanged) {
      await updateAmountScope.mutateAsync({ installment: inst, amount, scope });
    }
    if (paidChanged) {
      await update.mutateAsync({ id: inst.id, paid });
    }
    // Atualiza descrição do parent (purchase / debit / income) se mudou
    if (description.trim() && description.trim() !== (parentLabel ?? "")) {
      const newDesc = description.trim();
      if (inst.parentType === "purchase") {
        await updatePurchase.mutateAsync({ id: inst.parentId, description: newDesc });
      } else if (inst.parentType === "debit") {
        await updateDebit.mutateAsync({ id: inst.parentId, description: newDesc });
      } else if (inst.parentType === "income") {
        await updateIncome.mutateAsync({ id: inst.parentId, description: newDesc });
      }
    }
    onClose();
  }

  const handleSave = async () => {
    // Scope prompt is needed for both amount AND date edits on a genuine
    // multi-installment series — each can differ per-parcela (P7-P12).
    if ((amountChanged || dateChanged) && !isSingleParcel) {
      setAskDateScope(true);
      return;
    }
    await commit("current");
  };

  if (askDateScope) {
    const summary = (() => {
      const parts: string[] = [];
      if (dateChanged) parts.push(`nova data ${formatDate(dueDate)}`);
      if (amountChanged) parts.push(`novo valor ${formatCurrency(amount)}`);
      return parts.join(" e ");
    })();
    const dateNote = dateChanged
      ? " Nenhuma parcela muda de mês — só a data exibida."
      : "";
    return (
      <Modal open={open} onClose={() => setAskDateScope(false)} title="Aplicar alterações para…">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Você alterou {summary}. Como deseja aplicar?
          </p>
          <button
            onClick={() => commit("current")}
            className="flex w-full flex-col items-start gap-1 rounded-xl border border-border bg-background/50 p-4 text-left hover:border-primary"
          >
            <span className="font-semibold">Apenas esta parcela</span>
            <span className="text-xs text-muted-foreground">
              Só a parcela {inst.number}/{inst.total} muda.{dateNote}
            </span>
          </button>
          {remaining > 0 && (
            <button
              onClick={() => commit("future")}
              className="flex w-full flex-col items-start gap-1 rounded-xl border border-border bg-background/50 p-4 text-left hover:border-primary"
            >
              <span className="font-semibold">Esta e as próximas parcelas</span>
              <span className="text-xs text-muted-foreground">
                As {inst.total - inst.number + 1} parcelas a partir desta passam a exibir o mesmo valor{dateChanged ? "/data" : ""}.{dateNote}
              </span>
            </button>
          )}
          <button
            onClick={() => commit("all")}
            className="flex w-full flex-col items-start gap-1 rounded-xl border border-border bg-background/50 p-4 text-left hover:border-primary"
          >
            <span className="font-semibold">Todas as parcelas</span>
            <span className="text-xs text-muted-foreground">
              As {inst.total} parcelas passam a exibir o mesmo valor{dateChanged ? "/data" : ""}.{dateNote}
            </span>
          </button>
          <button onClick={() => setAskDateScope(false)} className="w-full rounded-lg border border-border bg-background py-2 text-sm font-semibold hover:bg-secondary">
            Voltar
          </button>
        </div>
      </Modal>
    );
  }

  const canManage = true;

  return (
    <>
      <Modal open={open && !askDuplicate} onClose={onClose} title="Editar lançamento">
        <div className="space-y-4">
          <Field label="Descrição">
            <AutocompleteInput
              value={description}
              onChange={setDescription}
              suggestions={suggestions}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor">
              <CurrencyInput value={amount} onValueChange={setAmount} allowNegative />
            </Field>
            <Field label="Data da compra">
              <input
                type="date"
                className={inputClass}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </Field>
          </div>
          <p className="-mt-2 text-[11px] text-muted-foreground">
            Valor atual da parcela: {formatCurrency(inst.amount)}.
          </p>
          {latestAdjustment.data && (
            <p className="-mt-2 text-[11px] text-amber-500/90">
              Histórico: valor original {formatCurrency(latestAdjustment.data.previousTotal)} → ajustado para {formatCurrency(latestAdjustment.data.newTotal)}.
            </p>
          )}

          <label className="flex items-center gap-3 rounded-lg border border-border bg-background/50 p-3">
            <input
              type="checkbox"
              checked={paid}
              onChange={(e) => setPaid(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            <span className="text-sm font-medium">Marcada como paga</span>
          </label>

          {(inst.total > 1 || parentSubtitle) && (
            canManage ? (
              <button
                type="button"
                onClick={() => setManageView("menu")}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-background/50 px-3 py-2.5 text-left transition hover:border-primary/50 hover:bg-background"
              >
                <Settings2 className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  {inst.total > 1 && (
                    <p className="text-[12px] font-semibold text-foreground">
                      Parcela {inst.number} de {inst.total}
                    </p>
                  )}
                  {parentSubtitle && (
                    <p className="text-[11px] text-muted-foreground truncate">{parentSubtitle}</p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ) : (
              <div className="rounded-xl border border-border bg-background/50 px-3 py-2 text-[11px] text-muted-foreground">
                {inst.total > 1 && (
                  <p>
                    <span className="font-semibold text-foreground">Parcela {inst.number} de {inst.total}</span>
                  </p>
                )}
                {parentSubtitle && <p className={inst.total > 1 ? "mt-0.5" : ""}>{parentSubtitle}</p>}
              </div>
            )
          )}

          <div className="flex gap-2 pt-2">
            {(parentSource || inst.total > 1) && (
              <button
                onClick={() => {
                  // Parcelled → open checklist picker (pré-seleciona a parcela atual).
                  // Single (recorrente/avulso) → keep original CardScopeConfirmDialog flow.
                  if (inst.total > 1) {
                    setSelectedDupIds(new Set([inst.id]));
                    setAskDuplicateParcelled(true);
                  } else {
                    setAskDuplicate(true);
                  }
                }}
                disabled={duplicate.isPending || duplicateSeries.isPending || duplicateSelection.isPending}
                className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
                title="Duplicar lançamento"
              >
                <Copy className="h-4 w-4" />
              </button>
            )}
            {onDeleteParent && (
              <button
                onClick={() => {
                  onDeleteParent();
                  onClose();
                }}
                className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/20"
                title="Excluir lançamento parcelado"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button onClick={onClose} className="flex-1 rounded-lg border border-border bg-background py-2.5 text-sm font-semibold hover:bg-secondary">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={update.isPending || shift.isPending || updateAmountScope.isPending}
              className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {update.isPending || shift.isPending || updateAmountScope.isPending ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={manageView !== "none"}
        onClose={() => setManageView("none")}
        title={
          manageView === "advance"
            ? "Antecipar parcelas"
            : manageView === "change"
            ? "Alterar parcelamento"
            : "Gerenciar parcelamento"
        }
      >
        {manageView === "menu" && (
          <div className="space-y-3">
            <p className="text-[11px] text-muted-foreground">
              Parcela {inst.number} de {inst.total}
              {parentSubtitle ? ` · ${parentSubtitle}` : ""}
            </p>
            {remaining > 0 && (
              <button
                onClick={() => setManageView("advance")}
                className="flex w-full items-start gap-3 rounded-xl border border-border bg-background/50 p-4 text-left hover:border-primary"
              >
                <FastForward className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold">Antecipar parcelas</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Marcar N parcelas futuras como pagas. Restam {remaining}.
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
              </button>
            )}
            <button
              onClick={async () => {
                const ok = await confirm({
                  title: "Postergar parcela",
                  description: `A parcela ${inst.number}/${inst.total} vai se juntar à parcela seguinte no mesmo mês. As demais parcelas não mudam.`,
                  confirmLabel: "Postergar",
                });
                if (!ok) return;
                await postpone.mutateAsync({ installment: inst });
                setManageView("none");
                onClose();
              }}
              disabled={postpone.isPending}
              className="flex w-full items-start gap-3 rounded-xl border border-border bg-background/50 p-4 text-left hover:border-primary disabled:opacity-50"
            >
              <Rewind className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold">Postergar parcela</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Empurra esta parcela para o mês seguinte, juntando com a próxima.
                </p>
              </div>
            </button>
            <button
              onClick={() => setManageView("change")}
              className="flex w-full items-start gap-3 rounded-xl border border-border bg-background/50 p-4 text-left hover:border-primary"
            >
              <RefreshCw className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold">Alterar parcelamento</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Recriar todas as parcelas com novo nº ou valor total, ou renumerar esta parcela.
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
            </button>
            <button
              onClick={() => setManageView("none")}
              className="w-full rounded-lg border border-border bg-background py-2 text-sm font-semibold hover:bg-secondary"
            >
              Fechar
            </button>
          </div>
        )}

        {manageView === "advance" && (
          <div className="space-y-3">
            <button
              onClick={() => setManageView("menu")}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar
            </button>
            <p className="text-[11px] text-muted-foreground">
              Quantas parcelas futuras você antecipou? Restam {remaining}.
            </p>
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                max={remaining}
                placeholder={`1 a ${remaining}`}
                className={inputClass}
                value={advanceCount}
                onChange={(e) => setAdvanceCount(e.target.value)}
                autoFocus
              />
              <button
                onClick={async () => {
                  const n = Math.min(remaining, Math.max(1, parseInt(advanceCount) || 0));
                  if (!n) return;
                  const ok = await confirm({
                    title: "Antecipar parcelas",
                    description: `Antecipar ${n} parcela(s)?`,
                    confirmLabel: "Antecipar",
                  });
                  if (!ok) return;
                  await advance.mutateAsync({ installment: inst, count: n });
                  setManageView("none");
                  onClose();
                }}
                disabled={advance.isPending || !advanceCount}
                className="whitespace-nowrap rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {advance.isPending ? "Antecipando…" : "Antecipar"}
              </button>
            </div>
          </div>
        )}

        {manageView === "change" && (() => {
          const nParsed = Math.max(1, parseInt(newInstCount) || 1);
          const perInstallmentFixed = inst.amount;
          const computedTotal =
            recreateMode === "keepPerInstallment"
              ? perInstallmentFixed * nParsed
              : newTotalAmount;
          const computedPer = nParsed > 0 ? computedTotal / nParsed : 0;
          const newNumParsed = Math.max(
            1,
            Math.min(inst.total, parseInt(newCurrentNumber) || inst.number),
          );
          return (
            <div className="space-y-4">
              <button
                onClick={() => setManageView("menu")}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar
              </button>

              {/* SECAO 1 — Recriar parcelamento */}
              <div className="space-y-3">
                <p className="text-[12px] font-semibold text-foreground">Recriar parcelamento</p>
                <p className="text-[11px] text-muted-foreground">
                  Recria todas as parcelas a partir da data da primeira. Status de pagamento será resetado.
                </p>
                <div className="flex gap-1 rounded-full bg-secondary p-1">
                  <button
                    type="button"
                    onClick={() => setRecreateMode("recalculate")}
                    className={`flex-1 rounded-full px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                      recreateMode === "recalculate" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                    }`}
                  >
                    Recalcular valor por parcela
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecreateMode("keepPerInstallment")}
                    className={`flex-1 rounded-full px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                      recreateMode === "keepPerInstallment" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                    }`}
                  >
                    Manter valor por parcela
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Nº parcelas">
                    <input
                      type="number"
                      min={1}
                      max={120}
                      className={inputClass}
                      value={newInstCount}
                      onChange={(e) => setNewInstCount(e.target.value)}
                    />
                  </Field>
                  <Field label="Valor total">
                    {recreateMode === "keepPerInstallment" ? (
                      <input
                        type="text"
                        disabled
                        className={inputClass}
                        value={formatCurrency(computedTotal)}
                      />
                    ) : (
                      <CurrencyInput value={newTotalAmount} onValueChange={setNewTotalAmount} />
                    )}
                  </Field>
                </div>
                {nParsed > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    {nParsed}x de <span className="font-semibold text-foreground">{formatCurrency(computedPer)}</span> · total{" "}
                    <span className="font-semibold text-foreground">{formatCurrency(computedTotal)}</span>
                  </p>
                )}
                <button
                  onClick={async () => {
                    if (!nParsed || computedTotal <= 0) return;
                    const ok = await confirm({
                      title: "Alterar parcelamento",
                      description: `Recriar como ${nParsed}x de ${formatCurrency(computedPer)}?`,
                      confirmLabel: "Alterar",
                    });
                    if (!ok) return;
                    await changeInstSeries.mutateAsync({
                      parentId: inst.parentId,
                      parentType: inst.parentType,
                      newCount: nParsed,
                      totalAmount: computedTotal,
                    });
                    setManageView("none");
                    onClose();
                  }}
                  disabled={changeInstSeries.isPending}
                  className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {changeInstSeries.isPending ? "Alterando…" : "Aplicar novo parcelamento"}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Renumerar
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* SECAO 2 — Renumerar parcela */}
              <div className="space-y-3">
                <p className="text-[12px] font-semibold text-foreground">Renumerar parcela</p>
                <p className="text-[11px] text-muted-foreground">
                  Move esta parcela para outra posição na série, mantendo o mês de cada parcela
                  restante. As parcelas anteriores a esta e as que não couberem no novo intervalo
                  serão removidas.
                </p>
                <Field label="Parcela atual">
                  <input
                    type="number"
                    min={1}
                    max={inst.total}
                    className={inputClass}
                    value={newCurrentNumber}
                    onChange={(e) => setNewCurrentNumber(e.target.value)}
                  />
                </Field>
                <button
                  onClick={async () => {
                    if (newNumParsed === inst.number) return;
                    const ok = await confirm({
                      title: "Renumerar parcela",
                      description: `Mover a parcela ${inst.number}/${inst.total} para a posição ${newNumParsed}? As parcelas anteriores à ${inst.number}/${inst.total} e as que ficarem fora do intervalo 1-${inst.total} serão excluídas.`,
                      confirmLabel: "Renumerar",
                    });
                    if (!ok) return;
                    const createMissing = await confirm({
                      title: "Criar parcelas faltantes?",
                      description: "Algumas posições da série ficarão sem parcela. Deseja criá-las agora, em meses consecutivos a partir desta parcela?",
                      confirmLabel: "Criar faltantes",
                      cancelLabel: "Não criar",
                    });
                    await renumberInstallment.mutateAsync({
                      parentId: inst.parentId,
                      parentType: inst.parentType,
                      installmentId: inst.id,
                      oldNumber: inst.number,
                      newNumber: newNumParsed,
                      total: inst.total,
                      amount: inst.amount,
                      createMissing,
                    });
                    setManageView("none");
                    onClose();
                  }}
                  disabled={renumberInstallment.isPending || newCurrentNumber === String(inst.number)}
                  className="w-full rounded-lg border border-primary bg-primary/10 py-2 text-sm font-semibold text-primary hover:bg-primary/20 disabled:opacity-50"
                >
                  {renumberInstallment.isPending ? "Renumerando…" : "Aplicar só a renumeração"}
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {parentSource && (
        <CardScopeConfirmDialog
          open={askDuplicate}
          onClose={() => setAskDuplicate(false)}
          title={`Duplicar · ${parentLabel ?? "lançamento"}`}
          description="Será criada uma cópia independente em cada mês do escopo selecionado."
          confirmLabel="Duplicar"
          defaultYear={dupAnchorY}
          defaultMonth={dupAnchorM}
          initialKind="month"
          loading={duplicate.isPending}
          onConfirm={async (s: CardScope) => {
            await duplicate.mutateAsync({
              source: parentSource,
              scope: s,
              anchorYear: dupAnchorY,
              anchorMonth: dupAnchorM,
            });
            setAskDuplicate(false);
            onClose();
          }}
        />
      )}

      <Modal
        open={askDuplicateParcelled}
        onClose={() => setAskDuplicateParcelled(false)}
        title={`Duplicar · ${parentLabel ?? "lançamento parcelado"}`}
      >
        {(() => {
          const siblings = allInstallments
            .filter((r) => r.parentId === inst.parentId && r.parentType === inst.parentType)
            .slice()
            .sort((a, b) => (a.year - b.year) || (a.month - b.month) || (a.number - b.number));
          const allSelected = siblings.length > 0 && siblings.every((s) => selectedDupIds.has(s.id));
          const toggle = (id: string) => {
            setSelectedDupIds((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            });
          };
          const paidLabel = inst.parentType === "income" ? "Recebida" : "Paga";
          return (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Selecione as parcelas que deseja duplicar. Cada uma será copiada no seu próprio mês, mantendo valor e status.
              </p>

              <div className="flex items-center justify-between rounded-lg border border-border bg-background/50 px-3 py-2 text-xs">
                <span className="text-muted-foreground">
                  {selectedDupIds.size} de {siblings.length} selecionadas
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedDupIds(allSelected ? new Set() : new Set(siblings.map((s) => s.id)))
                  }
                  className="font-semibold text-primary hover:underline"
                >
                  {allSelected ? "Limpar" : "Selecionar todas"}
                </button>
              </div>

              <div className="max-h-80 overflow-y-auto space-y-1.5">
                {siblings.map((s) => {
                  const checked = selectedDupIds.has(s.id);
                  return (
                    <label
                      key={s.id}
                      className={`flex items-center gap-3 rounded-lg border p-3 text-sm transition-colors cursor-pointer ${
                        checked ? "border-primary bg-primary/5" : "border-border bg-background/50 hover:border-primary/60"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(s.id)}
                        className="h-4 w-4 accent-primary"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">
                            {s.number}/{s.total}
                          </span>
                          <span className="text-muted-foreground">
                            · {MONTHS[s.month]} de {s.year}
                          </span>
                          {s.paid && (
                            <span className="ml-auto rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                              {paidLabel}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatCurrency(s.amount)}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setAskDuplicateParcelled(false)}
                  disabled={duplicateSelection.isPending}
                  className="flex-1 rounded-lg border border-border bg-background py-2.5 text-sm font-semibold hover:bg-secondary disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    if (selectedDupIds.size === 0) return;
                    await duplicateSelection.mutateAsync({
                      parentId: inst.parentId,
                      parentType: inst.parentType,
                      installmentIds: Array.from(selectedDupIds),
                    });
                    setAskDuplicateParcelled(false);
                    onClose();
                  }}
                  disabled={selectedDupIds.size === 0 || duplicateSelection.isPending}
                  className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {duplicateSelection.isPending ? "Duplicando…" : `Duplicar ${selectedDupIds.size || ""}`}
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </>
  );
}
