import { useState, useEffect } from "react";
import { Modal, Field, inputClass } from "./Modal";
import {
  useUpdateInstallment,
  useShiftInstallmentDate,
  useAdvanceInstallments,
  useUpdateDebit,
  useUpdateIncome,
  useUpdateInvestment,
  useUpdatePurchase,
  useChangePurchaseInstallments,
  useAddDebit,
  useAddIncome,
  useRemoveDebit,
  useRemoveIncome,
  useDescriptionSuggestions,
  useDuplicateOverScope,
  useDeleteOverScope,
  type Installment,
  type CardScope,
} from "@/store/finance";
import { CurrencyInput } from "./CurrencyInput";
import { AutocompleteInput } from "./AutocompleteInput";
import { formatCurrency, formatDate } from "@/lib/format";
import { Trash2, Copy, FastForward, Settings2, ChevronRight, RefreshCw, ArrowLeft } from "lucide-react";
import { useConfirm } from "@/store/confirm";
import { CardScopeConfirmDialog } from "./CardScopeConfirmDialog";

export type SingleEditTarget =
  | { kind: "debit"; id: string; accountId: string; description: string; amount: number; date: string; paid: boolean }
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
  defaultYear?: number;
  defaultMonth?: number;
}) {
  const update = useUpdateInstallment();
  const shift = useShiftInstallmentDate();
  const advance = useAdvanceInstallments();
  const updateDebit = useUpdateDebit();
  const updateIncome = useUpdateIncome();
  const updateInvestment = useUpdateInvestment();
  const updatePurchase = useUpdatePurchase();
  const changeInstCount = useChangePurchaseInstallments();
  const addDebit = useAddDebit();
  const addIncome = useAddIncome();
  const removeDebit = useRemoveDebit();
  const removeIncome = useRemoveIncome();
  const duplicate = useDuplicateOverScope();
  const deleteScope = useDeleteOverScope();
  
  const confirm = useConfirm();
  const [askDuplicate, setAskDuplicate] = useState(false);
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

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [dueDate, setDueDate] = useState("");
  const [paid, setPaid] = useState(false);
  const [askDateScope, setAskDateScope] = useState(false);
  const [advanceCount, setAdvanceCount] = useState("");
  const [newInstCount, setNewInstCount] = useState("");
  const [newTotalAmount, setNewTotalAmount] = useState<number>(0);
  const [manageView, setManageView] = useState<"none" | "menu" | "advance" | "change">("none");
  // Single-mode type conversion state
  const [singleType, setSingleType] = useState<"cash" | "parcelled" | "recurring">("cash");
  const [convInstallments, setConvInstallments] = useState("2");
  const [convInstNumber, setConvInstNumber] = useState("1");
  const [convMode, setConvMode] = useState<"total" | "perInstallment">("total");

  useEffect(() => {
    if (!open) return;
    if (installment) {
      setDescription(parentLabel ?? "");
      setAmount(installment.amount);
      setDueDate(installment.dueDate);
      setPaid(installment.paid);
      setNewInstCount(String(installment.total));
      setNewTotalAmount(installment.amount * installment.total);
    } else if (single) {
      setDescription(single.description);
      setAmount(single.amount);
      setDueDate(single.date);
      setPaid(single.kind === "investment" ? false : single.paid);
      setSingleType("cash");
      setConvInstallments("2");
      setConvInstNumber("1");
      setConvMode("total");
    }
    setAskDateScope(false);
    setAdvanceCount("");
    setManageView("none");
  }, [open, installment, single, parentLabel]);

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
      <Modal open={open && !askDuplicate} onClose={onClose} title="Editar lançamento">
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
            <Field label="Data">
              <input
                type="date"
                className={inputClass}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </Field>
          </div>

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
                  disabled={singleType === "parcelled"}
                  className="mt-0.5 h-4 w-4 accent-primary"
                />
                <span className="text-sm">
                  <span className="font-medium">Recorrente</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {singleType === "parcelled"
                      ? "Indisponível para parcelados."
                      : "Replicado automaticamente nos próximos 24 meses, mantendo o dia."}
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
                    description: "Tem certeza que deseja excluir este lançamento?",
                    variant: "destructive",
                    confirmLabel: "Excluir",
                  });
                  if (ok) {
                    onDeleteParent();
                    onClose();
                  }
                }}
                className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/20"
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
              ? { kind: "debit" as const, accountId: single.accountId, description: single.description, amount: single.amount, date: single.date, required: false }
              : single.kind === "income"
              ? { kind: "income" as const, accountId: single.accountId, description: single.description, amount: single.amount, date: single.date }
              : { kind: "investment" as const, accountId: single.accountId, type: single.description, amount: single.amount, percentage: 0, date: single.date };
          await duplicate.mutateAsync({ source: src, scope: s, anchorYear: dupAnchorY, anchorMonth: dupAnchorM });
          setAskDuplicate(false);
          onClose();
        }}
      />
      </>
    );
  }

  // ───── INSTALLMENT (parcela) ─────
  const inst = installment!;
  const dateChanged = dueDate !== inst.dueDate;
  const amountChanged = amount !== inst.amount;
  const paidChanged = paid !== inst.paid;
  const isLast = inst.number === inst.total;
  const remaining = Math.max(0, inst.total - inst.number);

  async function commit(applyToFuture: boolean) {
    if (dateChanged) {
      await shift.mutateAsync({ installment: inst, newDate: dueDate, applyToFuture });
    }
    if (amountChanged || paidChanged) {
      await update.mutateAsync({
        id: inst.id,
        amount: amountChanged ? amount : undefined,
        paid: paidChanged ? paid : undefined,
      });
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
    if (dateChanged && !isLast) {
      setAskDateScope(true);
      return;
    }
    await commit(false);
  };

  if (askDateScope) {
    return (
      <Modal open={open} onClose={() => setAskDateScope(false)} title="Aplicar nova data para…">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Você alterou a data para <span className="font-semibold text-foreground">{formatDate(dueDate)}</span>.
            Como deseja aplicar?
          </p>
          <button
            onClick={() => commit(false)}
            className="flex w-full flex-col items-start gap-1 rounded-xl border border-border bg-background/50 p-4 text-left hover:border-primary"
          >
            <span className="font-semibold">Apenas esta parcela</span>
            <span className="text-xs text-muted-foreground">
              Só a parcela {inst.number}/{inst.total} muda.
            </span>
          </button>
          <button
            onClick={() => commit(true)}
            className="flex w-full flex-col items-start gap-1 rounded-xl border border-border bg-background/50 p-4 text-left hover:border-primary"
          >
            <span className="font-semibold">Esta e as próximas parcelas</span>
            <span className="text-xs text-muted-foreground">
              As {inst.total - inst.number + 1} parcelas a partir desta serão deslocadas mantendo o dia {Number(dueDate.slice(8, 10))}.
            </span>
          </button>
          <button onClick={() => setAskDateScope(false)} className="w-full rounded-lg border border-border bg-background py-2 text-sm font-semibold hover:bg-secondary">
            Voltar
          </button>
        </div>
      </Modal>
    );
  }

  const canManage = remaining > 0 || inst.parentType === "purchase";

  return (
    <>
      <Modal open={open} onClose={onClose} title="Editar lançamento">
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
            <Field label="Data de vencimento">
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
            {onDeleteParent && (
              <button
                onClick={async () => {
                  const ok = await confirm({
                    title: "Excluir lançamento",
                    description: "Excluir o lançamento inteiro e todas as suas parcelas?",
                    variant: "destructive",
                    confirmLabel: "Excluir tudo",
                  });
                  if (ok) {
                    onDeleteParent();
                    onClose();
                  }
                }}
                className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/20"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button onClick={onClose} className="flex-1 rounded-lg border border-border bg-background py-2.5 text-sm font-semibold hover:bg-secondary">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={update.isPending || shift.isPending}
              className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {update.isPending || shift.isPending ? "Salvando…" : "Salvar"}
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
            {inst.parentType === "purchase" && (
              <button
                onClick={() => setManageView("change")}
                className="flex w-full items-start gap-3 rounded-xl border border-border bg-background/50 p-4 text-left hover:border-primary"
              >
                <RefreshCw className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold">Alterar parcelamento</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Recriar todas as parcelas com novo nº ou valor total.
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
              </button>
            )}
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

        {manageView === "change" && (
          <div className="space-y-3">
            <button
              onClick={() => setManageView("menu")}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar
            </button>
            <p className="text-[11px] text-muted-foreground">
              Recria todas as parcelas mantendo a data da 1ª. Status de pagamento será resetado.
            </p>
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
                <CurrencyInput value={newTotalAmount} onValueChange={setNewTotalAmount} />
              </Field>
            </div>
            <button
              onClick={async () => {
                const n = Math.max(1, parseInt(newInstCount) || 0);
                if (!n || newTotalAmount <= 0) return;
                if (n === inst.total && newTotalAmount === inst.amount * inst.total) return;
                const ok = await confirm({
                  title: "Alterar parcelamento",
                  description: `Recriar como ${n}x de ${formatCurrency(newTotalAmount / n)}?`,
                  confirmLabel: "Alterar",
                });
                if (!ok) return;
                await changeInstCount.mutateAsync({
                  purchaseId: inst.parentId,
                  newCount: n,
                  totalAmount: newTotalAmount,
                });
                setManageView("none");
                onClose();
              }}
              disabled={changeInstCount.isPending}
              className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {changeInstCount.isPending ? "Alterando…" : "Aplicar novo parcelamento"}
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}
