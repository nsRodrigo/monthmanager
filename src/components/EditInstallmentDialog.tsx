import { useState, useEffect } from "react";
import { Modal, Field, inputClass } from "./Modal";
import {
  useUpdateInstallment,
  useShiftInstallmentDate,
  useAdvanceInstallments,
  type Installment,
} from "@/store/finance";
import { formatCurrency, formatDate } from "@/lib/format";
import { Trash2, FastForward } from "lucide-react";

export function EditInstallmentDialog({
  open,
  onClose,
  installment,
  parentLabel,
  parentSubtitle,
  onDeleteParent,
}: {
  open: boolean;
  onClose: () => void;
  installment: Installment | null;
  /** e.g. "Notebook Dell" — used in the modal header card */
  parentLabel?: string;
  parentSubtitle?: string;
  onDeleteParent?: () => void;
}) {
  const update = useUpdateInstallment();
  const shift = useShiftInstallmentDate();
  const advance = useAdvanceInstallments();
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [paid, setPaid] = useState(false);
  const [askDateScope, setAskDateScope] = useState(false);
  const [advanceCount, setAdvanceCount] = useState("");

  useEffect(() => {
    if (open && installment) {
      setAmount(String(installment.amount));
      setDueDate(installment.dueDate);
      setPaid(installment.paid);
      setAskDateScope(false);
      setAdvanceCount("");
    }
  }, [open, installment]);

  if (!installment) return null;

  const dateChanged = dueDate !== installment.dueDate;
  const amountChanged = parseFloat(amount) !== installment.amount;
  const paidChanged = paid !== installment.paid;
  const isLast = installment.number === installment.total;
  const remaining = Math.max(0, installment.total - installment.number);

  async function commit(applyToFuture: boolean) {
    if (!installment) return;
    // 1) shift date if changed
    if (dateChanged) {
      await shift.mutateAsync({
        installment,
        newDate: dueDate,
        applyToFuture,
      });
    }
    // 2) amount/paid only on this installment
    if (amountChanged || paidChanged) {
      await update.mutateAsync({
        id: installment.id,
        amount: amountChanged ? parseFloat(amount) : undefined,
        paid: paidChanged ? paid : undefined,
      });
    }
    onClose();
  }

  const handleSave = async () => {
    // If date changed and it isn't the last installment, ask scope.
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
              Só a parcela {installment.number}/{installment.total} muda.
            </span>
          </button>
          <button
            onClick={() => commit(true)}
            className="flex w-full flex-col items-start gap-1 rounded-xl border border-border bg-background/50 p-4 text-left hover:border-primary"
          >
            <span className="font-semibold">Esta e as próximas parcelas</span>
            <span className="text-xs text-muted-foreground">
              As {installment.total - installment.number + 1} parcelas a partir desta serão deslocadas mantendo o dia {Number(dueDate.slice(8, 10))}.
              Parcelas anteriores não são afetadas.
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
      title={installment.total > 1 ? `Parcela ${installment.number}/${installment.total}` : "Editar lançamento"}
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
          <input
            type="number"
            step="0.01"
            className={inputClass}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Valor atual: {formatCurrency(installment.amount)}. Ajuste só esta parcela sem afetar as outras.
          </p>
        </Field>

        <Field label="Data de vencimento">
          <input
            type="date"
            className={inputClass}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          {dateChanged && !isLast && (
            <p className="mt-1 text-[11px] text-primary">
              Você poderá aplicar a nova data apenas a esta ou também às próximas.
            </p>
          )}
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
              Quantas parcelas futuras você antecipou para esta fatura? Elas serão movidas
              para {formatDate(installment.dueDate)} e marcadas como pagas. Restam {remaining}.
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
                  if (!confirm(`Antecipar ${n} parcela(s) para a fatura de ${formatDate(installment.dueDate)}?`)) return;
                  await advance.mutateAsync({ installment, count: n });
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
              onClick={() => {
                if (confirm("Excluir o lançamento inteiro e todas as suas parcelas?")) {
                  onDeleteParent();
                  onClose();
                }
              }}
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/20"
              title="Excluir item completo"
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
