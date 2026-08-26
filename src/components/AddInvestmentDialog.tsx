import { useEffect, useState } from "react";
import { Plus, Copy } from "lucide-react";
import { useAddInvestment } from "@/store/finance";
import { useAccountFilter } from "@/store/account-filter";
import { Modal, Field, inputClass, Select } from "./Modal";
import { AccountSelect } from "./AccountSelect";
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

type PaymentType = "unico" | "parcelado" | "recorrente";

export function AddInvestmentDialog({
  open,
  onClose,
  defaultYear,
  defaultMonth,
  fixedAccountId,
}: {
  open: boolean;
  onClose: () => void;
  defaultYear?: number;
  defaultMonth?: number;
  fixedAccountId?: string;
}) {
  const addInv = useAddInvestment();
  const { accountId: filterAccountId } = useAccountFilter();

  const [accountId, setAccountId] = useState("");
  const [type, setType] = useState(TYPES[0]);
  const [amount, setAmount] = useState(0);
  const [percentage, setPercentage] = useState("");
  const [date, setDate] = useState("");
  const [paymentType, setPaymentType] = useState<PaymentType>("unico");
  const [mode, setMode] = useState<"total" | "perInstallment">("total");
  const [installments, setInstallments] = useState("2");
  const [installmentNumber, setInstallmentNumber] = useState("1");

  const isInstallment = paymentType === "parcelado";
  const isRecurring = paymentType === "recorrente";

  const today = new Date();
  const dY = defaultYear ?? today.getFullYear();
  const dM = defaultMonth ?? today.getMonth();

  const resetFields = () => {
    setAccountId(fixedAccountId ?? filterAccountId ?? "");
    setType(TYPES[0]);
    setAmount(0);
    setPercentage("");
    setDate("");
    setPaymentType("unico");
    setMode("total");
    setInstallments("2");
    setInstallmentNumber("1");
  };

  useEffect(() => {
    if (!open) return;
    resetFields();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fixedAccountId, filterAccountId]);

  const isValid = !!accountId && amount > 0 && !!date;
  const n = isInstallment ? Math.max(1, parseInt(installments) || 1) : 1;
  const total = mode === "perInstallment" && n > 1 ? amount * n : amount;
  const per = n > 0 ? total / n : 0;
  const cur = isInstallment ? Math.max(1, Math.min(n, parseInt(installmentNumber) || 1)) : 1;

  async function submit(after: "close" | "another" | "duplicate" = "close") {
    if (!isValid) return;
    const totalAmount = mode === "perInstallment" && n > 1 ? amount * n : amount;
    await addInv.mutateAsync({
      accountId,
      type,
      amount: totalAmount,
      percentage: Number(percentage) || 0,
      date,
      installmentsCount: n,
      installmentNumber: cur,
      recurring: isRecurring,
      referenceYear: dY,
      referenceMonth: dM,
    });
    if (after === "another") resetFields();
    else if (after === "close") onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Novo investimento">
      <div className="space-y-3">
        {!fixedAccountId && (
          <AccountSelect value={accountId} onChange={setAccountId} label="Conta de origem" />
        )}

        <Field label="Tipo">
          <Select className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={mode === "perInstallment" && isInstallment ? "Valor por parcela" : "Valor aplicado"}>
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

        <div className="space-y-2">
          <span className="block text-xs font-medium text-muted-foreground">Tipo de pagamento</span>
          <Select
            className={inputClass}
            value={paymentType}
            onChange={(e) => setPaymentType(e.target.value as PaymentType)}
          >
            <option value="unico">À Vista</option>
            <option value="parcelado">Parcelado</option>
            <option value="recorrente">Aporte recorrente</option>
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
              {total > 0 && n > 1 && (
                <p className="text-xs text-muted-foreground">
                  {n}x de <span className="font-semibold text-foreground">R$ {per.toFixed(2).replace(".", ",")}</span> · total <span className="font-semibold text-foreground">R$ {total.toFixed(2).replace(".", ",")}</span>
                  <br />Esta é a parcela <span className="font-semibold text-foreground">{cur}/{n}</span>.
                </p>
              )}
            </div>
          )}

          {isRecurring && (
            <p className="rounded-lg border border-border bg-background/50 p-3 text-[11px] text-muted-foreground">
              Ideal para aportes mensais. Replicado automaticamente todo mês, até o último mês que já existe nesta conta — e continua acompanhando conforme a conta cresce. Cada mês é independente.
            </p>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border bg-background py-2.5 text-sm font-semibold hover:bg-secondary"
          >
            Cancelar
          </button>
          <button
            onClick={() => submit("close")}
            disabled={addInv.isPending || !isValid}
            className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {addInv.isPending ? "Adicionando…" : "Adicionar"}
          </button>
          <button
            type="button"
            onClick={() => submit("another")}
            disabled={addInv.isPending || !isValid}
            title="Salvar e adicionar outro investimento (limpa os campos)"
            aria-label="Salvar e adicionar outro investimento"
            className="inline-flex items-center justify-center rounded-lg bg-orange-700 px-3 py-2.5 text-white hover:bg-orange-800 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => submit("duplicate")}
            disabled={addInv.isPending || !isValid}
            title="Salvar e duplicar (mantém os campos preenchidos)"
            aria-label="Salvar e duplicar este investimento"
            className="inline-flex items-center justify-center rounded-lg bg-secondary px-3 py-2.5 text-foreground hover:bg-secondary/70 disabled:opacity-50"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>
      </div>
    </Modal>
  );
}
