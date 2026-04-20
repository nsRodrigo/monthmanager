import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowUpRight, Plus, Trash2 } from "lucide-react";
import {
  useIncomes,
  useInstallments,
  useAccounts,
  filterIncomesByAccount,
  getMonthIncomes,
  useToggleIncomeReceived,
  useToggleInstallmentPaid,
  useRemoveIncome,
} from "@/store/finance";
import { useAccountFilter } from "@/store/account-filter";
import { formatCurrency, MONTHS } from "@/lib/format";
import { AddIncomeDialog } from "@/components/AddIncomeDialog";

export const Route = createFileRoute("/recebimentos")({
  head: () => ({
    meta: [
      { title: "Recebimentos — Finanças" },
      { name: "description", content: "Salário, freelances e parcelas a receber." },
    ],
  }),
  component: RecebimentosPage,
});

function RecebimentosPage() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const { accountId } = useAccountFilter();
  const { data: accounts = [] } = useAccounts();
  const { data: allIncomes = [] } = useIncomes();
  const { data: installments = [] } = useInstallments();
  const incomes = filterIncomesByAccount(allIncomes, accountId);
  const monthIncomes = getMonthIncomes(incomes, installments, year, month);

  const total =
    monthIncomes.single.reduce((s, i) => s + i.amount, 0) +
    monthIncomes.parcelled.reduce((s, p) => s + p.installment.amount, 0);
  const pending =
    monthIncomes.single.filter((i) => !i.received).reduce((s, i) => s + i.amount, 0) +
    monthIncomes.parcelled
      .filter((p) => !p.installment.paid)
      .reduce((s, p) => s + p.installment.amount, 0);

  const toggleInc = useToggleIncomeReceived();
  const toggleInst = useToggleInstallmentPaid();
  const removeInc = useRemoveIncome();
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 md:py-12">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{MONTHS[month]} de {year}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">Recebimentos</h1>
          <p className="mt-2 text-muted-foreground">Entradas à vista ou parceladas.</p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          disabled={accounts.length === 0}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Novo recebimento
        </button>
      </header>

      <div className="bg-gradient-income mb-8 rounded-3xl p-6 text-white shadow-elegant">
        <p className="text-sm font-medium text-white/85">Total a receber · {MONTHS[month]}</p>
        <p className="mt-2 text-4xl font-bold">{formatCurrency(total)}</p>
        <p className="mt-1 text-sm text-white/80">{formatCurrency(pending)} pendente</p>
      </div>

      <ul className="space-y-2">
        {monthIncomes.single.length === 0 && monthIncomes.parcelled.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nenhum recebimento {accountId ? "nesta conta" : ""} em {MONTHS[month]}.
          </li>
        )}
        {monthIncomes.single.map((i) => {
          const acc = accounts.find((a) => a.id === i.accountId);
          return (
            <li key={i.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
              <input
                type="checkbox"
                checked={i.received}
                onChange={() => toggleInc.mutate({ id: i.id, received: !i.received })}
                className="h-4 w-4 accent-success"
              />
              <div className="min-w-0 flex-1">
                <p className={`truncate font-medium ${i.received ? "line-through text-muted-foreground" : ""}`}>{i.description}</p>
                <p className="text-xs text-muted-foreground">{acc?.name} · {new Date(i.date).toLocaleDateString("pt-BR")}</p>
              </div>
              <p className="text-sm font-semibold text-success">{formatCurrency(i.amount)}</p>
              <button onClick={() => removeInc.mutate(i.id)} className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          );
        })}
        {monthIncomes.parcelled.map(({ installment, income }) => {
          const acc = accounts.find((a) => a.id === income.accountId);
          return (
            <li key={installment.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
              <input
                type="checkbox"
                checked={installment.paid}
                onChange={() => toggleInst.mutate({ id: installment.id, paid: !installment.paid })}
                className="h-4 w-4 accent-success"
              />
              <div className="min-w-0 flex-1">
                <p className={`truncate font-medium ${installment.paid ? "line-through text-muted-foreground" : ""}`}>
                  {income.description} <span className="text-xs text-muted-foreground">({installment.number}/{installment.total})</span>
                </p>
                <p className="text-xs text-muted-foreground">{acc?.name} · {new Date(installment.dueDate).toLocaleDateString("pt-BR")}</p>
              </div>
              <p className="text-sm font-semibold text-success">{formatCurrency(installment.amount)}</p>
            </li>
          );
        })}
      </ul>

      <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
        <ArrowUpRight className="h-3 w-3" /> Cada parcela aparece como um recebimento normal no mês em que cai.
      </p>

      <AddIncomeDialog open={addOpen} onClose={() => setAddOpen(false)} defaultYear={year} defaultMonth={month} />
    </div>
  );
}
