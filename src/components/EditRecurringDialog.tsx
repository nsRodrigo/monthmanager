import { useEffect, useState } from "react";
import { Modal, Field, inputClass, CheckboxExpand } from "./Modal";
import { CurrencyInput } from "./CurrencyInput";
import {
  useUpdateRecurringSeries,
  useDeleteRecurringSeries,
  useUpdateRecurringPurchaseSeries,
  useAdvanceRecurring,
  useDuplicateOverScope,
  useDeleteOverScope,
  type CardScope,
  type DeleteSource,
} from "@/store/finance";
import { useConfirm } from "@/store/confirm";
import { Trash2, Copy, Settings2, ChevronRight, FastForward, ArrowLeft } from "lucide-react";
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
      /** Só se aplica a kind "debit" — dias de antecedência da notificação push. */
      notifyDaysBefore?: number | null;
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
  const duplicate = useDuplicateOverScope();
  const deleteScope = useDeleteOverScope();
  const advance = useAdvanceRecurring();
  const confirm = useConfirm();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState("");
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [notifyDaysBefore, setNotifyDaysBefore] = useState("");
  const [askSaveScope, setAskSaveScope] = useState(false);
  const [askDuplicate, setAskDuplicate] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const [manageView, setManageView] = useState<"none" | "menu" | "advance">("none");
  const [advanceCount, setAdvanceCount] = useState("");

  useEffect(() => {
    if (!open || !target) return;
    setDescription(target.description);
    setAmount(target.amount);
    setDate(target.date);
    const targetNotify = target.kind === "debit" ? target.notifyDaysBefore ?? null : null;
    setNotifyEnabled(targetNotify != null);
    setNotifyDaysBefore(targetNotify != null ? String(targetNotify) : "");
    setManageView("none");
    setAdvanceCount("");
  }, [open, target]);

  if (!target) return null;

  const updating = updateDI.isPending || updateP.isPending;
  const removing = removeDI.isPending || deleteScope.isPending;

  const targetNotifyDaysBefore = target.kind === "debit" ? (target.notifyDaysBefore ?? null) : null;
  const notifyDaysBeforeParsed = notifyEnabled ? Math.max(0, parseInt(notifyDaysBefore) || 0) : null;

  const dirty =
    description.trim() !== target.description ||
    amount !== target.amount ||
    date !== target.date ||
    (target.kind === "debit" && notifyDaysBeforeParsed !== targetNotifyDaysBefore);

  const runUpdate = async (scope: "one" | "forward" | "all") => {
    const patch: { description?: string; amount?: number; date?: string; notifyDaysBefore?: number | null } = {};
    if (description.trim() !== target.description) patch.description = description.trim();
    if (amount !== target.amount) patch.amount = amount;
    if (date !== target.date) patch.date = date;
    if (target.kind === "debit" && notifyDaysBeforeParsed !== targetNotifyDaysBefore) {
      patch.notifyDaysBefore = notifyDaysBeforeParsed;
    }
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

  const handleSave = () => {
    if (!description.trim() || amount === 0 || !dirty) return;
    setAskSaveScope(true);
  };

  void confirm;


  return (
    <>
    <Modal
      open={open && !askDuplicate && !askDelete && !askSaveScope && manageView === "none"}
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

        {target.kind === "debit" && (
          <CheckboxExpand
            checked={notifyEnabled}
            onChange={(v) => {
              setNotifyEnabled(v);
              if (v && !notifyDaysBefore) setNotifyDaysBefore("1");
            }}
            label="Notificar antes do vencimento"
          >
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
          </CheckboxExpand>
        )}

        <button
          type="button"
          onClick={() => setManageView("menu")}
          className="flex w-full items-center gap-3 rounded-xl border border-border bg-background/50 px-3 py-2.5 text-left transition hover:border-primary/50 hover:bg-background"
        >
          <Settings2 className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-foreground">Gerenciar recorrência</p>
            <p className="text-[11px] text-muted-foreground">Antecipar pagamentos futuros desta série</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>

        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          <button
            onClick={() => setAskDuplicate(true)}
            disabled={duplicate.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
            title="Duplicar lançamento"
          >
            <Copy className="h-3.5 w-3.5" /> Duplicar
          </button>
          <button
            onClick={() => setAskDelete(true)}
            disabled={removing}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
            title="Excluir lançamento"
          >
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </button>
        </div>
        <div className="flex gap-2">
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
      open={manageView !== "none"}
      onClose={() => setManageView("none")}
      title={manageView === "advance" ? "Antecipar pagamentos" : "Gerenciar recorrência"}
    >
      {manageView === "menu" && (
        <div className="space-y-3">
          <p className="text-[11px] text-muted-foreground">
            {target.description} · série recorrente
          </p>
          <button
            onClick={() => setManageView("advance")}
            className="flex w-full items-start gap-3 rounded-xl border border-border bg-background/50 p-4 text-left hover:border-primary"
          >
            <FastForward className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">Antecipar pagamentos</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Marcar as próximas N ocorrências futuras desta série como {target.kind === "income" ? "recebidas" : "pagas"}, sem mudar suas datas.
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
            Quantas ocorrências futuras (a partir desta, inclusive) você quer marcar como{" "}
            {target.kind === "income" ? "recebidas" : "pagas"} agora?
          </p>
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              placeholder="Ex: 3"
              className={inputClass}
              value={advanceCount}
              onChange={(e) => setAdvanceCount(e.target.value)}
              autoFocus
            />
            <button
              onClick={async () => {
                const n = Math.max(1, parseInt(advanceCount) || 0);
                if (!n) return;
                const ok = await confirm({
                  title: "Antecipar pagamentos",
                  description: `Marcar esta ocorrência e as próximas ${n - 1} futuras como ${target.kind === "income" ? "recebidas" : "pagas"}?`,
                  confirmLabel: "Antecipar",
                });
                if (!ok) return;
                await advance.mutateAsync({
                  kind: target.kind,
                  id: target.id,
                  groupId: target.groupId,
                  anchorDate: target.date,
                  count: n - 1,
                });
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
        const src: DeleteSource =
          target.kind === "purchase"
            ? {
                kind: "purchase",
                cardId: target.cardId,
                description: target.description,
                amount: target.amount,
                groupId: target.groupId,
              }
            : {
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
