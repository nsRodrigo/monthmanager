import { useEffect, useState } from "react";
import { Modal, Field, inputClass } from "./Modal";
import { CurrencyInput } from "./CurrencyInput";
import {
  useUpdateRecurringSeries,
  useDeleteRecurringSeries,
  useUpdateRecurringPurchaseSeries,
  useDeleteRecurringPurchaseSeries,
  useDuplicateOverScope,
  useDeleteOverScope,
  type CardScope,
  type DeleteSource,
} from "@/store/finance";
import { useConfirm } from "@/store/confirm";
import { Trash2, Copy } from "lucide-react";
import { CardScopeConfirmDialog } from "./CardScopeConfirmDialog";

export type RecurringEditTarget =
  | {
      kind: "debit" | "income";
      id: string;
      groupId: string;
      description: string;
      amount: number;
      date: string;
      accountId: string;
    }
  | {
      kind: "purchase";
      id: string;
      groupId: string;
      description: string;
      amount: number;
      date: string;
      cardId: string;
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
  const updateDI = useUpdateRecurringSeries();
  const removeDI = useDeleteRecurringSeries();
  const updateP = useUpdateRecurringPurchaseSeries();
  const removeP = useDeleteRecurringPurchaseSeries();
  const duplicate = useDuplicateOverScope();
  const deleteScope = useDeleteOverScope();
  const confirm = useConfirm();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState("");
  const [askSaveScope, setAskSaveScope] = useState(false);
  const [askDuplicate, setAskDuplicate] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const [askDeletePurchaseScope, setAskDeletePurchaseScope] = useState(false);

  useEffect(() => {
    if (!open || !target) return;
    setDescription(target.description);
    setAmount(target.amount);
    setDate(target.date);
  }, [open, target]);

  if (!target) return null;

  const updating = updateDI.isPending || updateP.isPending;
  const removing = removeDI.isPending || removeP.isPending || deleteScope.isPending;

  const dirty =
    description.trim() !== target.description ||
    amount !== target.amount ||
    date !== target.date;

  const runUpdate = async (scope: "one" | "forward" | "all") => {
    const patch: { description?: string; amount?: number; date?: string } = {};
    if (description.trim() !== target.description) patch.description = description.trim();
    if (amount !== target.amount) patch.amount = amount;
    if (date !== target.date) patch.date = date;
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    if (target.kind === "purchase") {
      await updateP.mutateAsync({
        id: target.id,
        groupId: target.groupId,
        anchorDate: target.date,
        scope,
        patch,
      });
    } else {
      await updateDI.mutateAsync({
        kind: target.kind,
        id: target.id,
        groupId: target.groupId,
        anchorDate: target.date,
        scope,
        patch,
      });
    }
    setAskSaveScope(false);
    onClose();
  };

  const runDeletePurchase = async (scope: "one" | "forward" | "all") => {
    if (target.kind !== "purchase") return;
    await removeP.mutateAsync({
      id: target.id,
      groupId: target.groupId,
      anchorDate: target.date,
      scope,
    });
    setAskDeletePurchaseScope(false);
    onClose();
  };

  const handleSave = () => {
    if (!description.trim() || amount === 0 || !dirty) return;
    setAskSaveScope(true);
  };

  void confirm;


  return (
    <>
    <Modal
      open={open && !askDuplicate && !askDelete && !askDeletePurchaseScope && !askSaveScope}
      onClose={onClose}
      title="Editar lançamento"
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Recorrente</span> · cada mês é um
          lançamento independente. Ao salvar você escolhe o escopo.
        </div>

        <Field
          label={
            target.kind === "debit"
              ? "Descrição do débito"
              : target.kind === "income"
                ? "Descrição do recebimento"
                : "Descrição da compra"
          }
        >
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
          <Field label="Data da compra">
            <input
              type="date"
              className={inputClass}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
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
            onClick={() => (target.kind === "purchase" ? setAskDeletePurchaseScope(true) : setAskDelete(true))}
            disabled={removing}
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
            onClick={handleSave}
            disabled={updating || !dirty || !description.trim() || amount === 0}
            className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {updating ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </Modal>

    <Modal open={askSaveScope} onClose={() => setAskSaveScope(false)} title="Aplicar alterações em…">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Escolha o escopo da alteração desta série recorrente.
        </p>
        <button
          onClick={() => runUpdate("one")}
          disabled={updating}
          className="flex w-full flex-col items-start gap-1 rounded-xl border border-border bg-background/50 p-4 text-left hover:border-primary disabled:opacity-50"
        >
          <span className="font-semibold">Apenas este mês</span>
          <span className="text-xs text-muted-foreground">
            Os demais meses da série não serão alterados.
          </span>
        </button>
        <button
          onClick={() => runUpdate("forward")}
          disabled={updating}
          className="flex w-full flex-col items-start gap-1 rounded-xl border border-border bg-background/50 p-4 text-left hover:border-primary disabled:opacity-50"
        >
          <span className="font-semibold">Este e os próximos meses</span>
          <span className="text-xs text-muted-foreground">
            Aplica também em todos os meses futuros da mesma série.
          </span>
        </button>
        <button
          onClick={() => runUpdate("all")}
          disabled={updating}
          className="flex w-full flex-col items-start gap-1 rounded-xl border border-border bg-background/50 p-4 text-left hover:border-primary disabled:opacity-50"
        >
          <span className="font-semibold">Toda a conta</span>
          <span className="text-xs text-muted-foreground">
            Aplica em todos os meses da série, inclusive os passados.
          </span>
        </button>
        <button
          onClick={() => setAskSaveScope(false)}
          disabled={updating}
          className="w-full rounded-lg border border-border bg-background py-2 text-sm font-semibold hover:bg-secondary disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </Modal>

    <Modal
      open={askDeletePurchaseScope}
      onClose={() => setAskDeletePurchaseScope(false)}
      title="Excluir · aplicar em…"
    >
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Escolha o escopo da exclusão desta série recorrente.
        </p>
        <button
          onClick={() => runDeletePurchase("one")}
          disabled={removing}
          className="flex w-full flex-col items-start gap-1 rounded-xl border border-border bg-background/50 p-4 text-left hover:border-destructive disabled:opacity-50"
        >
          <span className="font-semibold">Apenas este mês</span>
          <span className="text-xs text-muted-foreground">
            Os demais meses da série não serão removidos.
          </span>
        </button>
        <button
          onClick={() => runDeletePurchase("forward")}
          disabled={removing}
          className="flex w-full flex-col items-start gap-1 rounded-xl border border-border bg-background/50 p-4 text-left hover:border-destructive disabled:opacity-50"
        >
          <span className="font-semibold">Este e os próximos meses</span>
          <span className="text-xs text-muted-foreground">
            Remove também todos os meses futuros da mesma série.
          </span>
        </button>
        <button
          onClick={() => runDeletePurchase("all")}
          disabled={removing}
          className="flex w-full flex-col items-start gap-1 rounded-xl border border-border bg-background/50 p-4 text-left hover:border-destructive disabled:opacity-50"
        >
          <span className="font-semibold">Toda a conta</span>
          <span className="text-xs text-muted-foreground">
            Remove todos os meses da série, inclusive os passados.
          </span>
        </button>
        <button
          onClick={() => setAskDeletePurchaseScope(false)}
          disabled={removing}
          className="w-full rounded-lg border border-border bg-background py-2 text-sm font-semibold hover:bg-secondary disabled:opacity-50"
        >
          Cancelar
        </button>
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
        const source =
          target.kind === "purchase"
            ? {
                kind: "purchase" as const,
                cardId: target.cardId,
                description: target.description,
                totalAmount: target.amount,
                date: target.date,
              }
            : target.kind === "debit"
              ? {
                  kind: "debit" as const,
                  accountId: target.accountId,
                  description: target.description,
                  amount: target.amount,
                  date: target.date,
                  required: true,
                }
              : {
                  kind: "income" as const,
                  accountId: target.accountId,
                  description: target.description,
                  amount: target.amount,
                  date: target.date,
                };
        await duplicate.mutateAsync({
          source,
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
        if (target.kind === "purchase") return;
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
