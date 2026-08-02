import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { Modal, Field, inputClass, Accordion, PaidToggle } from "./Modal";
import { useAddDebit, useAccounts, useDescriptionSuggestions } from "@/store/finance";
import { useAccountFilter } from "@/store/account-filter";
import { AccountSelect } from "./AccountSelect";
import { CurrencyInput } from "./CurrencyInput";
import { AutocompleteInput } from "./AutocompleteInput";

type PaymentType = "unico" | "parcelado" | "recorrente" | "automatico";

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
  const [paymentType, setPaymentType] = useState<PaymentType>("unico");
  const [recurrenceMonths, setRecurrenceMonths] = useState("24");
  const [autoDebitDay, setAutoDebitDay] = useState("");
  const [mode, setMode] = useState<"total" | "perInstallment">("total");
  const [installments, setInstallments] = useState("2");
  const [installmentNumber, setInstallmentNumber] = useState("1");
  const [markPaid, setMarkPaid] = useState(false);
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [notifyDaysBefore, setNotifyDaysBefore] = useState("");

  const isInstallment = paymentType === "parcelado";
  const required = paymentType === "recorrente";
  const autoDebit = paymentType === "automatico";

  const resetFields = () => {
    const d = new Date(defaultYear, defaultMonth, Math.min(new Date().getDate(), 28));
    setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    setAccountId(fixedAccountId ?? filterAccountId ?? accounts[0]?.id ?? "");
    setDescription("");
    setAmount(0);
    setPaymentType("unico");
    setRecurrenceMonths("24");
    setAutoDebitDay("");
    setInstallments("2");
    setInstallmentNumber("1");
    setMode("total");
    setMarkPaid(false);
    setNotifyEnabled(false);
    setNotifyDaysBefore("");
  };

  useEffect(() => {
    if (open) resetFields();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultYear, defaultMonth, accounts, filterAccountId, fixedAccountId]);

  const isValid = description.trim() !== "" && amount !== 0 && !!accountId;

  const submit = async (addAnother = false) => {
    if (!isValid) return;
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
      markCurrentPaid: markPaid && isInstallment,
      notifyDaysBefore:
        !isInstallment && notifyEnabled ? Math.max(0, parseInt(notifyDaysBefore) || 0) : null,
    });
    if (addAnother) resetFields();
    else onClose();
  };

  const value = amount || 0;
  const n = isInstallment ? Math.max(1, parseInt(installments) || 1) : 1;
  const total = mode === "perInstallment" && n > 1 ? value * n : value;
  const per = n > 0 ? total / n : 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo débito"
      headerRight={
        <PaidToggle
          checked={markPaid}
          onChange={setMarkPaid}
          disabled={required}
          offLabel="Marcar pago"
          onLabel="Pago"
        />
      }
    >
      <div className="space-y-4">
        {!fixedAccountId && <AccountSelect value={accountId} onChange={setAccountId} />}
        <Field label="Descrição">
          <AutocompleteInput value={description} onChange={setDescription} suggestions={suggestions} placeholder="Ex: IPVA, aluguel" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={mode === "perInstallment" && isInstallment ? "Valor por parcela" : "Valor total"}>
            <CurrencyInput value={amount} onValueChange={setAmount} allowNegative />
          </Field>
          <Field label="Data da compra">
            <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>

        <div className="space-y-2">
          <span className="block text-xs font-medium text-muted-foreground">Tipo de pagamento</span>
          <select
            className={inputClass}
            value={paymentType}
            onChange={(e) => {
              const v = e.target.value as PaymentType;
              setPaymentType(v);
              if (v === "recorrente") setMarkPaid(false);
            }}
          >
            <option value="unico">Único (à vista)</option>
            <option value="parcelado">Parcelado</option>
            <option value="recorrente">Recorrente</option>
            <option value="automatico">Débito automático</option>
          </select>

          {isInstallment && (
            <div className="space-y-3 rounded-lg border border-border bg-background/50 p-3">
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

          {required && (
            <div className="space-y-3 rounded-lg border border-border bg-background/50 p-3">
              <Field label="Repetir por quantos meses?">
                <input
                  type="number"
                  min="1"
                  max="120"
                  className={inputClass}
                  value={recurrenceMonths}
                  onChange={(e) => setRecurrenceMonths(e.target.value)}
                  placeholder="24"
                />
              </Field>
              <p className="text-[11px] text-muted-foreground">
                Replicado automaticamente nos próximos meses, mantendo o dia. Cada mês é independente e pode ser editado ou excluído. Recorrência ≠ parcelamento.
              </p>
            </div>
          )}

          {autoDebit && (
            <div className="rounded-lg border border-border bg-background/50 p-3">
              <Field label="Dia do débito (1-31)">
                <input type="number" min="1" max="31" className={inputClass} value={autoDebitDay} onChange={(e) => setAutoDebitDay(e.target.value)} placeholder="Ex: 10" />
              </Field>
            </div>
          )}
        </div>

        {!isInstallment && (
          <Accordion
            open={notifyEnabled}
            onOpenChange={(v) => {
              setNotifyEnabled(v);
              if (v && !notifyDaysBefore) setNotifyDaysBefore("1");
            }}
            label="Notificar antes do vencimento"
          >
            <Field label="Quantos dias antes?">
              <input
                type="number"
                min={0}
                max={30}
                className={inputClass}
                value={notifyDaysBefore}
                onChange={(e) => setNotifyDaysBefore(e.target.value)}
              />
            </Field>
          </Accordion>
        )}

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 rounded-lg border border-border bg-background py-2.5 text-sm font-semibold hover:bg-secondary">Cancelar</button>
          <button onClick={() => submit(false)} disabled={addDebit.isPending || !isValid} className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {addDebit.isPending ? "Salvando…" : "Adicionar"}
          </button>
          <button
            type="button"
            onClick={() => submit(true)}
            disabled={addDebit.isPending || !isValid}
            title="Salvar e adicionar outro débito"
            aria-label="Salvar e adicionar outro débito"
            className="inline-flex items-center justify-center rounded-lg bg-orange-700 px-3 py-2.5 text-white hover:bg-orange-800 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </Modal>
  );
}
