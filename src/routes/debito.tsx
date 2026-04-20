import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowDownRight, Plus, Trash2, TrendingUp } from "lucide-react";
import {
  useDebits,
  useIncomes,
  useInstallments,
  useInvestments,
  useAccounts,
  filterDebitsByAccount,
  filterInvestmentsByAccount,
  getMonthDebits,
  useToggleDebitPaid,
  useToggleInstallmentPaid,
  useRemoveDebit,
  useAddInvestment,
  useRemoveInvestment,
} from "@/store/finance";
import { useAccountFilter } from "@/store/account-filter";
import { formatCurrency, MONTHS } from "@/lib/format";
import { AddDebitDialog } from "@/components/AddDebitDialog";
import { AccountSelect } from "@/components/AccountSelect";
import { Field, inputClass } from "@/components/Modal";

export const Route = createFileRoute("/debito")({
  head: () => ({
    meta: [
      { title: "Débito — Finanças" },
      { name: "description", content: "Gastos no débito e investimentos." },
    ],
  }),
  component: DebitoPage,
});

function DebitoPage() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const { accountId } = useAccountFilter();
  const { data: accounts = [] } = useAccounts();
  const { data: allDebits = [] } = useDebits();
  const { data: allIncomes = [] } = useIncomes();
  const { data: installments = [] } = useInstallments();
  const { data: allInvestments = [] } = useInvestments();
  const debits = filterDebitsByAccount(allDebits, accountId);
  const investments = filterInvestmentsByAccount(allInvestments, accountId);
  const monthDebits = getMonthDebits(debits, installments, year, month);
  // We use incomes only for cross-reference of installments (not displayed here)
  void allIncomes;

  const total =
    monthDebits.single.reduce((s, d) => s + d.amount, 0) +
    monthDebits.parcelled.reduce((s, p) => s + p.installment.amount, 0);
  const pending =
    monthDebits.single.filter((d) => !d.paid).reduce((s, d) => s + d.amount, 0) +
    monthDebits.parcelled
      .filter((p) => !p.installment.paid)
      .reduce((s, p) => s + p.installment.amount, 0);

  const toggleDebit = useToggleDebitPaid();
  const toggleInst = useToggleInstallmentPaid();
  const removeDebit = useRemoveDebit();
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 md:py-12">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{MONTHS[month]} de {year}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">Débito</h1>
          <p className="mt-2 text-muted-foreground">Gastos diretos da conta corrente e investimentos.</p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          disabled={accounts.length === 0}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Novo débito
        </button>
      </header>

      <div className="bg-gradient-debit mb-8 rounded-3xl p-6 text-white shadow-elegant">
        <p className="text-sm font-medium text-white/85">Total de débitos · {MONTHS[month]}</p>
        <p className="mt-2 text-4xl font-bold">{formatCurrency(total)}</p>
        <p className="mt-1 text-sm text-white/80">{formatCurrency(pending)} pendente</p>
      </div>

      <section className="mb-10">
        <h2 className="mb-4 text-xl font-semibold">Lançamentos do mês</h2>
        {monthDebits.single.length === 0 && monthDebits.parcelled.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nenhum débito {accountId ? "nesta conta" : ""} em {MONTHS[month]}.
          </div>
        )}
        <ul className="space-y-2">
          {monthDebits.single.map((d) => {
            const acc = accounts.find((a) => a.id === d.accountId);
            return (
              <li key={d.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                <input
                  type="checkbox"
                  checked={d.paid}
                  onChange={() => toggleDebit.mutate({ id: d.id, paid: !d.paid })}
                  className="h-4 w-4 accent-primary"
                />
                <div className="min-w-0 flex-1">
                  <p className={`truncate font-medium ${d.paid ? "line-through text-muted-foreground" : ""}`}>{d.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {acc?.name} · {new Date(d.date).toLocaleDateString("pt-BR")}
                    {d.required ? " · obrigatório" : ""}
                    {d.autoDebit ? ` · débito automático${d.autoDebitDay ? ` dia ${d.autoDebitDay}` : ""}` : ""}
                  </p>
                </div>
                <p className="text-sm font-semibold text-debit">{formatCurrency(d.amount)}</p>
                <button onClick={() => removeDebit.mutate(d.id)} className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
          {monthDebits.parcelled.map(({ installment, debit }) => {
            const acc = accounts.find((a) => a.id === debit.accountId);
            return (
              <li key={installment.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                <input
                  type="checkbox"
                  checked={installment.paid}
                  onChange={() => toggleInst(installment.id, !installment.paid)}
                  className="h-4 w-4 accent-primary"
                />
                <div className="min-w-0 flex-1">
                  <p className={`truncate font-medium ${installment.paid ? "line-through text-muted-foreground" : ""}`}>
                    {debit.description} <span className="text-xs text-muted-foreground">({installment.number}/{installment.total})</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{acc?.name} · vence {new Date(installment.dueDate).toLocaleDateString("pt-BR")}</p>
                </div>
                <p className="text-sm font-semibold text-debit">{formatCurrency(installment.amount)}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <InvestmentsSection investments={investments} />

      <AddDebitDialog open={addOpen} onClose={() => setAddOpen(false)} defaultYear={year} defaultMonth={month} />
    </div>
  );
}

function InvestmentsSection({ investments }: { investments: ReturnType<typeof useInvestments>["data"] extends infer T ? Exclude<T, undefined> : never }) {
  const { accountId } = useAccountFilter();
  const { data: accounts = [] } = useAccounts();
  const addInv = useAddInvestment();
  const removeInv = useRemoveInvestment();
  const [type, setType] = useState("");
  const [amount, setAmount] = useState("");
  const [percentage, setPercentage] = useState("");
  const [invAccountId, setInvAccountId] = useState(accountId ?? "");

  const submit = async () => {
    if (!type.trim() || !amount || !invAccountId) return;
    await addInv.mutateAsync({
      accountId: invAccountId,
      type: type.trim(),
      amount: parseFloat(amount),
      percentage: parseFloat(percentage || "0"),
    });
    setType("");
    setAmount("");
    setPercentage("");
  };

  const total = investments.reduce((s, i) => s + i.amount, 0);

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <TrendingUp className="h-5 w-5" /> Investimentos
        </h2>
        <p className="text-sm font-semibold text-success">Total: {formatCurrency(total)}</p>
      </div>

      <div className="mb-4 rounded-2xl border border-border bg-card p-5 space-y-3">
        <p className="text-sm font-medium">Investir (sai da conta)</p>
        <AccountSelect value={invAccountId} onChange={setInvAccountId} label="Conta de origem" />
        <div className="grid grid-cols-3 gap-2">
          <Field label="Tipo">
            <input className={inputClass} value={type} onChange={(e) => setType(e.target.value)} placeholder="CDB, Tesouro..." />
          </Field>
          <Field label="Valor">
            <input type="number" step="0.01" className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
          </Field>
          <Field label="% (opcional)">
            <input type="number" step="0.01" className={inputClass} value={percentage} onChange={(e) => setPercentage(e.target.value)} placeholder="100" />
          </Field>
        </div>
        <button onClick={submit} disabled={!invAccountId || addInv.isPending} className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {addInv.isPending ? "Salvando…" : "Investir"}
        </button>
      </div>

      <ul className="space-y-2">
        {investments.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhum investimento {accountId ? "nesta conta" : ""}.
          </li>
        )}
        {investments.map((i) => {
          const acc = accounts.find((a) => a.id === i.accountId);
          return (
            <li key={i.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
              <ArrowDownRight className="h-4 w-4 text-success" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{i.type}</p>
                <p className="text-xs text-muted-foreground">{acc?.name}{i.percentage ? ` · ${i.percentage}%` : ""}</p>
              </div>
              <p className="text-sm font-semibold text-success">{formatCurrency(i.amount)}</p>
              <button onClick={() => removeInv.mutate(i.id)} className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
