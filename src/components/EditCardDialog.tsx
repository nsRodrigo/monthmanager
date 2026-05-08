import { useEffect, useState } from "react";
import { Modal, Field, inputClass } from "./Modal";
import {
  useUpdateCard,
  useRemoveCard,
  useDuplicateCard,
  type Card,
  type CardScope,
} from "@/store/finance";
import { Copy, Trash2, AlertTriangle } from "lucide-react";
import { CardScopePicker } from "./CardScopePicker";
import { MONTHS } from "@/lib/format";

export function EditCardDialog({
  open,
  onClose,
  card,
  defaultYear,
  defaultMonth,
}: {
  open: boolean;
  onClose: () => void;
  card: Card | null;
  defaultYear: number;
  defaultMonth: number;
}) {
  const update = useUpdateCard();
  const remove = useRemoveCard();
  const duplicate = useDuplicateCard();

  const [name, setName] = useState("");
  const [color, setColor] = useState("#8b5cf6");
  const [closingDay, setClosingDay] = useState("25");
  const [dueDay, setDueDay] = useState("5");
  const [scope, setScope] = useState<CardScope>({ kind: "all" });
  const [confirmDel, setConfirmDel] = useState(false);
  const [delScope, setDelScope] = useState<CardScope>({ kind: "month", year: defaultYear, month: defaultMonth });

  useEffect(() => {
    if (open && card) {
      setName(card.name);
      setColor(card.color);
      setClosingDay(String(card.closingDay));
      setDueDay(String(card.dueDay));
      setScope({ kind: "all" });
      setConfirmDel(false);
      setDelScope({ kind: "month", year: defaultYear, month: defaultMonth });
    }
  }, [open, card, defaultYear, defaultMonth]);

  if (!card) return null;

  const save = async () => {
    await update.mutateAsync({
      id: card.id,
      name: name.trim() || card.name,
      color,
      closingDay: Math.min(31, Math.max(1, parseInt(closingDay) || card.closingDay)),
      dueDay: Math.min(31, Math.max(1, parseInt(dueDay) || card.dueDay)),
      scope,
    });
    onClose();
  };

  const dup = async () => {
    await duplicate.mutateAsync(card.id);
    onClose();
  };

  const del = async () => {
    await remove.mutateAsync({ id: card.id, scope: delScope });
    onClose();
  };

  const delScopeLabel =
    delScope.kind === "all"
      ? "definitivamente, em toda a conta"
      : delScope.kind === "month"
        ? `apenas em ${MONTHS[delScope.month]}/${delScope.year}`
        : `entre ${MONTHS[delScope.startMonth]}/${delScope.startYear} e ${MONTHS[delScope.endMonth]}/${delScope.endYear}`;

  return (
    <Modal open={open} onClose={onClose} title={`Editar · ${card.name}`}>
      {!confirmDel ? (
        <div className="space-y-3">
          <Field label="Nome do cartão">
            <input autoFocus className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Cor">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-full rounded-lg border border-input bg-input"
              />
            </Field>
            <Field label="Fechamento">
              <input type="number" min={1} max={31} className={inputClass} value={closingDay} onChange={(e) => setClosingDay(e.target.value)} />
            </Field>
            <Field label="Vencimento">
              <input type="number" min={1} max={31} className={inputClass} value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
            </Field>
          </div>

          <CardScopePicker
            defaultYear={defaultYear}
            defaultMonth={defaultMonth}
            value={scope}
            onChange={setScope}
            labelAll="Alterar para toda a conta"
            labelMonth="Alterar somente neste mês"
            labelPeriod="Alterar para um período"
          />

          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              onClick={dup}
              disabled={duplicate.isPending}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background py-2 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
            >
              <Copy className="h-3.5 w-3.5" /> {duplicate.isPending ? "Duplicando…" : "Duplicar cartão"}
            </button>
            <button
              onClick={() => setConfirmDel(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 py-2 text-xs font-semibold text-destructive hover:bg-destructive/20"
            >
              <Trash2 className="h-3.5 w-3.5" /> Excluir cartão
            </button>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 rounded-lg border border-border bg-background py-2.5 text-sm font-semibold hover:bg-secondary">
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={update.isPending}
              className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {update.isPending ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div className="text-xs text-foreground">
              <p className="font-semibold text-destructive">Esta ação é irreversível.</p>
              <p className="mt-1 text-muted-foreground">
                Compras, parcelas e pagamentos do cartão dentro do escopo escolhido serão removidos.
              </p>
            </div>
          </div>

          <CardScopePicker
            defaultYear={defaultYear}
            defaultMonth={defaultMonth}
            value={delScope}
            onChange={setDelScope}
            labelAll="Excluir definitivamente em toda a conta"
            labelMonth="Excluir somente deste mês"
            labelPeriod="Excluir em um período"
          />

          <p className="text-[11px] text-muted-foreground">
            Você confirmará a exclusão {delScopeLabel}.
          </p>

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setConfirmDel(false)}
              className="flex-1 rounded-lg border border-border bg-background py-2.5 text-sm font-semibold hover:bg-secondary"
            >
              Voltar
            </button>
            <button
              onClick={del}
              disabled={remove.isPending}
              className="flex-1 rounded-lg bg-destructive py-2.5 text-sm font-semibold text-destructive-foreground hover:opacity-90 disabled:opacity-50"
            >
              {remove.isPending ? "Excluindo…" : "Confirmar exclusão"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
