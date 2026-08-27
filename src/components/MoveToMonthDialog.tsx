import { useEffect, useState } from "react";
import { Modal, Field, inputClass, Select } from "./Modal";
import { MONTHS } from "@/lib/format";

/**
 * Diálogo da ação em lote "Mover para outro mês" (seleção múltipla nas
 * listas de Recebimentos/Débitos/Investimentos/Cartões). Só escolhe o mês
 * destino — a resolução de QUAIS linhas mexer (avulso vs. parcela) é feita
 * por quem chama `onConfirm`, ver `resolveMoveOps` em
 * `contas.$contaId_.$ano.$mes.tsx`.
 */
export function MoveToMonthDialog({
  open,
  onClose,
  count,
  currentYear,
  currentMonth,
  loading,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  /** Quantos itens estão selecionados — só para o texto do modal. */
  count: number;
  currentYear: number;
  currentMonth: number;
  loading?: boolean;
  onConfirm: (year: number, month: number) => void;
}) {
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);

  useEffect(() => {
    if (!open) return;
    // Sugere o mês seguinte ao atual — é o caso mais comum ("lancei no mês
    // errado, era pra ser o próximo").
    const next = new Date(currentYear, currentMonth + 1, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  }, [open, currentYear, currentMonth]);

  const isSameMonth = year === currentYear && month === currentMonth;

  const currentYearNow = new Date().getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => currentYearNow - 5 + i);

  return (
    <Modal open={open} onClose={onClose} title="Mover para outro mês">
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {count} {count === 1 ? "item selecionado" : "itens selecionados"} — escolha o mês para
          onde eles devem ir. A data digitada em cada lançamento não muda, só o mês em que ele fica
          visível.
        </p>
        <p className="rounded-lg bg-secondary/60 px-3 py-2 text-[11px] text-muted-foreground">
          Itens que fazem parte de um parcelamento ou de uma série recorrente: só a ocorrência deste
          mês é movida — as demais parcelas continuam nos meses originais.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Mês">
            <Select
              className={inputClass}
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {MONTHS.map((name, idx) => (
                <option key={idx} value={idx} className="capitalize">
                  {name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ano">
            <Select
              className={inputClass}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {isSameMonth && (
          <p className="text-xs text-destructive">Selecione um mês diferente do atual.</p>
        )}
        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border bg-background py-2.5 text-sm font-semibold hover:bg-secondary"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(year, month)}
            disabled={isSameMonth || loading}
            className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Movendo..." : "Mover"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
