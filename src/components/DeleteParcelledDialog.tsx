import { Modal } from "./Modal";
import { Trash2 } from "lucide-react";

export function DeleteParcelledDialog({
  open,
  onClose,
  itemLabel,
  onDeleteOnlyThis,
  onDeleteAllUnpaid,
}: {
  open: boolean;
  onClose: () => void;
  itemLabel?: string;
  /** Apaga somente a parcela atual (mantém o restante). */
  onDeleteOnlyThis: () => void;
  /** Apaga o item inteiro mas preserva as parcelas já pagas. */
  onDeleteAllUnpaid: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Excluir lançamento parcelado">
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {itemLabel ? (
            <>
              Você está excluindo <span className="font-semibold text-foreground">{itemLabel}</span>. O que deseja fazer?
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
          <span className="font-semibold">Somente esta parcela</span>
          <span className="text-xs text-muted-foreground">
            Apaga apenas o lançamento deste mês. As demais parcelas seguem normalmente.
          </span>
        </button>

        <button
          onClick={() => {
            if (
              confirm(
                "Excluir o item inteiro? Parcelas já pagas serão preservadas; somente as não pagas serão apagadas.",
              )
            ) {
              onDeleteAllUnpaid();
              onClose();
            }
          }}
          className="flex w-full flex-col items-start gap-1 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-left text-destructive hover:border-destructive"
        >
          <span className="flex items-center gap-2 font-semibold">
            <Trash2 className="h-4 w-4" /> Excluir o item inteiro
          </span>
          <span className="text-xs text-destructive/80">
            Remove todas as parcelas não pagas. Parcelas já marcadas como pagas serão preservadas.
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
