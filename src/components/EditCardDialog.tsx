import { useEffect, useState } from "react";
import { Modal, Field, inputClass } from "./Modal";
import { useUpdateCard, useRemoveCard, useDuplicateCard, type Card } from "@/store/finance";
import { Copy, Trash2, AlertTriangle } from "lucide-react";

export function EditCardDialog({
  open,
  onClose,
  card,
}: {
  open: boolean;
  onClose: () => void;
  card: Card | null;
}) {
  const update = useUpdateCard();
  const remove = useRemoveCard();
  const duplicate = useDuplicateCard();

  const [name, setName] = useState("");
  const [color, setColor] = useState("#8b5cf6");
  const [closingDay, setClosingDay] = useState("25");
  const [dueDay, setDueDay] = useState("5");
  const [confirmDel, setConfirmDel] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    if (open && card) {
      setName(card.name);
      setColor(card.color);
      setClosingDay(String(card.closingDay));
      setDueDay(String(card.dueDay));
      setConfirmDel(false);
      setConfirmText("");
    }
  }, [open, card]);

  if (!card) return null;

  const save = async () => {
    await update.mutateAsync({
      id: card.id,
      name: name.trim() || card.name,
      color,
      closingDay: Math.min(31, Math.max(1, parseInt(closingDay) || card.closingDay)),
      dueDay: Math.min(31, Math.max(1, parseInt(dueDay) || card.dueDay)),
    });
    onClose();
  };

  const dup = async () => {
    await duplicate.mutateAsync(card.id);
    onClose();
  };

  const del = async () => {
    if (confirmText.trim().toUpperCase() !== "EXCLUIR") return;
    await remove.mutateAsync(card.id);
    onClose();
  };

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
                Todas as compras, parcelas e registros de pagamento deste cartão serão excluídos permanentemente.
              </p>
            </div>
          </div>
          <Field label='Digite "EXCLUIR" para confirmar'>
            <input
              autoFocus
              className={inputClass}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="EXCLUIR"
            />
          </Field>
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setConfirmDel(false)}
              className="flex-1 rounded-lg border border-border bg-background py-2.5 text-sm font-semibold hover:bg-secondary"
            >
              Voltar
            </button>
            <button
              onClick={del}
              disabled={remove.isPending || confirmText.trim().toUpperCase() !== "EXCLUIR"}
              className="flex-1 rounded-lg bg-destructive py-2.5 text-sm font-semibold text-destructive-foreground hover:opacity-90 disabled:opacity-50"
            >
              {remove.isPending ? "Excluindo…" : "Excluir tudo"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
