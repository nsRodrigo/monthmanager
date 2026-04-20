import { createFileRoute, Link } from "@tanstack/react-router";
import { Wallet, Plus } from "lucide-react";
import { useAccounts, computeAccountBalance, useCards, usePurchases, useInstallments, useDebits, useIncomes } from "@/store/finance";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/dinheiro")({
  head: () => ({
    meta: [
      { title: "Carteira física — Finanças" },
      { name: "description", content: "Dinheiro físico, contas tipo carteira." },
    ],
  }),
  component: DinheiroPage,
});

function DinheiroPage() {
  const { data: accounts = [] } = useAccounts();
  const { data: cards = [] } = useCards();
  const { data: purchases = [] } = usePurchases();
  const { data: installments = [] } = useInstallments();
  const { data: debits = [] } = useDebits();
  const { data: incomes = [] } = useIncomes();

  const wallets = accounts.filter((a) => a.type === "carteira");
  const total = wallets.reduce(
    (s, a) => s + computeAccountBalance(a, cards, purchases, installments, debits, incomes),
    0,
  );

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 md:py-12">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Dinheiro físico</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">Carteira</h1>
          <p className="mt-2 text-muted-foreground">Valores em espécie, separados das contas bancárias.</p>
        </div>
        <Link to="/contas" className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow">
          <Plus className="h-4 w-4" /> Nova carteira
        </Link>
      </header>

      <div className="mb-8 rounded-3xl border border-border bg-gradient-card p-6">
        <p className="text-sm text-muted-foreground">Total em carteira</p>
        <p className={`mt-2 text-4xl font-bold ${total >= 0 ? "text-success" : "text-destructive"}`}>{formatCurrency(total)}</p>
      </div>

      {wallets.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <Wallet className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nenhuma carteira cadastrada. Crie uma conta do tipo <strong>Carteira</strong> em <Link to="/contas" className="text-primary hover:underline">Contas</Link>.
          </p>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {wallets.map((a) => {
          const bal = computeAccountBalance(a, cards, purchases, installments, debits, incomes);
          return (
            <div key={a.id} className="rounded-2xl border border-border bg-gradient-card p-5">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: a.color }} />
                <p className="font-semibold">{a.name}</p>
              </div>
              <p className={`mt-3 text-2xl font-bold ${bal >= 0 ? "text-success" : "text-destructive"}`}>{formatCurrency(bal)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
