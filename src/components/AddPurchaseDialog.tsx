import { useState, useEffect } from "react";
import { Modal, Field, inputClass } from "./Modal";
import { useCards, useAddPurchase } from "@/store/finance";

export function AddPurchaseDialog({
  open,
  onClose,
  defaultYear,
  defaultMonth,
  fixedCardId,
}: {
  open: boolean;
  onClose: () => void;
  defaultYear: number;
  defaultMonth: number;
  /** When provided, the card selector is hidden and this card is used. */
  fixedCardId?: string;
}) {
  const { data: cards = [] } = useCards();
  const addPurchase = useAddPurchase();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [cardId, setCardId] = useState("");
  const [installments, setInstallments] = useState("1");
  const [installmentNumber, setInstallmentNumber] = useState("1");
  const [isInstallment, setIsInstallment] = useState(false);

  useEffect(() => {
    if (open) {
      const d = new Date(defaultYear, defaultMonth, Math.min(new Date().getDate(), 28));
      setDate(d.toISOString().slice(0, 10));
      setCardId(fixedCardId ?? cards[0]?.id ?? "");
      setDescription("");
      setAmount("");
      setInstallments("1");
      setInstallmentNumber("1");
      setIsInstallment(false);
    }
  }, [open, defaultYear, defaultMonth, cards, fixedCardId]);

  const submit = async () => {
    if (!description.trim() || !amount || !cardId) return;
    const n = isInstallment ? Math.max(1, parseInt(installments)) : 1;
    const cur = isInstallment ? Math.max(1, Math.min(n, parseInt(installmentNumber) || 1)) : 1;
    await addPurchase.mutateAsync({
      cardId,
      description: description.trim(),
      totalAmount: parseFloat(amount),
      date,
      installmentsCount: n,
      installmentNumber: cur,
    });
    onClose();
  };

  const total = parseFloat(amount) || 0;
  const n = isInstallment ? Math.max(1, parseInt(installments) || 1) : 1;
  const perInstallment = n > 0 ? total / n : 0;
  const cur = isInstallment ? Math.max(1, Math.min(n, parseInt(installmentNumber) || 1)) : 1;

  return (
    <Modal open={open} onClose={onClose} title={fixedCardId ? "Adicionar à fatura" : "Nova compra no cartão"}>
      <div className="space-y-4">
        <Field label="Descrição">
          <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Tênis novo" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor total">
            <input type="number" step="0.01" className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
          </Field>
          <Field label="Data da compra">
            <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        {!fixedCardId && (
          <Field label="Cartão">
            <select className={inputClass} value={cardId} onChange={(e) => setCardId(e.target.value)}>
              {cards.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
        )}

        <label className="flex items-center gap-3 rounded-lg border border-border bg-background/50 p-3">
          <input
            type="checkbox"
            checked={isInstallment}
            onChange={(e) => setIsInstallment(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          <span className="text-sm font-medium">É parcelado?</span>
        </label>

        {isInstallment && (
          <Field label="Número de parcelas">
            <input
              type="number"
              min="2"
              max="48"
              className={inputClass}
              value={installments}
              onChange={(e) => setInstallments(e.target.value)}
            />
            {total > 0 && n > 1 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {n}x de <span className="font-semibold text-foreground">R$ {perInstallment.toFixed(2).replace(".", ",")}</span> — última parcela ajusta os centavos. Mesma data ({new Date(date).getDate()}) em todos os meses.
              </p>
            )}
          </Field>
        )}

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 rounded-lg border border-border bg-background py-2.5 text-sm font-semibold hover:bg-secondary">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={addPurchase.isPending}
            className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {addPurchase.isPending ? "Salvando…" : "Adicionar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
