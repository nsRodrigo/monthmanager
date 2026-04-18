import { useState, useEffect } from "react";
import { Modal, Field, inputClass } from "./Modal";
import { useAddDebit } from "@/store/finance";

export function AddDebitDialog({
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
  const addDebit = useAddDebit();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [required, setRequired] = useState(false);

  useEffect(() => {
    if (open) {
      const d = new Date(defaultYear, defaultMonth, Math.min(new Date().getDate(), 28));
      setDate(d.toISOString().slice(0, 10));
      setDescription("");
      setAmount("");
      setRequired(false);
    }
  }, [open, defaultYear, defaultMonth]);

  const submit = async () => {
    if (!description.trim() || !amount) return;
    await addDebit.mutateAsync({
      description: description.trim(),
      amount: parseFloat(amount),
      date,
      required,
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Novo débito">
      <div className="space-y-4">
        <Field label="Descrição">
          <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Aluguel" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor">
            <input type="number" step="0.01" className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
          </Field>
          <Field label="Data">
            <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <label className="flex items-center gap-3 rounded-lg border border-border bg-background/50 p-3">
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} className="h-4 w-4 accent-primary" />
          <span className="text-sm font-medium">Débito obrigatório (recorrente)</span>
        </label>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 rounded-lg border border-border bg-background py-2.5 text-sm font-semibold hover:bg-secondary">Cancelar</button>
          <button onClick={submit} disabled={addDebit.isPending} className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {addDebit.isPending ? "Salvando…" : "Adicionar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
