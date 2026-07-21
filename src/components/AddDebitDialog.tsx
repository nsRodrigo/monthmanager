import { useState, useEffect } from "react";
import { Modal, Field, inputClass } from "./Modal";
import { useAddDebit, useAccounts, useDescriptionSuggestions } from "@/store/finance";
import { useAccountFilter } from "@/store/account-filter";
import { AccountSelect } from "./AccountSelect";
import { CurrencyInput } from "./CurrencyInput";
import { AutocompleteInput } from "./AutocompleteInput";

export function AddDebitDialog({
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
  const addDebit = useAddDebit();
  const { data: accounts = [] } = useAccounts();
  const suggestions = useDescriptionSuggestions("debit");
  const { accountId: filterAccountId } = useAccountFilter();
  const [accountId, setAccountId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState("");
  const [required, setRequired] = useState(false);
  const [recurrenceMonths, setRecurrenceMonths] = useState("24");
  const [autoDebit, setAutoDebit] = useState(false);
  const [autoDebitDay, setAutoDebitDay] = useState("");
  const [isInstallment, setIsInstallment] = useState(false);
  const [mode, setMode] = useState<"total" | "perInstallment">("total");
  const [installments, setInstallments] = useState("2");
  const [installmentNumber, setInstallmentNumber] = useState("1");
  const [markPaid, setMarkPaid] = useState(false);

  useEffect(() => {
    if (open) {
      const d = new Date(defaultYear, defaultMonth, Math.min(new Date().getDate(), 28));
      setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
      setAccountId(fixedAccountId ?? filterAccountId ?? accounts[0]?.id ?? "");
      setDescription("");
      setAmount(0);
      setRequired(false);
      setRecurrenceMonths("24");
      setAutoDebit(false);
      setAutoDebitDay("");
      setIsInstallment(false);
      setInstallments("2");
      setInstallmentNumber("1");
      setMode("total");
      setMarkPaid(false);
    }
  }, [open, defaultYear, defaultMonth, accounts, filterAccountId, fixedAccountId]);

  const submit = async () => {
    if (!description.trim() || amount === 0 || !accountId) return;
    const n = isInstallment ? Math.max(1, parseInt(installments) || 1) : 1;
    const cur = isInstallment ? Math.max(1, Math.min(n, parseInt(installmentNumber) || 1)) : 1;
    const value = amount;
    const totalAmount = mode === "perInstallment" && n > 1 ? value * n : value;
    await addDebit.mutateAsync({
      accountId,
      description: description.trim(),
      amount: totalAmount,
      date,
      required,
      autoDebit,
      autoDebitDay: autoDebit && autoDebitDay ? Math.max(1, Math.min(31, parseInt(autoDebitDay))) : null,
      installmentsCount: n,
      installmentNumber: cur,
      referenceYear: defaultYear,
      referenceMonth: defaultMonth,
      recurrenceMonths: required && !isInstallment ? Math.max(1, Math.min(120, parseInt(recurrenceMonths) || 24)) : undefined,
      paidNow: markPaid && !isInstallment && !required,
    });
    onClose();
  };

  const value = amount || 0;
  const n = isInstallment ? Math.max(1, parseInt(installments) || 1) : 1;
  const total = mode === "perInstallment" && n > 1 ? value * n : value;
  const per = n > 0 ? total / n : 0;

  return (
    <Modal open={open} onClose={onClose} title="Novo débito">
      <div className="space-y-4">
        {!fixedAccountId && <AccountSelect value={accountId} onChange={setAccountId} />}
        <Field label="Descrição">
          <AutocompleteInput value={description} onChange={setDescription} suggestions={suggestions} placeholder="Ex: IPVA, aluguel" />
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
              if (e.target.checked) setRequired(false);
            }}
            className="h-4 w-4 accent-primary"
          />
          <span className="text-sm font-medium">É parcelado?</span>
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
                  {cur > 1 && ` ${cur - 1} parcela(s) anterior(es) serão criadas como pagas.`}
                </p>
              );
            })()}
          </div>
        )}

        <label className="flex items-start gap-3 rounded-lg border border-border bg-background/50 p-3">
          <input
            type="checkbox"
            checked={required}
            onChange={(e) => {
              setRequired(e.target.checked);
              if (e.target.checked) setIsInstallment(false);
            }}
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          <span className="text-sm">
            <span className="font-medium">Débito recorrente</span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">
              Replicado automaticamente nos próximos 24 meses, mantendo o dia. Cada mês é independente e pode ser editado ou excluído. Recorrência ≠ parcelamento.
            </span>
          </span>
        </label>

        <label className="flex items-center gap-3 rounded-lg border border-border bg-background/50 p-3">
          <input type="checkbox" checked={autoDebit} onChange={(e) => setAutoDebit(e.target.checked)} className="h-4 w-4 accent-primary" />
          <span className="text-sm font-medium">Débito automático</span>
        </label>
        {autoDebit && (
          <Field label="Dia do débito (1-31)">
            <input type="number" min="1" max="31" className={inputClass} value={autoDebitDay} onChange={(e) => setAutoDebitDay(e.target.value)} placeholder="Ex: 10" />
          </Field>
        )}

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 rounded-lg border border-border bg-background py-2.5 text-sm font-semibold hover:bg-secondary">Cancelar</button>
          <button onClick={submit} disabled={addDebit.isPending || !accountId} className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {addDebit.isPending ? "Salvando…" : "Adicionar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
