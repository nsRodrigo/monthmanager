import { useEffect, useState } from "react";
import { useAddInvestment } from "@/store/finance";
import { useAccountFilter } from "@/store/account-filter";
import { Modal, Field, inputClass } from "./Modal";
import { AccountSelect } from "./AccountSelect";

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
  const [amount, setAmount] = useState("");
  const [percentage, setPercentage] = useState("");

  useEffect(() => {
    if (!open) return;
    setAccountId(fixedAccountId ?? filterAccountId ?? "");
    setType(TYPES[0]);
    setAmount("");
    setPercentage("");
  }, [open, fixedAccountId, filterAccountId]);

  async function submit() {
    if (!accountId || !amount) return;
    await addInv.mutateAsync({
      accountId,
      type,
      amount: Number(amount),
      percentage: Number(percentage) || 0,
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
            <input
              type="number"
              step="0.01"
              className={inputClass}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
            />
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

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary/80"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={addInv.isPending || !accountId || !amount}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {addInv.isPending ? "Adicionando…" : "Adicionar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
