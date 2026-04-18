import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useFinance } from "@/store/finance";
import { formatCurrency } from "@/lib/format";
import { Wallet, Plus, Trash2, TrendingUp, CreditCard } from "lucide-react";

export const Route = createFileRoute("/carteira")({
  head: () => ({ meta: [{ title: "Carteira — Finanças" }] }),
  component: WalletPage,
});

function WalletPage() {
  const { walletAmount, setWallet, cards, addCard, removeCard, investments, addInvestment, removeInvestment } = useFinance();
  const [walletInput, setWalletInput] = useState(String(walletAmount));
  const [cardName, setCardName] = useState("");
  const [cardColor, setCardColor] = useState("#8b5cf6");
  const [invType, setInvType] = useState("");
  const [invAmount, setInvAmount] = useState("");
  const [invPct, setInvPct] = useState("");

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 md:py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Carteira & Cadastros</h1>
        <p className="mt-2 text-muted-foreground">Gerencie dinheiro físico, cartões e investimentos.</p>
      </header>

      {/* Wallet */}
      <section className="rounded-2xl border border-border bg-gradient-card p-6 shadow-elegant">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Wallet className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-semibold">Dinheiro em carteira</h2>
        </div>
        <p className="mt-4 text-3xl font-bold">{formatCurrency(walletAmount)}</p>
        <div className="mt-4 flex gap-2">
          <input
            type="number"
            step="0.01"
            value={walletInput}
            onChange={(e) => setWalletInput(e.target.value)}
            className="flex-1 rounded-lg border border-input bg-input px-3 py-2 text-sm outline-none focus:border-primary"
            placeholder="0,00"
          />
          <button
            onClick={() => setWallet(parseFloat(walletInput) || 0)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Atualizar
          </button>
        </div>
      </section>

      {/* Cards */}
      <section className="mt-6 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-credit/15 text-credit">
            <CreditCard className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-semibold">Cartões de crédito</h2>
        </div>
        <div className="mt-4 space-y-2">
          {cards.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-lg border border-border bg-background/50 p-3">
              <div className="h-4 w-4 rounded-full" style={{ backgroundColor: c.color }} />
              <span className="flex-1 font-medium">{c.name}</span>
              <button
                onClick={() => {
                  if (confirm(`Excluir ${c.name}? Todas as compras e parcelas vinculadas serão removidas.`)) removeCard(c.id);
                }}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <input
            type="text"
            value={cardName}
            onChange={(e) => setCardName(e.target.value)}
            placeholder="Nome do cartão"
            className="flex-1 rounded-lg border border-input bg-input px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <input
            type="color"
            value={cardColor}
            onChange={(e) => setCardColor(e.target.value)}
            className="h-10 w-12 rounded-lg border border-input bg-input"
          />
          <button
            onClick={() => {
              if (!cardName.trim()) return;
              addCard({ name: cardName.trim(), color: cardColor, closingDay: 25, dueDay: 5 });
              setCardName("");
            }}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </section>

      {/* Investments */}
      <section className="mt-6 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/15 text-success">
            <TrendingUp className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-semibold">Investimentos</h2>
        </div>
        <div className="mt-4 space-y-2">
          {investments.length === 0 && (
            <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              Nenhum investimento cadastrado.
            </p>
          )}
          {investments.map((i) => (
            <div key={i.id} className="flex items-center gap-3 rounded-lg border border-border bg-background/50 p-3">
              <div className="flex-1">
                <p className="font-medium">{i.type}</p>
                <p className="text-xs text-muted-foreground">{i.percentage}% a.a.</p>
              </div>
              <p className="font-semibold text-success">{formatCurrency(i.amount)}</p>
              <button onClick={() => removeInvestment(i.id)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-4">
          <input
            type="text"
            placeholder="Tipo (ex: CDB)"
            value={invType}
            onChange={(e) => setInvType(e.target.value)}
            className="rounded-lg border border-input bg-input px-3 py-2 text-sm outline-none focus:border-primary md:col-span-2"
          />
          <input
            type="number"
            placeholder="Valor"
            step="0.01"
            value={invAmount}
            onChange={(e) => setInvAmount(e.target.value)}
            className="rounded-lg border border-input bg-input px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <input
            type="number"
            placeholder="% a.a."
            step="0.01"
            value={invPct}
            onChange={(e) => setInvPct(e.target.value)}
            className="rounded-lg border border-input bg-input px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={() => {
              if (!invType.trim() || !invAmount) return;
              addInvestment({
                type: invType.trim(),
                amount: parseFloat(invAmount),
                percentage: parseFloat(invPct) || 0,
              });
              setInvType("");
              setInvAmount("");
              setInvPct("");
            }}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 md:col-span-4"
          >
            Adicionar investimento
          </button>
        </div>
      </section>
    </div>
  );
}
