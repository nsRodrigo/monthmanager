import { useState, useEffect } from "react";
import { Modal, Field, inputClass } from "./Modal";
import { useAddIncome } from "@/store/finance";

export function AddIncomeDialog({
  open,
  onClose,
  defaultYear,
  defaultMonth,
}: {
  open: boolean;
  onClose: () => void;
  defaultYear: number;
  defaultMonth: number;
}) {
  const addIncome = useAddIncome();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    if (open) {
      const d = new Date(defaultYear, defaultMonth, Math.min(new Date().getDate(), 28));
      setDate(d.toISOString().slice(0, 10));
      setDescription("");
      setAmount("");
    }
  }, [open, defaultYear, defaultMonth]);

  const submit = async () => {
    if (!description.trim() || !amount) return;
    await addIncome.mutateAsync({ description: description.trim(), amount: parseFloat(amount), date });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Novo recebimento">
      <div className="space-y-4">
        <Field label="Descrição">
          <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Salário" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor">
            <input type="number" step="0.01" className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
          </Field>
          <Field label="Data">
            <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 rounded-lg border border-border bg-background py-2.5 text-sm font-semibold hover:bg-secondary">Cancelar</button>
          <button onClick={submit} disabled={addIncome.isPending} className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {addIncome.isPending ? "Salvando…" : "Adicionar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
