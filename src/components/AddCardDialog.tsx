import { useEffect, useState } from "react";
import { Modal, Field, inputClass } from "./Modal";
import { useAccounts, useAddCard, type CardScope } from "@/store/finance";
import { useAccountFilter } from "@/store/account-filter";
import { CardScopeConfirmDialog } from "./CardScopeConfirmDialog";

export function AddCardDialog({
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
  /** When provided, the account selector is hidden and this account is used. */
  fixedAccountId?: string;
}) {
  const { data: accounts = [] } = useAccounts();
  const { accountId: filter } = useAccountFilter();
  const addCard = useAddCard();

  const today = new Date();
  const dY = defaultYear ?? today.getFullYear();
  const dM = defaultMonth ?? today.getMonth();

  const [name, setName] = useState("");
  const [color, setColor] = useState("#8b5cf6");
  const [accountId, setAccountId] = useState("");
  const [closingDay, setClosingDay] = useState("25");
  const [dueDay, setDueDay] = useState("5");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setColor("#8b5cf6");
    setAccountId(fixedAccountId ?? filter ?? accounts[0]?.id ?? "");
    setClosingDay("25");
    setDueDay("5");
    setConfirming(false);
  }, [open, filter, accounts, fixedAccountId]);

  const submit = async (scope: CardScope) => {
    if (!name.trim() || !accountId) return;
    await addCard.mutateAsync({
      accountId,
      name: name.trim(),
      color,
      closingDay: Math.min(31, Math.max(1, parseInt(closingDay) || 25)),
      dueDay: Math.min(31, Math.max(1, parseInt(dueDay) || 5)),
      scope,
    });
    setConfirming(false);
    onClose();
  };

  return (
    <>
      <Modal open={open && !confirming} onClose={onClose} title="Novo cartão de crédito">
        {accounts.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            Cadastre uma conta antes de criar cartões.
          </p>
        ) : (
          <div className="space-y-3">
            <Field label="Nome do cartão">
              <input
                autoFocus
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Nubank Roxinho"
              />
            </Field>
            <Field label="Conta vinculada">
              <select className={inputClass} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Cor">
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-input" />
              </Field>
              <Field label="Fechamento">
                <input type="number" min={1} max={31} className={inputClass} value={closingDay} onChange={(e) => setClosingDay(e.target.value)} />
              </Field>
              <Field label="Vencimento">
                <input type="number" min={1} max={31} className={inputClass} value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
              </Field>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={onClose} className="flex-1 rounded-lg border border-border bg-background py-2.5 text-sm font-semibold hover:bg-secondary">
                Cancelar
              </button>
              <button
                onClick={() => setConfirming(true)}
                disabled={!name.trim() || !accountId}
                className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                Adicionar
              </button>
            </div>
          </div>
        )}
      </Modal>

      <CardScopeConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={submit}
        title="Adicionar cartão"
        description="Em quais meses este cartão vai aparecer?"
        confirmLabel="Adicionar"
        defaultYear={dY}
        defaultMonth={dM}
        initialKind="month"
        loading={addCard.isPending}
      />
    </>
  );
}
