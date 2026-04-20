import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronRight, Building2, Plus, Trash2 } from "lucide-react";
import {
  useCards,
  useAccounts,
  useInstallments,
  usePurchases,
  useRemoveCard,
  filterCardsByAccount,
  getMonthInstallments,
} from "@/store/finance";
import { useAccountFilter } from "@/store/account-filter";
import { formatCurrency, MONTHS } from "@/lib/format";
import { AddCardDialog } from "@/components/AddCardDialog";

export const Route = createFileRoute("/credito")({
  head: () => ({
    meta: [
      { title: "Crédito — Finanças" },
      { name: "description", content: "Cartões de crédito e faturas do mês." },
    ],
  }),
  component: CreditoPage,
});

function CreditoPage() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const { accountId } = useAccountFilter();
  const { data: accounts = [] } = useAccounts();
  const { data: allCards = [] } = useCards();
  const { data: purchases = [] } = usePurchases();
  const { data: installments = [] } = useInstallments();
  const removeCard = useRemoveCard();
  const [addOpen, setAddOpen] = useState(false);

  const cards = filterCardsByAccount(allCards, accountId);
  const monthInst = getMonthInstallments(installments, year, month).filter(
    (i) => i.parentType === "purchase",
  );
  const totalMonth = monthInst.reduce((s, i) => {
    const pur = purchases.find((p) => p.id === i.parentId);
    if (!pur) return s;
    if (accountId) {
      const card = allCards.find((c) => c.id === pur.cardId);
      if (card?.accountId !== accountId) return s;
    }
    return s + i.amount;
  }, 0);

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 md:py-12">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{MONTHS[month]} de {year} · fatura</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">Crédito</h1>
          <p className="mt-2 text-muted-foreground">
            Cartões organizados pelo mês de vencimento da fatura.
          </p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          disabled={accounts.length === 0}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Adicionar cartão
        </button>
      </header>

      <div className="bg-gradient-credit mb-8 rounded-3xl p-6 text-white shadow-elegant">
        <p className="text-sm font-medium text-white/85">Total das faturas do mês</p>
        <p className="mt-2 text-4xl font-bold">{formatCurrency(totalMonth)}</p>
      </div>

      {accounts.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">Cadastre uma conta antes de adicionar cartões.</p>
          <Link to="/contas" className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
            <Building2 className="h-4 w-4" /> Cadastrar conta
          </Link>
        </div>
      )}

      {accounts.length > 0 && cards.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhum cartão {accountId ? "nesta conta" : "cadastrado"}.
          </p>
          <button
            onClick={() => setAddOpen(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Adicionar primeiro cartão
          </button>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {cards.map((c) => {
          const account = accounts.find((a) => a.id === c.accountId);
          const cardInst = monthInst.filter((i) => {
            const pur = purchases.find((p) => p.id === i.parentId);
            return pur?.cardId === c.id;
          });
          const total = cardInst.reduce((s, i) => s + i.amount, 0);
          const allPaid = cardInst.length > 0 && cardInst.every((i) => i.paid);
          return (
            <div key={c.id} className="group relative overflow-hidden rounded-2xl border border-border bg-gradient-card p-5 transition-all hover:border-primary/40 hover:shadow-glow">
              <Link
                to="/meses/$year/$month/cartao/$cardId"
                params={{ year: String(year), month: String(month), cardId: c.id }}
                className="block"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                      <p className="truncate font-semibold">{c.name}</p>
                    </div>
                    {account && (
                      <p className="mt-1 truncate text-xs text-muted-foreground">{account.name}</p>
                    )}
                    <p className="mt-3 text-2xl font-bold">{formatCurrency(total)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {cardInst.length} {cardInst.length === 1 ? "lançamento" : "lançamentos"} · vence dia {c.dueDay}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${allPaid ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
                      {allPaid ? "Pago" : "Em aberto"}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Excluir cartão ${c.name}? Compras e parcelas vinculadas serão removidas.`)) {
                    removeCard.mutate(c.id);
                  }
                }}
                className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                title="Excluir cartão"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>

      <AddCardDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
