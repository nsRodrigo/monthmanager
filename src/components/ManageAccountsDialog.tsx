import { useState } from "react";
import {
  useAccounts,
  useAddAccount,
  useRemoveAccount,
  useUpdateAccount,
  useCards,
  usePurchases,
  useInstallments,
  useDebits,
  useIncomes,
  computeAccountBalance,
  type AccountType,
} from "@/store/finance";
import { formatCurrency } from "@/lib/format";
import { Modal, Field, inputClass } from "./Modal";
import { CurrencyInput } from "./CurrencyInput";
import { Plus, Trash2, Pencil, Check, X, Wallet, Building2, Smartphone, TrendingUp } from "lucide-react";
import { useConfirm } from "@/store/confirm";

const TYPES: { value: AccountType; label: string; icon: typeof Wallet }[] = [
  { value: "corrente", label: "Conta corrente", icon: Building2 },
  { value: "digital", label: "Conta digital", icon: Smartphone },
  { value: "carteira", label: "Carteira / Dinheiro", icon: Wallet },
  { value: "investimento", label: "Investimento", icon: TrendingUp },
];

export function ManageAccountsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: accounts = [] } = useAccounts();
  const { data: cards = [] } = useCards();
  const { data: purchases = [] } = usePurchases();
  const { data: installments = [] } = useInstallments();
  const { data: debits = [] } = useDebits();
  const { data: incomes = [] } = useIncomes();
  const addAccount = useAddAccount();
  const removeAccount = useRemoveAccount();
  const updateAccount = useUpdateAccount();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("corrente");
  const [color, setColor] = useState("#8b5cf6");
  const [initial, setInitial] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editInitial, setEditInitial] = useState(0);

  const submit = () => {
    if (!name.trim()) return;
    addAccount.mutate(
      { name: name.trim(), type, color, initialBalance: initial || 0 },
      {
        onSuccess: () => {
          setName("");
          setInitial(0);
          setShowForm(false);
        },
      },
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Gerenciar contas">
      <div className="space-y-3">
        {accounts.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhuma conta cadastrada ainda.
          </div>
        )}

        {accounts.map((a) => {
          const Icon = TYPES.find((t) => t.value === a.type)?.icon ?? Wallet;
          const balance = computeAccountBalance(a, cards, purchases, installments, debits, incomes);
          const cardCount = cards.filter((c) => c.accountId === a.id).length;
          const isEditing = editingId === a.id;
          return (
            <div key={a.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-start gap-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: a.color + "25", color: a.color }}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="space-y-2">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className={inputClass}
                      />
                      <CurrencyInput value={editInitial} onValueChange={setEditInitial} placeholder="Saldo inicial" />
                    </div>
                  ) : (
                    <>
                      <p className="truncate font-semibold text-sm">{a.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {TYPES.find((t) => t.value === a.type)?.label} · {cardCount}{" "}
                        {cardCount === 1 ? "cartão" : "cartões"}
                      </p>
                    </>
                  )}
                </div>
                <div className="text-right">
                  <p
                    className={`text-sm font-bold ${
                      balance >= 0 ? "text-foreground" : "text-destructive"
                    }`}
                  >
                    {formatCurrency(balance)}
                  </p>
                </div>
                <div className="flex flex-col gap-0.5">
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => {
                          updateAccount.mutate({
                            id: a.id,
                            name: editName.trim(),
                            initialBalance: editInitial || 0,
                          });
                          setEditingId(null);
                        }}
                        className="rounded p-1 text-success hover:bg-success/10"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="rounded p-1 text-muted-foreground hover:bg-secondary"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setEditingId(a.id);
                          setEditName(a.name);
                          setEditInitial(a.initialBalance);
                        }}
                        className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={async () => {
                          const ok = await confirmDialog({
                            title: "Excluir conta",
                            description: `Excluir "${a.name}" e TODOS os cartões, débitos, recebimentos e investimentos vinculados?`,
                            variant: "destructive",
                            confirmLabel: "Excluir",
                          });
                          if (ok) removeAccount.mutate(a.id);
                        }}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-3 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary"
          >
            <Plus className="h-4 w-4" /> Adicionar conta
          </button>
        ) : (
          <div className="rounded-xl border border-border bg-card p-3 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Nova conta
            </p>
            <Field label="Nome">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Itaú, Nubank, Mercado Pago"
                className={inputClass}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Tipo">
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as AccountType)}
                  className={inputClass}
                >
                  {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Saldo inicial (R$)">
                <CurrencyInput value={initial} onValueChange={setInitial} />
              </Field>
            </div>
            <Field label="Cor">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-20 rounded-lg border border-input bg-input"
              />
            </Field>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={submit}
                disabled={addAccount.isPending || !name.trim()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                Adicionar
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
