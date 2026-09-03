import { Modal } from "./Modal";

/**
 * Perguntado quando "Mover para outro mês" (seleção múltipla) inclui algum
 * item que faz parte de uma série (parcelamento com total>1 ou recorrência)
 * — dá ao usuário a escolha entre mover só o que foi selecionado (como já
 * funcionava) ou levar o resto da série junto (ver `resolveSeriesFromOps`).
 */
export function MoveSeriesConfirmDialog({
  open,
  onClose,
  onConfirm,
  extraCount,
  targetLabel,
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (expandSeries: boolean) => void | Promise<void>;
  /** Quantos lançamentos extras (além dos já selecionados) seriam movidos junto. */
  extraCount: number;
  /** Rótulo do mês/ano de destino, ex. "Março de 2026". */
  targetLabel: string;
  loading?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Mover série inteira?">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Parte do que você selecionou faz parte de um parcelamento ou de uma recorrência. Deseja levar o
          resto da série junto para {targetLabel}?
        </p>

        <button
          type="button"
          disabled={loading}
          onClick={() => onConfirm(true)}
          className="w-full rounded-xl border border-primary bg-primary/5 p-4 text-left transition-colors hover:bg-primary/10 disabled:opacity-50"
        >
          <span className="block font-semibold text-foreground">Mover a série inteira também</span>
          <span className="block text-xs text-muted-foreground">
            Move os selecionados e mais {extraCount} lançamento{extraCount === 1 ? "" : "s"} da mesma série.
          </span>
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() => onConfirm(false)}
          className="w-full rounded-xl border border-border p-4 text-left transition-colors hover:border-primary disabled:opacity-50"
        >
          <span className="block font-semibold text-foreground">Mover só os selecionados</span>
          <span className="block text-xs text-muted-foreground">O resto da série continua nos meses atuais.</span>
        </button>

        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="w-full rounded-lg border border-border bg-background py-2.5 text-sm font-semibold hover:bg-secondary disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </Modal>
  );
}
