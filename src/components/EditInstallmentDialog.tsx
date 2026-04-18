import { useState, useEffect } from "react";
import { Modal, Field, inputClass } from "./Modal";
import { useUpdateInstallment, type Installment, type Purchase } from "@/store/finance";
import { formatCurrency, formatDate } from "@/lib/format";
import { Trash2 } from "lucide-react";

export function EditInstallmentDialog({
  open,
  onClose,
  installment,
  purchase,
  onDeletePurchase,
}: {
  open: boolean;
  onClose: () => void;
  installment: Installment | null;
  purchase: Purchase | null;
  onDeletePurchase?: () => void;
}) {
  const update = useUpdateInstallment();
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    if (open && installment) {
      setAmount(String(installment.amount));
      setDueDate(installment.dueDate);
      setPaid(installment.paid);
    }
  }, [open, installment]);

  if (!installment || !purchase) return null;

  const submit = async () => {
    await update.mutateAsync({
      id: installment.id,
      amount: parseFloat(amount),
      dueDate,
      paid,
    });
    onClose();
  };

  const original = purchase.totalAmount / purchase.installmentsCount;

  return (
    <Modal open={open} onClose={onClose} title={`Parcela ${installment.number}/${installment.total}`}>
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-background/50 p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Compra</p>
          <p className="mt-1 font-semibold">{purchase.description}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Total {formatCurrency(purchase.totalAmount)} em {purchase.installmentsCount}x · {formatDate(purchase.date)}
          </p>
        </div>

        <Field label={`Valor da parcela (sugerido ${formatCurrency(original)})`}>
          <input
            type="number"
            step="0.01"
            className={inputClass}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Você pode ajustar centavos sem afetar as outras parcelas.
          </p>
        </Field>

        <Field label="Data de vencimento">
          <input
            type="date"
            className={inputClass}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </Field>

        <label className="flex items-center gap-3 rounded-lg border border-border bg-background/50 p-3">
          <input
            type="checkbox"
            checked={paid}
            onChange={(e) => setPaid(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          <span className="text-sm font-medium">Marcada como paga</span>
        </label>

        <div className="flex gap-2 pt-2">
          {onDeletePurchase && (
            <button
              onClick={() => {
                if (confirm("Excluir a compra inteira e todas as suas parcelas?")) {
                  onDeletePurchase();
                  onClose();
                }
              }}
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/20"
              title="Excluir compra"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button onClick={onClose} className="flex-1 rounded-lg border border-border bg-background py-2.5 text-sm font-semibold hover:bg-secondary">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={update.isPending}
            className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {update.isPending ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
