import { useEffect, useState } from "react";
import { Modal, Field, inputClass, Select, Accordion } from "./Modal";
import { useAccounts, useAddCard, useCards, type CardScope } from "@/store/finance";
import { useAccountFilter } from "@/store/account-filter";
import { CardScopeConfirmDialog } from "./CardScopeConfirmDialog";

// Paleta de cores para cartões — bem distintas entre si (matiz espaçado),
// pra que cartões vizinhos na lista nunca fiquem parecidos.
const CARD_COLOR_PALETTE = [
  "#8b5cf6", // violeta
  "#ef4444", // vermelho
  "#0ea5e9", // azul
  "#f59e0b", // âmbar
  "#10b981", // verde
  "#ec4899", // rosa
  "#14b8a6", // teal
  "#f97316", // laranja
  "#6366f1", // índigo
  "#84cc16", // lima
  "#06b6d4", // ciano
  "#a855f7", // roxo
];

/** Primeira cor da paleta ainda não usada por nenhum cartão da lista — cicla se todas já estiverem em uso. */
function pickUnusedColor(usedColors: string[]): string {
  const used = new Set(usedColors.map((c) => c.toLowerCase()));
  const free = CARD_COLOR_PALETTE.find((c) => !used.has(c.toLowerCase()));
  if (free) return free;
  return CARD_COLOR_PALETTE[usedColors.length % CARD_COLOR_PALETTE.length];
}

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
  const { data: cards = [] } = useCards();
  const { accountId: filter } = useAccountFilter();
  const addCard = useAddCard();

  const today = new Date();
  const dY = defaultYear ?? today.getFullYear();
  const dM = defaultMonth ?? today.getMonth();

  const [name, setName] = useState("");
  const [color, setColor] = useState("#8b5cf6");
  const [colorTouched, setColorTouched] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [closingDay, setClosingDay] = useState("25");
  const [dueDay, setDueDay] = useState("5");
  const [confirming, setConfirming] = useState(false);
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [notifyDaysBefore, setNotifyDaysBefore] = useState("");

  useEffect(() => {
    if (!open) return;
    const initialAccountId = fixedAccountId ?? filter ?? accounts[0]?.id ?? "";
    setName("");
    setColor(pickUnusedColor(cards.filter((c) => c.accountId === initialAccountId).map((c) => c.color)));
    setColorTouched(false);
    setAccountId(initialAccountId);
    setClosingDay("25");
    setDueDay("5");
    setConfirming(false);
    setNotifyEnabled(false);
    setNotifyDaysBefore("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, filter, accounts, fixedAccountId]);

  // Troca de conta (quando não fixa) sugere uma nova cor livre — a menos que
  // o usuário já tenha escolhido manualmente.
  useEffect(() => {
    if (!open || colorTouched || !accountId) return;
    setColor(pickUnusedColor(cards.filter((c) => c.accountId === accountId).map((c) => c.color)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  const submit = async (scope: CardScope) => {
    if (!name.trim() || !accountId) return;
    await addCard.mutateAsync({
      accountId,
      name: name.trim(),
      color,
      closingDay: Math.min(31, Math.max(1, parseInt(closingDay) || 25)),
      dueDay: Math.min(31, Math.max(1, parseInt(dueDay) || 5)),
      notifyDaysBefore: notifyEnabled ? Math.max(0, parseInt(notifyDaysBefore) || 0) : null,
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
            {!fixedAccountId && (
              <Field label="Conta vinculada">
                <Select className={inputClass} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </Select>
              </Field>
            )}
            <div className="grid grid-cols-3 gap-2">
              <Field label="Cor">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => {
                    setColor(e.target.value);
                    setColorTouched(true);
                  }}
                  className="h-10 w-full rounded-lg border border-input bg-input"
                />
              </Field>
              <Field label="Fechamento">
                <input type="number" min={1} max={31} className={inputClass} value={closingDay} onChange={(e) => setClosingDay(e.target.value)} />
              </Field>
              <Field label="Vencimento">
                <input type="number" min={1} max={31} className={inputClass} value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
              </Field>
            </div>

            <Accordion
              open={notifyEnabled}
              onOpenChange={(v) => {
                setNotifyEnabled(v);
                if (v && !notifyDaysBefore) setNotifyDaysBefore("1");
              }}
              label="Notificar antes do vencimento da fatura"
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
