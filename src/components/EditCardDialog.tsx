import { useEffect, useState } from "react";
import { Modal, Field, inputClass } from "./Modal";
import {
  useUpdateCard,
  useRemoveCard,
  useDuplicateCard,
  type Card,
  type CardScope,
} from "@/store/finance";
import { Copy, Trash2 } from "lucide-react";
import { CardScopeConfirmDialog } from "./CardScopeConfirmDialog";

type PendingAction = null | "save" | "delete" | "duplicate";

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
  const [pending, setPending] = useState<PendingAction>(null);

  useEffect(() => {
    if (open && card) {
      setName(card.name);
      setColor(card.color);
      setClosingDay(String(card.closingDay));
      setDueDay(String(card.dueDay));
      setPending(null);
    }
  }, [open, card]);

  if (!card) return null;

  const apply = async (scope: CardScope) => {
    if (pending === "save") {
      await update.mutateAsync({
        id: card.id,
        name: name.trim() || card.name,
        color,
        closingDay: Math.min(31, Math.max(1, parseInt(closingDay) || card.closingDay)),
        dueDay: Math.min(31, Math.max(1, parseInt(dueDay) || card.dueDay)),
        scope,
      });
    } else if (pending === "delete") {
      await remove.mutateAsync({ id: card.id, scope });
    } else if (pending === "duplicate") {
      await duplicate.mutateAsync(card.id);
    }
    setPending(null);
    onClose();
  };

  const actionMeta: Record<Exclude<PendingAction, null>, {
    title: string;
    confirmLabel: string;
    variant: "default" | "destructive";
    description: React.ReactNode;
  }> = {
    save: {
      title: `Salvar alterações · ${card.name}`,
      confirmLabel: "Salvar",
      variant: "default",
      description: "Escolha em quais meses essas alterações vão valer.",
    },
    delete: {
      title: `Excluir · ${card.name}`,
      confirmLabel: "Excluir",
      variant: "destructive",
      description: "Compras, parcelas e pagamentos do cartão dentro do escopo escolhido serão removidos.",
    },
    duplicate: {
      title: `Duplicar · ${card.name}`,
      confirmLabel: "Duplicar",
      variant: "default",
      description: "Será criada uma cópia do cartão. (O escopo se aplica ao cartão duplicado.)",
    },
  };

  return (
    <>
      <Modal open={open && pending === null} onClose={onClose} title={`Editar · ${card.name}`}>
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
              onClick={() => setPending("duplicate")}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background py-2 text-xs font-semibold text-foreground hover:bg-secondary"
            >
              <Copy className="h-3.5 w-3.5" /> Duplicar cartão
            </button>
            <button
              onClick={() => setPending("delete")}
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
              onClick={() => setPending("save")}
              className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Salvar
            </button>
          </div>
        </div>
      </Modal>

      {pending && (
        <CardScopeConfirmDialog
          open={pending !== null}
          onClose={() => setPending(null)}
          onConfirm={apply}
          title={actionMeta[pending].title}
          description={actionMeta[pending].description}
          confirmLabel={actionMeta[pending].confirmLabel}
          variant={actionMeta[pending].variant}
          defaultYear={defaultYear}
          defaultMonth={defaultMonth}
          initialKind="month"
          loading={update.isPending || remove.isPending || duplicate.isPending}
        />
      )}
    </>
  );
}
