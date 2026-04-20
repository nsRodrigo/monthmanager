import { createFileRoute, Link } from "@tanstack/react-router";
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
import { Plus, Trash2, Wallet, Building2, Smartphone, TrendingUp, Pencil, Check, X } from "lucide-react";

export const Route = createFileRoute("/contas")({
  head: () => ({ meta: [{ title: "Contas — Finanças" }] }),
  component: AccountsPage,
});

const TYPES: { value: AccountType; label: string; icon: typeof Wallet }[] = [
  { value: "corrente", label: "Conta corrente", icon: Building2 },
  { value: "digital", label: "Conta digital", icon: Smartphone },
  { value: "carteira", label: "Carteira / Dinheiro", icon: Wallet },
  { value: "investimento", label: "Investimento", icon: TrendingUp },
];

function AccountsPage() {
  const { data: accounts = [] } = useAccounts();
  const { data: cards = [] } = useCards();
  const { data: purchases = [] } = usePurchases();
  const { data: installments = [] } = useInstallments();
  const { data: debits = [] } = useDebits();
  const { data: incomes = [] } = useIncomes();
  const addAccount = useAddAccount();
  const removeAccount = useRemoveAccount();
  const updateAccount = useUpdateAccount();

  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("corrente");
  const [color, setColor] = useState("#8b5cf6");
  const [initial, setInitial] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editInitial, setEditInitial] = useState("");

  const submit = () => {
    if (!name.trim()) return;
    addAccount.mutate(
      { name: name.trim(), type, color, initialBalance: parseFloat(initial) || 0 },
      {
        onSuccess: () => {
          setName("");
          setInitial("");
        },
      },
    );
  };

  const totalConsolidado = accounts.reduce(
    (s, a) => s + computeAccountBalance(a, cards, purchases, installments, debits, incomes),
    0,
  );

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 md:py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Contas</h1>
        <p className="mt-2 text-muted-foreground">
          Cada conta (Itaú, Nubank, Mercado Pago…) tem saldo próprio e separa todos os lançamentos.
        </p>
      </header>

      <div className="rounded-2xl border border-border bg-gradient-card p-6 shadow-elegant">
        <p className="text-sm text-muted-foreground">Saldo consolidado</p>
        <p className={`mt-1 text-3xl font-bold ${totalConsolidado >= 0 ? "text-success" : "text-destructive"}`}>
          {formatCurrency(totalConsolidado)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Soma do saldo inicial + recebimentos pagos − débitos e cartões pagos.
        </p>
      </div>

      <section className="mt-6 space-y-3">
        {accounts.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Nenhuma conta. Cadastre sua primeira conta abaixo.
          </div>
        )}
        {accounts.map((a) => {
          const Icon = TYPES.find((t) => t.value === a.type)?.icon ?? Wallet;
          const balance = computeAccountBalance(a, cards, purchases, installments, debits, incomes);
          const cardCount = cards.filter((c) => c.accountId === a.id).length;
          const isEditing = editingId === a.id;
          return (
            <div key={a.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: a.color + "25", color: a.color }}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="space-y-2">
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full rounded-lg border border-input bg-input px-3 py-2 text-sm outline-none focus:border-primary" />
                      <input type="number" step="0.01" value={editInitial} onChange={(e) => setEditInitial(e.target.value)} placeholder="Saldo inicial" className="w-full rounded-lg border border-input bg-input px-3 py-2 text-sm outline-none focus:border-primary" />
                    </div>
                  ) : (
                    <>
                      <p className="font-semibold">{a.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {TYPES.find((t) => t.value === a.type)?.label} · {cardCount} {cardCount === 1 ? "cartão" : "cartões"}
                      </p>
                    </>
                  )}
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${balance >= 0 ? "text-foreground" : "text-destructive"}`}>{formatCurrency(balance)}</p>
                  <p className="text-[10px] text-muted-foreground">saldo atual</p>
                </div>
                <div className="flex flex-col gap-1">
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => {
                          updateAccount.mutate({ id: a.id, name: editName.trim(), initialBalance: parseFloat(editInitial) || 0 });
                          setEditingId(null);
                        }}
                        className="rounded p-1.5 text-success hover:bg-success/10"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="rounded p-1.5 text-muted-foreground hover:bg-secondary">
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setEditingId(a.id);
                          setEditName(a.name);
                          setEditInitial(String(a.initialBalance));
                        }}
                        className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Excluir "${a.name}" e TODOS os cartões, débitos, recebimentos e investimentos vinculados?`)) {
                            removeAccount.mutate(a.id);
                          }
                        }}
                        className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Nova conta</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome (ex: Itaú, Nubank)"
            className="rounded-lg border border-input bg-input px-3 py-2 text-sm outline-none focus:border-primary md:col-span-2"
          />
          <select value={type} onChange={(e) => setType(e.target.value as AccountType)} className="rounded-lg border border-input bg-input px-3 py-2 text-sm outline-none focus:border-primary">
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <input
            type="number"
            step="0.01"
            value={initial}
            onChange={(e) => setInitial(e.target.value)}
            placeholder="Saldo inicial (R$)"
            className="rounded-lg border border-input bg-input px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Cor</label>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-16 rounded-lg border border-input bg-input" />
          </div>
          <button
            onClick={submit}
            disabled={addAccount.isPending || !name.trim()}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Adicionar
          </button>
        </div>
      </section>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Depois de criar contas, vá para <Link to="/carteira" className="text-primary hover:underline">Carteira</Link> para cadastrar cartões e investimentos vinculados.
      </p>
    </div>
  );
}
