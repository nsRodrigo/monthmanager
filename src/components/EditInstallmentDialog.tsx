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
  type Installment,
} from "@/store/finance";
import { CurrencyInput } from "./CurrencyInput";
import { formatCurrency, formatDate } from "@/lib/format";
import { Trash2, FastForward } from "lucide-react";
import { useConfirm } from "@/store/confirm";

export type SingleEditTarget =
  | { kind: "debit"; id: string; description: string; amount: number; date: string; paid: boolean }
  | { kind: "income"; id: string; description: string; amount: number; date: string; paid: boolean }
  | { kind: "investment"; id: string; description: string; amount: number; date: string };

export function EditInstallmentDialog({
  open,
  onClose,
  installment,
  single,
  parentLabel,
  parentSubtitle,
  onDeleteParent,
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
}) {
  const update = useUpdateInstallment();
  const shift = useShiftInstallmentDate();
  const advance = useAdvanceInstallments();
  const updateDebit = useUpdateDebit();
  const updateIncome = useUpdateIncome();
  const updateInvestment = useUpdateInvestment();
  const updatePurchase = useUpdatePurchase();
  const confirm = useConfirm();

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [dueDate, setDueDate] = useState("");
  const [paid, setPaid] = useState(false);
  const [askDateScope, setAskDateScope] = useState(false);
  const [advanceCount, setAdvanceCount] = useState("");

  useEffect(() => {
    if (!open) return;
    if (installment) {
      setDescription(parentLabel ?? "");
      setAmount(installment.amount);
      setDueDate(installment.dueDate);
      setPaid(installment.paid);
    } else if (single) {
      setDescription(single.description);
      setAmount(single.amount);
      setDueDate(single.date);
      setPaid(single.kind === "investment" ? false : single.paid);
    }
    setAskDateScope(false);
    setAdvanceCount("");
  }, [open, installment, single, parentLabel]);

  if (!installment && !single) return null;

  // ───── SINGLE (Debit / Income / Investment) ─────
  if (single) {
    const handleSave = async () => {
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
      updateDebit.isPending || updateIncome.isPending || updateInvestment.isPending;
    return (
      <Modal open={open} onClose={onClose} title="Editar lançamento">
        <div className="space-y-4">
          <Field label={single.kind === "investment" ? "Tipo" : "Descrição"}>
            <input
              className={inputClass}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor">
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
          {single.kind !== "investment" && (
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={inst.total > 1 ? `Parcela ${inst.number}/${inst.total}` : "Editar lançamento"}
    >
      <div className="space-y-4">
        {parentLabel && (
          <div className="rounded-xl border border-border bg-background/50 p-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Item</p>
            <p className="mt-1 font-semibold">{parentLabel}</p>
            {parentSubtitle && <p className="mt-1 text-xs text-muted-foreground">{parentSubtitle}</p>}
          </div>
        )}

        <Field label="Valor">
          <CurrencyInput value={amount} onValueChange={setAmount} allowNegative />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Valor atual: {formatCurrency(inst.amount)}.
          </p>
        </Field>

        <Field label="Data de vencimento">
          <input
            type="date"
            className={inputClass}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </Field>

        <label className="flex items-center gap-3 rounded-lg border border-border bg-background/50 p-3">
          <input
            type="checkbox"
            checked={paid}
            onChange={(e) => setPaid(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          <span className="text-sm font-medium">Marcada como paga</span>
        </label>

        {remaining > 0 && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
            <div className="flex items-center gap-2">
              <FastForward className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Antecipar parcelas</p>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Quantas parcelas futuras você antecipou? Restam {remaining}.
            </p>
            <div className="mt-2 flex gap-2">
              <input
                type="number"
                min={1}
                max={remaining}
                placeholder={`1 a ${remaining}`}
                className={inputClass}
                value={advanceCount}
                onChange={(e) => setAdvanceCount(e.target.value)}
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
  );
}
