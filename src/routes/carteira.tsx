import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  useCards,
  useAddCard,
  useRemoveCard,
  useInvestments,
  useAddInvestment,
  useRemoveInvestment,
  useAccounts,
  filterCardsByAccount,
  filterInvestmentsByAccount,
} from "@/store/finance";
import { useAccountFilter } from "@/store/account-filter";
import { useAuth } from "@/store/auth";
import { formatCurrency } from "@/lib/format";
import { Plus, Trash2, TrendingUp, CreditCard, LogOut } from "lucide-react";

export const Route = createFileRoute("/carteira")({
  head: () => ({ meta: [{ title: "Carteira — Finanças" }] }),
  component: WalletPage,
});

function WalletPage() {
  const { data: accounts = [] } = useAccounts();
  const { data: allCards = [] } = useCards();
  const { data: allInvestments = [] } = useInvestments();
  const { user, signOut } = useAuth();
  const { accountId: filter } = useAccountFilter();

  const cards = filterCardsByAccount(allCards, filter);
  const investments = filterInvestmentsByAccount(allInvestments, filter);

  const addCard = useAddCard();
  const removeCard = useRemoveCard();
  const addInvestment = useAddInvestment();
  const removeInvestment = useRemoveInvestment();

  const defaultAccount = filter ?? accounts[0]?.id ?? "";

  const [cardName, setCardName] = useState("");
  const [cardColor, setCardColor] = useState("#8b5cf6");
  const [cardAccount, setCardAccount] = useState(defaultAccount);

  const [invType, setInvType] = useState("");
  const [invAmount, setInvAmount] = useState("");
  const [invPct, setInvPct] = useState("");
  const [invAccount, setInvAccount] = useState(defaultAccount);

  // Keep selectors in sync with available accounts
  if (cardAccount && !accounts.some((a) => a.id === cardAccount)) {
    setCardAccount(defaultAccount);
  }
  if (invAccount && !accounts.some((a) => a.id === invAccount)) {
    setInvAccount(defaultAccount);
  }

  if (accounts.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-12 text-center">
        <h1 className="text-2xl font-bold">Crie uma conta primeiro</h1>
        <p className="mt-3 text-muted-foreground">
          Cartões e investimentos precisam pertencer a uma conta (Itaú, Nubank, etc.).
        </p>
        <Link to="/contas" className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground">
          <Plus className="h-4 w-4" /> Cadastrar conta
        </Link>
      </div>
    );
  }

  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? "—";

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 md:py-12">
      <header className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Carteira</h1>
          <p className="mt-2 text-muted-foreground">Cartões e investimentos por conta.</p>
        </div>
        <div className="flex flex-col items-end gap-2 md:hidden">
          <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          <button onClick={() => signOut()} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <LogOut className="h-3.5 w-3.5" /> Sair
          </button>
        </div>
      </header>

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-credit/15 text-credit">
            <CreditCard className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-semibold">Cartões de crédito{filter ? ` — ${accountName(filter)}` : ""}</h2>
        </div>
        <div className="mt-4 space-y-2">
          {cards.length === 0 && (
            <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              Nenhum cartão {filter ? "nesta conta" : "cadastrado"}.
            </p>
          )}
          {cards.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-lg border border-border bg-background/50 p-3">
              <div className="h-4 w-4 rounded-full" style={{ backgroundColor: c.color }} />
              <div className="flex-1">
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">{accountName(c.accountId)}</p>
              </div>
              <button
                onClick={() => {
                  if (confirm(`Excluir ${c.name}? Compras e parcelas vinculadas serão removidas.`)) removeCard.mutate(c.id);
                }}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-[1fr_1fr_auto_auto]">
          <input type="text" value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="Nome do cartão" className="rounded-lg border border-input bg-input px-3 py-2 text-sm outline-none focus:border-primary" />
          <select value={cardAccount} onChange={(e) => setCardAccount(e.target.value)} className="rounded-lg border border-input bg-input px-3 py-2 text-sm outline-none focus:border-primary">
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <input type="color" value={cardColor} onChange={(e) => setCardColor(e.target.value)} className="h-10 w-12 rounded-lg border border-input bg-input" />
          <button
            onClick={() => {
              if (!cardName.trim() || !cardAccount) return;
              addCard.mutate(
                { accountId: cardAccount, name: cardName.trim(), color: cardColor, closingDay: 25, dueDay: 5 },
                { onSuccess: () => setCardName("") },
              );
            }}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/15 text-success">
            <TrendingUp className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-semibold">Investimentos{filter ? ` — ${accountName(filter)}` : ""}</h2>
        </div>
        <div className="mt-4 space-y-2">
          {investments.length === 0 && (
            <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              Nenhum investimento {filter ? "nesta conta" : "cadastrado"}.
            </p>
          )}
          {investments.map((i) => (
            <div key={i.id} className="flex items-center gap-3 rounded-lg border border-border bg-background/50 p-3">
              <div className="flex-1">
                <p className="font-medium">{i.type}</p>
                <p className="text-xs text-muted-foreground">{accountName(i.accountId)} · {i.percentage}% a.a.</p>
              </div>
              <p className="font-semibold text-success">{formatCurrency(i.amount)}</p>
              <button onClick={() => removeInvestment.mutate(i.id)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-4">
          <input type="text" placeholder="Tipo (ex: CDB)" value={invType} onChange={(e) => setInvType(e.target.value)} className="rounded-lg border border-input bg-input px-3 py-2 text-sm outline-none focus:border-primary md:col-span-2" />
          <input type="number" placeholder="Valor" step="0.01" value={invAmount} onChange={(e) => setInvAmount(e.target.value)} className="rounded-lg border border-input bg-input px-3 py-2 text-sm outline-none focus:border-primary" />
          <input type="number" placeholder="% a.a." step="0.01" value={invPct} onChange={(e) => setInvPct(e.target.value)} className="rounded-lg border border-input bg-input px-3 py-2 text-sm outline-none focus:border-primary" />
          <select value={invAccount} onChange={(e) => setInvAccount(e.target.value)} className="rounded-lg border border-input bg-input px-3 py-2 text-sm outline-none focus:border-primary md:col-span-2">
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <button
            onClick={() => {
              if (!invType.trim() || !invAmount || !invAccount) return;
              addInvestment.mutate(
                { accountId: invAccount, type: invType.trim(), amount: parseFloat(invAmount), percentage: parseFloat(invPct) || 0 },
                {
                  onSuccess: () => {
                    setInvType("");
                    setInvAmount("");
                    setInvPct("");
                  },
                },
              );
            }}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 md:col-span-2"
          >
            Adicionar investimento
          </button>
        </div>
      </section>
    </div>
  );
}
