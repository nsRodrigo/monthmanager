import { useEffect, useState } from "react";
import { Modal, Field, inputClass } from "./Modal";
import { CurrencyInput } from "./CurrencyInput";
import { useUpdateRecurringSeries, useDeleteRecurringSeries, useDuplicateOverScope, useDeleteOverScope, type CardScope, type DeleteSource } from "@/store/finance";
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
  defaultYear,
  defaultMonth,
}: {
  open: boolean;
  onClose: () => void;
  target: RecurringEditTarget | null;
  defaultYear?: number;
  defaultMonth?: number;
}) {
  const update = useUpdateRecurringSeries();
  const remove = useDeleteRecurringSeries();
  const duplicate = useDuplicateOverScope();
  const deleteScope = useDeleteOverScope();
  const confirm = useConfirm();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState("");
  const [scope, setScope] = useState<"one" | "forward">("one");
  const [askDuplicate, setAskDuplicate] = useState(false);
  const [askDelete, setAskDelete] = useState(false);

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

  void confirm;





  return (
    <>
    <Modal open={open && !askDuplicate && !askDelete} onClose={onClose} title="Editar lançamento recorrente">
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
            onClick={() => setAskDuplicate(true)}
            disabled={duplicate.isPending}
            className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
            title="Duplicar lançamento"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            onClick={() => setAskDelete(true)}
            disabled={deleteScope.isPending || remove.isPending}
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/20 disabled:opacity-50"
            title="Excluir lançamento"
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

    <CardScopeConfirmDialog
      open={askDuplicate}
      onClose={() => setAskDuplicate(false)}
      title={`Duplicar · ${target.description}`}
      description="Será criada uma cópia independente do lançamento em cada mês do escopo selecionado."
      confirmLabel="Duplicar"
      defaultYear={defaultYear ?? new Date().getFullYear()}
      defaultMonth={defaultMonth ?? new Date().getMonth()}
      initialKind="month"
      loading={duplicate.isPending}
      onConfirm={async (s: CardScope) => {
        await duplicate.mutateAsync({
          source: {
            kind: target.kind,
            accountId: target.accountId,
            description: target.description,
            amount: target.amount,
            date: target.date,
            ...(target.kind === "debit" ? { required: true } : {}),
          } as never,
          scope: s,
          anchorYear: defaultYear ?? new Date().getFullYear(),
          anchorMonth: defaultMonth ?? new Date().getMonth(),
        });
        setAskDuplicate(false);
        onClose();
      }}
    />

    <CardScopeConfirmDialog
      open={askDelete}
      onClose={() => setAskDelete(false)}
      title={`Excluir · ${target.description}`}
      description="Serão removidos os lançamentos desta série recorrente em cada mês do escopo selecionado."
      confirmLabel="Excluir"
      variant="destructive"
      defaultYear={defaultYear ?? new Date().getFullYear()}
      defaultMonth={defaultMonth ?? new Date().getMonth()}
      initialKind="month"
      loading={deleteScope.isPending}
      onConfirm={async (s: CardScope) => {
        const src: DeleteSource = {
          kind: target.kind,
          accountId: target.accountId,
          description: target.description,
          amount: target.amount,
          groupId: target.groupId,
        };
        await deleteScope.mutateAsync({
          source: src,
          scope: s,
          anchorYear: defaultYear ?? new Date().getFullYear(),
          anchorMonth: defaultMonth ?? new Date().getMonth(),
        });
        setAskDelete(false);
        onClose();
      }}
    />
    </>
  );
}
