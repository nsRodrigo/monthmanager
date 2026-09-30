import { useEffect, useState } from "react";
import { Modal, Field, inputClass, Select } from "./Modal";
import { ScopeOption } from "./CardScopeConfirmDialog";
import { MONTHS } from "@/lib/format";

export type CardMoveScope = "month" | "unlimited";

/**
 * Diálogo de "Mover para outro mês" quando a seleção é uma FATURA inteira
 * (long-press no cabeçalho do cartão, ver `cardAll:` em
 * `contas.$contaId_.$ano.$mes.tsx`) — diferente do `MoveToMonthDialog`
 * (que move só os itens selecionados), aqui tem uma escolha extra de
 * alcance: só esta fatura, ou o cartão inteiro (todos os meses, passados e
 * futuros, deslocados juntos).
 */
export function MoveCardMonthDialog({
  open,
  onClose,
  cardName,
  currentYear,
  currentMonth,
  loading,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  cardName?: string;
  currentYear: number;
  currentMonth: number;
  loading?: boolean;
  onConfirm: (year: number, month: number, scope: CardMoveScope) => void;
}) {
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [scope, setScope] = useState<CardMoveScope>("month");

  useEffect(() => {
    if (!open) return;
    const next = new Date(currentYear, currentMonth + 1, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
    setScope("month");
  }, [open, currentYear, currentMonth]);

  const isSameMonth = year === currentYear && month === currentMonth;

  const currentYearNow = new Date().getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => currentYearNow - 5 + i);

  return (
    <Modal open={open} onClose={onClose} title="Mover fatura para outro mês">
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {cardName ? `Fatura de ${cardName}` : "Fatura selecionada"} — escolha o mês de destino. A
          data digitada em cada compra não muda, só o mês em que ela fica visível.
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

        <div className="space-y-2 pt-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Alcance
          </p>
          <ScopeOption
            checked={scope === "month"}
            onCheck={() => setScope("month")}
            label={`Só esta fatura (${MONTHS[currentMonth]} de ${currentYear})`}
            description="Move só os lançamentos deste mês — o resto do cartão continua onde está."
          />
          <ScopeOption
            checked={scope === "unlimited"}
            onCheck={() => setScope("unlimited")}
            label="O cartão inteiro, sem limite"
            description="Todo lançamento do cartão (parcelado, recorrente ou à vista, em qualquer mês passado ou futuro) desloca junto, mantendo a distância entre eles."
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-lg border border-border bg-background py-2.5 text-sm font-semibold hover:bg-secondary disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(year, month, scope)}
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
