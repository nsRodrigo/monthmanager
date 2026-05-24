import { useEffect, useState } from "react";
import { Modal, Field, inputClass } from "./Modal";
import { CurrencyInput } from "./CurrencyInput";
import { useUpdateRecurringSeries, useDeleteRecurringSeries, useDuplicateOverScope, type CardScope } from "@/store/finance";
import { useConfirm } from "@/store/confirm";
import { Trash2, Copy } from "lucide-react";
import { CardScopeConfirmDialog } from "./CardScopeConfirmDialog";

export type RecurringEditTarget = {
  kind: "debit" | "income";
  id: string;
  groupId: string;
  description: string;
  amount: number;
  date: string;
  accountId: string;
};

/**
 * Edit dialog for a single occurrence of a recurring series.
 * Lets the user pick scope: only this month, or this and all future months
 * sharing the same `recurrence_group_id`.
 */
export function EditRecurringDialog({
  open,
  onClose,
  target,
}: {
  open: boolean;
  onClose: () => void;
  target: RecurringEditTarget | null;
}) {
  const update = useUpdateRecurringSeries();
  const remove = useDeleteRecurringSeries();
  const confirm = useConfirm();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState("");
  const [scope, setScope] = useState<"one" | "forward">("one");

  useEffect(() => {
    if (!open || !target) return;
    setDescription(target.description);
    setAmount(target.amount);
    setDate(target.date);
    setScope("one");
  }, [open, target]);

  if (!target) return null;

  const dirty =
    description.trim() !== target.description ||
    amount !== target.amount ||
    date !== target.date;

  const save = async () => {
    if (!description.trim() || amount === 0) return;
    const patch: { description?: string; amount?: number; date?: string } = {};
    if (description.trim() !== target.description) patch.description = description.trim();
    if (amount !== target.amount) patch.amount = amount;
    if (date !== target.date) patch.date = date;
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    await update.mutateAsync({
      kind: target.kind,
      id: target.id,
      groupId: target.groupId,
      anchorDate: target.date,
      scope,
      patch,
    });
    onClose();
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: "Excluir recorrente",
      description:
        scope === "forward"
          ? "Este lançamento e todos os meses seguintes da série serão removidos."
          : "Apenas este mês será removido. Os outros meses da série permanecem.",
      variant: "destructive",
      confirmLabel: "Excluir",
    });
    if (!ok) return;
    await remove.mutateAsync({
      kind: target.kind,
      id: target.id,
      groupId: target.groupId,
      anchorDate: target.date,
      scope,
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Editar lançamento recorrente">
      <div className="space-y-4">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Recorrente</span> · cada mês é um
          lançamento independente. Escolha abaixo o escopo da alteração.
        </div>

        <Field label={target.kind === "debit" ? "Descrição do débito" : "Descrição do recebimento"}>
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
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Aplicar em
          </p>
          <label className="flex items-start gap-3 rounded-xl border border-border bg-background/50 p-3 cursor-pointer hover:border-primary">
            <input
              type="radio"
              name="rec-scope"
              checked={scope === "one"}
              onChange={() => setScope("one")}
              className="mt-0.5 h-4 w-4 accent-primary"
            />
            <span className="text-sm">
              <span className="font-semibold">Apenas este mês</span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                Os demais meses da série não serão alterados.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-xl border border-border bg-background/50 p-3 cursor-pointer hover:border-primary">
            <input
              type="radio"
              name="rec-scope"
              checked={scope === "forward"}
              onChange={() => setScope("forward")}
              className="mt-0.5 h-4 w-4 accent-primary"
            />
            <span className="text-sm">
              <span className="font-semibold">Este e os próximos meses</span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                Aplica também em todos os meses futuros da mesma série.
              </span>
            </span>
          </label>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={handleDelete}
            disabled={remove.isPending}
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/20 disabled:opacity-50"
            title="Excluir conforme escopo selecionado"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border bg-background py-2.5 text-sm font-semibold hover:bg-secondary"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={update.isPending || !dirty || !description.trim() || amount === 0}
            className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {update.isPending ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
