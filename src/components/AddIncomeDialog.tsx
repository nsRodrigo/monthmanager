import { useState, useEffect } from "react";
import { Plus, Copy } from "lucide-react";
import { Modal, Field, inputClass, Select, PaidToggle, Accordion } from "./Modal";
import { useAddIncome, useAccounts, useUpsertCatalogItem, PAYMENT_METHOD_OPTIONS } from "@/store/finance";
import { useAccountFilter } from "@/store/account-filter";
import { AccountSelect } from "./AccountSelect";
import { CurrencyInput } from "./CurrencyInput";
import { CatalogDescriptionField } from "./CatalogDescriptionField";

type PaymentType = "unico" | "parcelado" | "recorrente";
/** Recebimento não usa 'auto_debit' — esse meio é exclusivo de débitos. */
const incomePaymentMethods = PAYMENT_METHOD_OPTIONS.filter((o) => o.value !== "auto_debit");
type PaymentMethod = "none" | (typeof incomePaymentMethods)[number]["value"];

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
  const upsertCatalogItem = useUpsertCatalogItem();
  const { accountId: filterAccountId } = useAccountFilter();
  const [accountId, setAccountId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState("");
  const [paymentType, setPaymentType] = useState<PaymentType>("unico");
  const [mode, setMode] = useState<"total" | "perInstallment">("total");
  const [installments, setInstallments] = useState("2");
  const [installmentNumber, setInstallmentNumber] = useState("1");
  const [markReceived, setMarkReceived] = useState(false);
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [notifyDaysBefore, setNotifyDaysBefore] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("none");

  const isInstallment = paymentType === "parcelado";
  const isRecurring = paymentType === "recorrente";

  const resetFields = () => {
    setDate("");
    setAccountId(fixedAccountId ?? filterAccountId ?? accounts[0]?.id ?? "");
    setDescription("");
    setAmount(0);
    setPaymentType("unico");
    setInstallments("2");
    setInstallmentNumber("1");
    setMode("total");
    setMarkReceived(false);
    setNotifyEnabled(false);
    setNotifyDaysBefore("");
    setPaymentMethod("none");
  };

  useEffect(() => {
    if (open) resetFields();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultYear, defaultMonth, accounts, filterAccountId, fixedAccountId]);

  const isValid = description.trim() !== "" && amount !== 0 && !!accountId && !!date;

  const submit = async (after: "close" | "another" | "duplicate" = "close") => {
    if (!isValid) return;
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
      recurring: isRecurring,
      referenceYear: defaultYear,
      referenceMonth: defaultMonth,
      receivedNow: markReceived && !isInstallment,
      markCurrentPaid: markReceived && isInstallment,
      notifyDaysBefore:
        !isInstallment && notifyEnabled ? Math.max(0, parseInt(notifyDaysBefore) || 0) : null,
      paymentMethod: paymentMethod === "none" ? null : paymentMethod,
    });
    upsertCatalogItem.mutate({ name: description.trim() });
    if (after === "another") resetFields();
    else if (after === "close") onClose();
  };

  const value = amount || 0;
  const n = isInstallment ? Math.max(1, parseInt(installments) || 1) : 1;
  const total = mode === "perInstallment" && n > 1 ? value * n : value;
  const per = n > 0 ? total / n : 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo recebimento"
      headerRight={
        <PaidToggle
          checked={markReceived}
          onChange={setMarkReceived}
          offLabel="Marcar recebido"
          onLabel="Recebido"
        />
      }
    >
      <div className="space-y-4">
        {!fixedAccountId && (
          <AccountSelect value={accountId} onChange={setAccountId} label="Conta de destino" />
        )}
        <Field label="Descrição">
          <CatalogDescriptionField value={description} onChange={setDescription} placeholder="Ex: Salário, freelance" />
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
          <Select
            className={inputClass}
            value={paymentType}
            onChange={(e) => setPaymentType(e.target.value as PaymentType)}
          >
            <option value="unico">À Vista</option>
            <option value="parcelado">Parcelado</option>
            <option value="recorrente">Recebível recorrente</option>
          </Select>

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
                    {cur > 1 && ` ${cur - 1} parcela(s) anterior(es) serão criadas como recebidas.`}
                  </p>
                );
              })()}
            </div>
          )}

          {isRecurring && (
            <p className="rounded-lg border border-border bg-background/50 p-3 text-[11px] text-muted-foreground">
              Replicado automaticamente todo mês, até o último mês que já existe nesta conta — e continua acompanhando conforme a conta cresce. Cada mês é independente e pode ser editado ou excluído sem afetar os demais.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <span className="block text-xs font-medium text-muted-foreground">Meio de pagamento</span>
          <Select
            className={inputClass}
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
          >
            <option value="none">Nenhum</option>
            {incomePaymentMethods.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>

        {isRecurring && (
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
          <button onClick={() => submit("close")} disabled={addIncome.isPending || !isValid} className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {addIncome.isPending ? "Salvando…" : "Adicionar"}
          </button>
          <button
            type="button"
            onClick={() => submit("another")}
            disabled={addIncome.isPending || !isValid}
            title="Salvar e adicionar outro recebimento (limpa os campos)"
            aria-label="Salvar e adicionar outro recebimento"
            className="inline-flex items-center justify-center rounded-lg bg-orange-700 px-3 py-2.5 text-white hover:bg-orange-800 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => submit("duplicate")}
            disabled={addIncome.isPending || !isValid}
            title="Salvar e duplicar (mantém os campos preenchidos)"
            aria-label="Salvar e duplicar este recebimento"
            className="inline-flex items-center justify-center rounded-lg bg-secondary px-3 py-2.5 text-foreground hover:bg-secondary/70 disabled:opacity-50"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>
      </div>
    </Modal>
  );
}
