import { useMemo, useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { Modal, Field, inputClass, PaidToggle } from "./Modal";
import { useCards, useAddPurchase, useDescriptionSuggestions } from "@/store/finance";
import { CurrencyInput } from "./CurrencyInput";
import { AutocompleteInput } from "./AutocompleteInput";

type PaymentType = "unico" | "parcelado" | "recorrente";

export function AddPurchaseDialog({
  open,
  onClose,
  defaultYear,
  defaultMonth,
  fixedCardId,
  fixedAccountId,
}: {
  open: boolean;
  onClose: () => void;
  defaultYear: number;
  defaultMonth: number;
  /** When provided, the card selector is hidden and this card is used. */
  fixedCardId?: string;
  /** When provided, only cards from this account are offered. */
  fixedAccountId?: string;
}) {
  const { data: cards = [] } = useCards();
  const addPurchase = useAddPurchase();
  const suggestions = useDescriptionSuggestions("purchase");
  const selectableCards = useMemo(
    () => (fixedAccountId ? cards.filter((card) => card.accountId === fixedAccountId) : cards),
    [cards, fixedAccountId],
  );
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState("");
  const [cardId, setCardId] = useState("");
  const [installments, setInstallments] = useState("2");
  const [installmentNumber, setInstallmentNumber] = useState("1");
  const [paymentType, setPaymentType] = useState<PaymentType>("unico");
  const [mode, setMode] = useState<"total" | "perInstallment">("total");
  const [markPaid, setMarkPaid] = useState(true);

  const isInstallment = paymentType === "parcelado";
  const isRecurring = paymentType === "recorrente";

  const resetFields = (preserveCard = false) => {
    const d = new Date(defaultYear, defaultMonth, Math.min(new Date().getDate(), 28));
    setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    if (!preserveCard) setCardId(fixedCardId ?? selectableCards[0]?.id ?? "");
    setDescription("");
    setAmount(0);
    setInstallments("2");
    setInstallmentNumber("1");
    setPaymentType("unico");
    setMode("total");
    setMarkPaid(true);
  };

  useEffect(() => {
    if (open) resetFields();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultYear, defaultMonth, selectableCards, fixedCardId]);

  const isValid = description.trim() !== "" && amount !== 0 && !!cardId;

  const submit = async (addAnother = false) => {
    if (!isValid) return;
    // A âncora de mês/parcela é sempre o mês da PÁGINA (defaultYear/defaultMonth),
    // nunca o mês da data de compra digitada — a data da compra é só um
    // registro informativo e não pode decidir em qual mês/parcela o
    // lançamento cai (mesma regra já aplicada a débitos e recebimentos).
    // Mantemos apenas o DIA digitado, clampado ao tamanho do mês da página.
    const invoiceAnchorDate = `${defaultYear}-${String(defaultMonth + 1).padStart(2, "0")}-${String(Math.min(new Date(defaultYear, defaultMonth + 1, 0).getDate(), Number(date.slice(8, 10)) || 1)).padStart(2, "0")}`;
    const n = isInstallment ? Math.max(1, parseInt(installments)) : 1;
    const cur = isInstallment ? Math.max(1, Math.min(n, parseInt(installmentNumber) || 1)) : 1;
    const totalAmount = mode === "perInstallment" && n > 1 ? amount * n : amount;
    await addPurchase.mutateAsync({
      cardId,
      description: description.trim(),
      totalAmount,
      date,
      installmentsCount: n,
      installmentNumber: cur,
      invoiceAnchorDate,
      recurring: isRecurring,
      paidNow: markPaid && !isInstallment,
      markCurrentPaid: markPaid && isInstallment,
    });
    if (addAnother) resetFields(true);
    else onClose();
  };

  const n = isInstallment ? Math.max(1, parseInt(installments) || 1) : 1;
  const total = mode === "perInstallment" && n > 1 ? (amount || 0) * n : (amount || 0);
  const perInstallment = n > 0 ? total / n : 0;
  const cur = isInstallment ? Math.max(1, Math.min(n, parseInt(installmentNumber) || 1)) : 1;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={fixedCardId ? "Adicionar à fatura" : "Nova compra no cartão"}
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
        {!fixedCardId && (
          <Field label="Cartão">
            <select className={inputClass} value={cardId} onChange={(e) => setCardId(e.target.value)}>
              {selectableCards.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Descrição">
          <AutocompleteInput value={description} onChange={setDescription} suggestions={suggestions} placeholder="Ex: Tênis novo" />
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
            onChange={(e) => setPaymentType(e.target.value as PaymentType)}
          >
            <option value="unico">Único (à vista)</option>
            <option value="parcelado">Parcelado</option>
            <option value="recorrente">Compra recorrente</option>
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
                  <input type="number" min="2" max="48" className={inputClass} value={installments} onChange={(e) => setInstallments(e.target.value)} />
                </Field>
                <Field label="Parcela atual">
                  <input type="number" min="1" max={n} className={inputClass} value={installmentNumber} onChange={(e) => setInstallmentNumber(e.target.value)} />
                </Field>
              </div>
              {total > 0 && n > 1 && (
                <p className="text-xs text-muted-foreground">
                  {n}x de <span className="font-semibold text-foreground">R$ {perInstallment.toFixed(2).replace(".", ",")}</span> · total <span className="font-semibold text-foreground">R$ {total.toFixed(2).replace(".", ",")}</span>
                  <br />Esta é a parcela <span className="font-semibold text-foreground">{cur}/{n}</span>.
                  {cur > 1 && ` ${cur - 1} parcela(s) anterior(es) serão criadas como pagas e ${n - cur} futura(s) serão criadas nos próximos meses.`}
                </p>
              )}
            </div>
          )}

          {isRecurring && (
            <p className="rounded-lg border border-border bg-background/50 p-3 text-[11px] text-muted-foreground">
              Ideal para assinaturas (streaming etc). Replicada automaticamente todo mês, até o último mês que já existe nesta conta — e continua acompanhando conforme a conta cresce. Cada mês é independente.
            </p>
          )}
        </div>


        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 rounded-lg border border-border bg-background py-2.5 text-sm font-semibold hover:bg-secondary">
            Cancelar
          </button>
          <button
            onClick={() => submit(false)}
            disabled={addPurchase.isPending || !isValid}
            className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {addPurchase.isPending ? "Salvando…" : "Adicionar"}
          </button>
          <button
            type="button"
            onClick={() => submit(true)}
            disabled={addPurchase.isPending || !isValid}
            title="Salvar e adicionar outra compra"
            aria-label="Salvar e adicionar outra compra"
            className="inline-flex items-center justify-center rounded-lg bg-orange-700 px-3 py-2.5 text-white hover:bg-orange-800 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </Modal>
  );
}
