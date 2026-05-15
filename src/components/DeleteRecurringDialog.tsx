import { Modal } from "./Modal";
import { Trash2 } from "lucide-react";

/**
 * Confirmation dialog for deleting a single occurrence of a recurring series.
 * Lets the user delete only this month, or this and all future months.
 */
export function DeleteRecurringDialog({
  open,
  onClose,
  itemLabel,
  onDeleteOnlyThis,
  onDeleteThisAndFuture,
}: {
  open: boolean;
  onClose: () => void;
  itemLabel?: string;
  onDeleteOnlyThis: () => void;
  onDeleteThisAndFuture: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Excluir lançamento recorrente">
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {itemLabel ? (
            <>
              Você está excluindo <span className="font-semibold text-foreground">{itemLabel}</span>.
              O que deseja fazer?
            </>
          ) : (
            "O que deseja excluir?"
          )}
        </p>

        <button
          onClick={() => {
            onDeleteOnlyThis();
            onClose();
          }}
          className="flex w-full flex-col items-start gap-1 rounded-xl border border-border bg-background/50 p-4 text-left hover:border-primary"
        >
          <span className="font-semibold">Apenas este mês</span>
          <span className="text-xs text-muted-foreground">
            Apaga só a ocorrência deste mês. Os demais meses da série permanecem.
          </span>
        </button>

        <button
          onClick={() => {
            onDeleteThisAndFuture();
            onClose();
          }}
          className="flex w-full flex-col items-start gap-1 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-left text-destructive hover:border-destructive"
        >
          <span className="flex items-center gap-2 font-semibold">
            <Trash2 className="h-4 w-4" /> Este e os próximos meses
          </span>
          <span className="text-xs text-destructive/80">
            Remove esta e todas as ocorrências futuras da mesma série recorrente.
          </span>
        </button>

        <button
          onClick={onClose}
          className="w-full rounded-lg border border-border bg-background py-2 text-sm font-semibold hover:bg-secondary"
        >
          Cancelar
        </button>
      </div>
    </Modal>
  );
}
