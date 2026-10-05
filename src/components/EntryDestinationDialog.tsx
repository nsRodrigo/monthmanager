import { useEffect, useState } from "react";
import { Modal, Field, inputClass, Select } from "./Modal";
import { AlertTriangle } from "lucide-react";
import type { ParentType } from "@/store/finance";

export const ENTRY_KIND_LABEL: Record<ParentType, string> = {
  purchase: "Compra no cartão",
  debit: "Débito",
  income: "Recebimento",
  investment: "Investimento",
};

export type EntryDestinationResult = {
  toKind: ParentType;
  cardId?: string;
  /** Só quando toKind === "investment" (ver DuplicateSource — não existe no tipo de origem). */
  percentage?: number;
};

/**
 * Diálogo compartilhado por "Duplicar item" e "Mover para" (seleção múltipla
 * em Lançamentos) — escolhe o tipo de destino (e o cartão, se for Compra no
 * cartão). Ações bem diferentes por trás: duplicar cria cópias novas sem
 * tocar nos originais; mover usa `useConvertFinanceEntry` (RPC
 * `convert_finance_entry`), que já existe e é usada em EditInstallmentDialog
 * — por isso itens recorrentes não entram no "Mover para" (a RPC recusa) e
 * não há desfazer (mesmo aviso já usado lá).
 */
export function EntryDestinationDialog({
  open,
  onClose,
  mode,
  fromKind,
  selectedCount,
  excludedCount = 0,
  cards,
  loading,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  mode: "duplicate" | "move";
  fromKind: ParentType;
  selectedCount: number;
  /** Só no modo "move": quantos dos selecionados são recorrentes e ficam de fora. */
  excludedCount?: number;
  cards: { id: string; name: string }[];
  loading?: boolean;
  onConfirm: (result: EntryDestinationResult) => void;
}) {
  const otherKinds = (["purchase", "debit", "income", "investment"] as ParentType[]).filter((k) => k !== fromKind);
  const [toKind, setToKind] = useState<ParentType>(otherKinds[0]);
  const [cardId, setCardId] = useState("");
  const [percentage, setPercentage] = useState(0);

  useEffect(() => {
    if (open) {
      setToKind(otherKinds[0]);
      setCardId("");
      setPercentage(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fromKind]);

  const eligible = selectedCount - excludedCount;
  const needsCard = toKind === "purchase";
  const needsPercentage = mode === "duplicate" && toKind === "investment";
  const canConfirm = eligible > 0 && (!needsCard || !!cardId);

  const title = mode === "duplicate" ? "Duplicar para" : "Mover para";

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {mode === "duplicate"
            ? `${selectedCount} ${selectedCount === 1 ? "item selecionado" : "itens selecionados"} — escolha pra onde duplicar. Os originais continuam onde estão.`
            : `${selectedCount} ${selectedCount === 1 ? "item selecionado" : "itens selecionados"} — escolha o novo tipo.`}
        </p>

        <Field label="Tipo de destino">
          <Select className={inputClass} value={toKind} onChange={(e) => setToKind(e.target.value as ParentType)}>
            {otherKinds.map((k) => (
              <option key={k} value={k}>
                {ENTRY_KIND_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>

        {needsCard && (
          <Field label="Cartão">
            <Select className={inputClass} value={cardId} onChange={(e) => setCardId(e.target.value)}>
              <option value="">Selecione um cartão</option>
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {needsPercentage && (
          <Field label="Percentual (%)">
            <input
              type="number"
              step="0.01"
              className={inputClass}
              value={percentage}
              onChange={(e) => setPercentage(parseFloat(e.target.value) || 0)}
            />
          </Field>
        )}

        {mode === "move" && (
          <>
            {excludedCount > 0 && (
              <p className="rounded-lg bg-secondary/60 px-3 py-2 text-[11px] text-muted-foreground">
                {excludedCount} {excludedCount === 1 ? "dos selecionados é recorrente" : "dos selecionados são recorrentes"} e{" "}
                {excludedCount === 1 ? "não pode" : "não podem"} trocar de tipo — fica{excludedCount === 1 ? "" : "m"} como{" "}
                {excludedCount === 1 ? "está" : "estão"}.
              </p>
            )}
            <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p className="text-[11px] text-foreground">
                Esta ação não pode ser desfeita. {eligible > 0 ? `${eligible} ${eligible === 1 ? "lançamento vai virar" : "lançamentos vão virar"} ${ENTRY_KIND_LABEL[toKind].toLowerCase()}.` : ""}
              </p>
            </div>
          </>
        )}

        {eligible <= 0 && (
          <p className="text-xs text-destructive">Nenhum dos selecionados pode trocar de tipo.</p>
        )}

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-lg border border-border bg-background py-2.5 text-sm font-semibold hover:bg-secondary disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm({ toKind, cardId: needsCard ? cardId : undefined, percentage: needsPercentage ? percentage : undefined })}
            disabled={!canConfirm || loading}
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50 ${
              mode === "move"
                ? "bg-destructive text-destructive-foreground hover:opacity-90"
                : "bg-primary text-primary-foreground hover:opacity-90"
            }`}
          >
            {loading ? "Processando…" : mode === "duplicate" ? "Duplicar" : "Mover"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
