import { useMemo, useState, useEffect } from "react";
import { Modal, Field, inputClass } from "./Modal";
import { useCards, useAddPurchase, useDescriptionSuggestions } from "@/store/finance";
import { CurrencyInput } from "./CurrencyInput";
import { AutocompleteInput } from "./AutocompleteInput";

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
  const [isInstallment, setIsInstallment] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [mode, setMode] = useState<"total" | "perInstallment">("total");

  useEffect(() => {
    if (open) {
      const d = new Date(defaultYear, defaultMonth, Math.min(new Date().getDate(), 28));
      setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
      setCardId(fixedCardId ?? selectableCards[0]?.id ?? "");
      setDescription("");
      setAmount(0);
      setInstallments("2");
      setInstallmentNumber("1");
      setIsInstallment(false);
      setIsRecurring(false);
      setMode("total");
    }
  }, [open, defaultYear, defaultMonth, selectableCards, fixedCardId]);

  const submit = async () => {
    if (!description.trim() || amount === 0 || !cardId) return;
    // Recurring purchase: create one purchase with 24 monthly "installments"
    // of the same amount, anchored at the chosen month. Each month is
    // independent and can be edited / deleted later.
    if (isRecurring && !isInstallment) {
      await addPurchase.mutateAsync({
        cardId,
        description: description.trim(),
        totalAmount: amount * 24,
        date,
        installmentsCount: 24,
        installmentNumber: 1,
      });
      onClose();
      return;
    }
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
    });
    onClose();
  };

  const n = isInstallment ? Math.max(1, parseInt(installments) || 1) : 1;
  const total = mode === "perInstallment" && n > 1 ? (amount || 0) * n : (amount || 0);
  const perInstallment = n > 0 ? total / n : 0;
  const cur = isInstallment ? Math.max(1, Math.min(n, parseInt(installmentNumber) || 1)) : 1;

  return (
    <Modal open={open} onClose={onClose} title={fixedCardId ? "Adicionar à fatura" : "Nova compra no cartão"}>
      <div className="space-y-4">
        <Field label="Descrição">
          <AutocompleteInput value={description} onChange={setDescription} suggestions={suggestions} placeholder="Ex: Tênis novo" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={mode === "perInstallment" && isInstallment ? "Valor por parcela" : "Valor total"}>
            <CurrencyInput value={amount} onValueChange={setAmount} allowNegative />
          </Field>
          <Field label="Data">
            <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        {!fixedCardId && (
          <Field label="Cartão">
            <select className={inputClass} value={cardId} onChange={(e) => setCardId(e.target.value)}>
              {selectableCards.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
        )}

        <label className="flex items-center gap-3 rounded-lg border border-border bg-background/50 p-3">
          <input
            type="checkbox"
            checked={isInstallment}
            onChange={(e) => { setIsInstallment(e.target.checked); if (e.target.checked) setIsRecurring(false); }}
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

        <label className="flex items-start gap-3 rounded-lg border border-border bg-background/50 p-3">
          <input
            type="checkbox"
            checked={isRecurring}
            onChange={(e) => setIsRecurring(e.target.checked)}
            disabled={isInstallment}
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          <span className="text-sm">
            <span className="font-medium">Compra recorrente</span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">
              {isInstallment
                ? "Indisponível para parcelados."
                : "Ideal para assinaturas (streaming etc). Será replicada nos próximos 24 meses, mantendo o dia. Cada mês é independente."}
            </span>
          </span>
        </label>

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
