import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useInstallments, useDebits, useIncomes } from "@/store/finance";
import { formatCurrency, MONTHS } from "@/lib/format";
import { ChevronLeft, ChevronRight, ArrowDownRight, ArrowUpRight, CreditCard } from "lucide-react";

export const Route = createFileRoute("/meses/")({
  head: () => ({ meta: [{ title: "Meses — Finanças" }] }),
  component: MonthsList,
});

function MonthsList() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const [year, setYear] = useState(currentYear);
  const { data: installments = [] } = useInstallments();
  const { data: debits = [] } = useDebits();
  const { data: incomes = [] } = useIncomes();

  const monthSummary = (m: number) => {
    const credit = installments
      .filter((i) => i.year === year && i.month === m && i.parentType === "purchase")
      .reduce((s, i) => s + i.amount, 0);
    const debParcelled = installments
      .filter((i) => i.year === year && i.month === m && i.parentType === "debit")
      .reduce((s, i) => s + i.amount, 0);
    const debSingle = debits
      .filter((d) => {
        if (d.isParent) return false;
        const dt = new Date(d.date);
        return dt.getFullYear() === year && dt.getMonth() === m;
      })
      .reduce((s, d) => s + d.amount, 0);
    const debit = debParcelled + debSingle;
    const incParcelled = installments
      .filter((i) => i.year === year && i.month === m && i.parentType === "income")
      .reduce((s, i) => s + i.amount, 0);
    const incSingle = incomes
      .filter((i) => {
        if (i.isParent) return false;
        const dt = new Date(i.date);
        return dt.getFullYear() === year && dt.getMonth() === m;
      })
      .reduce((s, i) => s + i.amount, 0);
    const income = incParcelled + incSingle;
    const balance = income - credit - debit;
    return { credit, debit, income, balance };
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 md:py-12">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Visão anual</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">Meses de {year}</h1>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
          <button onClick={() => setYear((y) => y - 1)} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-secondary">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-14 text-center text-sm font-semibold">{year}</span>
          <button onClick={() => setYear((y) => y + 1)} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-secondary">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      <ul className="space-y-2.5">
        {MONTHS.map((name, m) => {
          const { credit, debit, income, balance } = monthSummary(m);
          const isCurrent = year === currentYear && m === currentMonth;
          return (
            <li key={m}>
              <Link
                to="/meses/$year/$month"
                params={{ year: String(year), month: String(m) }}
                className={`group flex items-center gap-4 rounded-2xl border bg-gradient-card p-4 transition-all hover:border-primary/40 hover:shadow-glow ${isCurrent ? "border-primary/50" : "border-border"}`}
              >
                <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-secondary text-center">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{name.slice(0, 3)}</span>
                  <span className="text-base font-bold leading-tight">{m + 1 < 10 ? `0${m + 1}` : m + 1}</span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold">{name}</p>
                    {isCurrent && (
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">Atual</span>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CreditCard className="h-3 w-3 text-credit" /> {formatCurrency(credit)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <ArrowDownRight className="h-3 w-3 text-debit" /> {formatCurrency(debit)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <ArrowUpRight className="h-3 w-3 text-success" /> {formatCurrency(income)}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Saldo</span>
                  <span className={`text-sm font-bold ${balance >= 0 ? "text-success" : "text-destructive"}`}>
                    {formatCurrency(balance)}
                  </span>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
