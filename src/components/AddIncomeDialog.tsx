import { useState, useEffect } from "react";
import { Modal, Field, inputClass } from "./Modal";
import { useAddIncome, useAccounts } from "@/store/finance";
import { useAccountFilter } from "@/store/account-filter";
import { AccountSelect } from "./AccountSelect";
import { CurrencyInput } from "./CurrencyInput";

export function AddIncomeDialog({
  open,
  onClose,
  defaultYear,
  defaultMonth,
  fixedAccountId,
}: {
  open: boolean;
  onClose: () => void;
  defaultYear: number;
  defaultMonth: number;
  fixedAccountId?: string;
}) {
  const addIncome = useAddIncome();
  const { data: accounts = [] } = useAccounts();
  const { accountId: filterAccountId } = useAccountFilter();
  const [accountId, setAccountId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState("");
  const [isInstallment, setIsInstallment] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [mode, setMode] = useState<"total" | "perInstallment">("total");
  const [installments, setInstallments] = useState("2");
  const [installmentNumber, setInstallmentNumber] = useState("1");

  useEffect(() => {
    if (open) {
      const d = new Date(defaultYear, defaultMonth, Math.min(new Date().getDate(), 28));
      setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
      setAccountId(fixedAccountId ?? filterAccountId ?? accounts[0]?.id ?? "");
      setDescription("");
      setAmount(0);
      setIsInstallment(false);
      setIsRecurring(false);
      setInstallments("2");
      setInstallmentNumber("1");
      setMode("total");
    }
  }, [open, defaultYear, defaultMonth, accounts, filterAccountId, fixedAccountId]);

  const submit = async () => {
    if (!description.trim() || amount === 0 || !accountId) return;
    if (isRecurring && !isInstallment) {
      await addIncome.mutateAsync({
        accountId,
        description: description.trim(),
        amount,
        date,
        recurring: true,
      });
      onClose();
      return;
    }
    const n = isInstallment ? Math.max(1, parseInt(installments) || 1) : 1;
    const cur = isInstallment ? Math.max(1, Math.min(n, parseInt(installmentNumber) || 1)) : 1;
    const value = amount;
    const totalAmount = mode === "perInstallment" && n > 1 ? value * n : value;
    await addIncome.mutateAsync({
      accountId,
      description: description.trim(),
      amount: totalAmount,
      date,
      installmentsCount: n,
      installmentNumber: cur,
    });
    onClose();
  };

  const value = amount || 0;
  const n = isInstallment ? Math.max(1, parseInt(installments) || 1) : 1;
  const total = mode === "perInstallment" && n > 1 ? value * n : value;
  const per = n > 0 ? total / n : 0;

  return (
    <Modal open={open} onClose={onClose} title="Novo recebimento">
      <div className="space-y-4">
        {!fixedAccountId && (
          <AccountSelect value={accountId} onChange={setAccountId} label="Conta de destino" />
        )}
        <Field label="Descrição">
          <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Salário, freelance" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={mode === "perInstallment" && isInstallment ? "Valor por parcela" : "Valor total"}>
            <CurrencyInput value={amount} onValueChange={setAmount} allowNegative />
          </Field>
          <Field label="Data">
            <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>

        <label className="flex items-center gap-3 rounded-lg border border-border bg-background/50 p-3">
          <input
            type="checkbox"
            checked={isInstallment}
            onChange={(e) => {
              setIsInstallment(e.target.checked);
              if (e.target.checked) setIsRecurring(false);
            }}
            className="h-4 w-4 accent-primary"
          />
          <span className="text-sm font-medium">É Parcelado?</span>
        </label>

        <label className="flex items-start gap-3 rounded-lg border border-border bg-background/50 p-3">
          <input
            type="checkbox"
            checked={isRecurring}
            onChange={(e) => setIsRecurring(e.target.checked)}
            disabled={isInstallment}
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          <span className="text-sm">
            <span className="font-medium">Recorrente</span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">
              {isInstallment
                ? "Indisponível para parcelados."
                : "Replicado automaticamente nos próximos 24 meses, mantendo o dia."}
            </span>
          </span>
        </label>

        {isInstallment && (
          <div className="space-y-3 rounded-lg border border-border bg-background/30 p-3">
            <div className="flex gap-1 rounded-full bg-secondary p-1">
              <button type="button" onClick={() => setMode("total")} className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${mode === "total" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                Valor total
              </button>
              <button type="button" onClick={() => setMode("perInstallment")} className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${mode === "perInstallment" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                Valor por parcela
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Total de parcelas">
                <input type="number" min="2" max="60" className={inputClass} value={installments} onChange={(e) => setInstallments(e.target.value)} />
              </Field>
              <Field label="Parcela atual">
                <input type="number" min="1" max={n} className={inputClass} value={installmentNumber} onChange={(e) => setInstallmentNumber(e.target.value)} />
              </Field>
            </div>
            {value > 0 && n > 1 && (() => {
              const cur = Math.max(1, Math.min(n, parseInt(installmentNumber) || 1));
              return (
                <p className="text-xs text-muted-foreground">
                  {n}x de <span className="font-semibold text-foreground">R$ {per.toFixed(2).replace(".", ",")}</span> · total <span className="font-semibold text-foreground">R$ {total.toFixed(2).replace(".", ",")}</span>
                  <br />Esta é a parcela <span className="font-semibold text-foreground">{cur}/{n}</span>.
                  {cur > 1 && ` ${cur - 1} parcela(s) anterior(es) serão criadas como recebidas.`}
                </p>
              );
            })()}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 rounded-lg border border-border bg-background py-2.5 text-sm font-semibold hover:bg-secondary">Cancelar</button>
          <button onClick={submit} disabled={addIncome.isPending || !accountId} className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {addIncome.isPending ? "Salvando…" : "Adicionar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
