import { useEffect, useState } from "react";
import { useAddInvestment } from "@/store/finance";
import { useAccountFilter } from "@/store/account-filter";
import { Modal, Field, inputClass } from "./Modal";
import { AccountSelect } from "./AccountSelect";
import { todayISO } from "@/lib/format";
import { CurrencyInput } from "./CurrencyInput";

const TYPES = [
  "CDB",
  "Tesouro Direto",
  "Poupança",
  "Fundo",
  "Ações",
  "Cripto",
  "Outros",
];

export function AddInvestmentDialog({
  open,
  onClose,
  fixedAccountId,
}: {
  open: boolean;
  onClose: () => void;
  fixedAccountId?: string;
}) {
  const addInv = useAddInvestment();
  const { accountId: filterAccountId } = useAccountFilter();

  const [accountId, setAccountId] = useState("");
  const [type, setType] = useState(TYPES[0]);
  const [amount, setAmount] = useState(0);
  const [percentage, setPercentage] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    if (!open) return;
    setAccountId(fixedAccountId ?? filterAccountId ?? "");
    setType(TYPES[0]);
    setAmount(0);
    setPercentage("");
    setDate(todayISO());
  }, [open, fixedAccountId, filterAccountId]);

  async function submit() {
    if (!accountId || amount <= 0 || !date) return;
    await addInv.mutateAsync({
      accountId,
      type,
      amount,
      percentage: Number(percentage) || 0,
      date,
    });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Novo investimento">
      <div className="space-y-3">
        {!fixedAccountId && (
          <AccountSelect value={accountId} onChange={setAccountId} label="Conta de origem" />
        )}

        <Field label="Tipo">
          <select className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor aplicado">
            <CurrencyInput value={amount} onValueChange={setAmount} allowNegative />
          </Field>
          <Field label="Rendimento (% a.a.)">
            <input
              type="number"
              step="0.01"
              className={inputClass}
              value={percentage}
              onChange={(e) => setPercentage(e.target.value)}
              placeholder="0"
            />
          </Field>
        </div>

        <Field label="Data">
          <input
            type="date"
            className={inputClass}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border bg-background py-2.5 text-sm font-semibold hover:bg-secondary"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={addInv.isPending || !accountId || amount <= 0}
            className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {addInv.isPending ? "Adicionando…" : "Adicionar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
