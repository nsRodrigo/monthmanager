import { useState, useEffect } from "react";
import { Plus, Copy } from "lucide-react";
import { Modal, Field, inputClass, Select, Accordion, PaidToggle } from "./Modal";
import { useAddDebit, useAccounts, useUpsertCatalogItem, PAYMENT_METHOD_OPTIONS } from "@/store/finance";
import { useAccountFilter } from "@/store/account-filter";
import { AccountSelect } from "./AccountSelect";
import { CurrencyInput } from "./CurrencyInput";
import { CatalogDescriptionField } from "./CatalogDescriptionField";

type PaymentType = "unico" | "parcelado" | "recorrente";
type PaymentMethod = "none" | (typeof PAYMENT_METHOD_OPTIONS)[number]["value"];

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
  const upsertCatalogItem = useUpsertCatalogItem();
  const { data: accounts = [] } = useAccounts();
  const { accountId: filterAccountId } = useAccountFilter();
  const [accountId, setAccountId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState("");
  const [paymentType, setPaymentType] = useState<PaymentType>("unico");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("none");
  const [autoDebitDay, setAutoDebitDay] = useState("");
  const [mode, setMode] = useState<"total" | "perInstallment">("total");
  const [installments, setInstallments] = useState("2");
  const [installmentNumber, setInstallmentNumber] = useState("1");
  const [markPaid, setMarkPaid] = useState(true);
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [notifyDaysBefore, setNotifyDaysBefore] = useState("");

  const autoDebit = paymentMethod === "auto_debit";
  const isInstallment = !autoDebit && paymentType === "parcelado";
  const required = !autoDebit && paymentType === "recorrente";

  const resetFields = () => {
    setDate("");
    setAccountId(fixedAccountId ?? filterAccountId ?? accounts[0]?.id ?? "");
    setDescription("");
    setAmount(0);
    setPaymentType("unico");
    setPaymentMethod("none");
    setAutoDebitDay("");
    setInstallments("2");
    setInstallmentNumber("1");
    setMode("total");
    setMarkPaid(true);
    setNotifyEnabled(false);
    setNotifyDaysBefore("");
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
    await addDebit.mutateAsync({
      accountId,
      description: description.trim(),
      amount: totalAmount,
      date,
      required,
      paymentMethod: paymentMethod === "none" ? null : paymentMethod,
      autoDebitDay: autoDebit && autoDebitDay ? Math.max(1, Math.min(31, parseInt(autoDebitDay))) : null,
      installmentsCount: n,
      installmentNumber: cur,
      referenceYear: defaultYear,
      referenceMonth: defaultMonth,
      paidNow: markPaid && !isInstallment,
      markCurrentPaid: markPaid && isInstallment,
      notifyDaysBefore:
        !isInstallment && notifyEnabled ? Math.max(0, parseInt(notifyDaysBefore) || 0) : null,
    });
    upsertCatalogItem.mutate({ name: description.trim() });
    if (after === "another") resetFields();
    else if (after === "close") onClose();
    // "duplicate": mantém os campos como estão, pronto pra adicionar de novo.
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
          offLabel="Marcar pago"
          onLabel="Pago"
        />
      }
    >
      <div className="space-y-4">
        {!fixedAccountId && <AccountSelect value={accountId} onChange={setAccountId} />}
        <Field label="Descrição">
          <CatalogDescriptionField value={description} onChange={setDescription} placeholder="Ex: IPVA, aluguel" />
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
          <span className="block text-xs font-medium text-muted-foreground">Meio de pagamento</span>
          <Select
            className={inputClass}
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
          >
            <option value="none">Nenhum</option>
            {PAYMENT_METHOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>

          {autoDebit && (
            <div className="rounded-lg border border-border bg-background/50 p-3">
              <Field label="Dia do débito (1-31)">
                <input type="number" min="1" max="31" className={inputClass} value={autoDebitDay} onChange={(e) => setAutoDebitDay(e.target.value)} placeholder="Ex: 10" />
              </Field>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Replicado automaticamente todo mês, até o último mês que já existe nesta conta — e continua acompanhando conforme a conta cresce.
              </p>
            </div>
          )}
        </div>

        {!autoDebit && (
        <div className="space-y-2">
          <span className="block text-xs font-medium text-muted-foreground">Tipo de pagamento</span>
          <Select
            className={inputClass}
            value={paymentType}
            onChange={(e) => setPaymentType(e.target.value as PaymentType)}
          >
            <option value="unico">À Vista</option>
            <option value="parcelado">Parcelado</option>
            <option value="recorrente">Recorrente</option>
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
                    {cur > 1 && ` ${cur - 1} parcela(s) anterior(es) serão criadas como pagas.`}
                  </p>
                );
              })()}
            </div>
          )}

          {required && (
            <p className="rounded-lg border border-border bg-background/50 p-3 text-[11px] text-muted-foreground">
              Replicado automaticamente todo mês, até o último mês que já existe nesta conta — e continua acompanhando conforme a conta cresce. Cada mês é independente e pode ser editado ou excluído sem afetar os demais.
            </p>
          )}
        </div>
        )}

        {(required || autoDebit) && (
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
          <button onClick={() => submit("close")} disabled={addDebit.isPending || !isValid} className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {addDebit.isPending ? "Salvando…" : "Adicionar"}
          </button>
          <button
            type="button"
            onClick={() => submit("another")}
            disabled={addDebit.isPending || !isValid}
            title="Salvar e adicionar outro débito (limpa os campos)"
            aria-label="Salvar e adicionar outro débito"
            className="inline-flex items-center justify-center rounded-lg bg-orange-700 px-3 py-2.5 text-white hover:bg-orange-800 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => submit("duplicate")}
            disabled={addDebit.isPending || !isValid}
            title="Salvar e duplicar (mantém os campos preenchidos)"
            aria-label="Salvar e duplicar este débito"
            className="inline-flex items-center justify-center rounded-lg bg-secondary px-3 py-2.5 text-foreground hover:bg-secondary/70 disabled:opacity-50"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>
      </div>
    </Modal>
  );
}
