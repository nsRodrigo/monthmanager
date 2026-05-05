import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Modal, Field, inputClass } from "./Modal";
import { MONTHS } from "@/lib/format";
import { getEffectiveCurrentMonth } from "@/store/finance";

export function AddMonthDialog({
  open,
  onClose,
  contaId,
}: {
  open: boolean;
  onClose: () => void;
  contaId: string;
}) {
  const navigate = useNavigate();
  const eff = getEffectiveCurrentMonth(new Date());
  const [year, setYear] = useState(eff.year);
  const [month, setMonth] = useState(eff.month);

  useEffect(() => {
    if (!open) return;
    const e = getEffectiveCurrentMonth(new Date());
    setYear(e.year);
    setMonth(e.month);
  }, [open]);

  const submit = () => {
    navigate({
      to: "/contas/$contaId/$ano/$mes",
      params: { contaId, ano: String(year), mes: String(month) },
    });
    onClose();
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);

  return (
    <Modal open={open} onClose={onClose} title="Adicionar mês">
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Escolha o mês e ano que deseja abrir. Por padrão, o mês atual já está selecionado.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Mês">
            <select
              className={inputClass}
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {MONTHS.map((name, idx) => (
                <option key={idx} value={idx} className="capitalize">
                  {name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ano">
            <select
              className={inputClass}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Abrir mês
          </button>
        </div>
      </div>
    </Modal>
  );
}
