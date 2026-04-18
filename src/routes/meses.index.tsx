import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useInstallments, useDebits, useIncomes } from "@/store/finance";
import { formatCurrency, MONTHS, MONTHS_SHORT } from "@/lib/format";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/meses/")({
  head: () => ({ meta: [{ title: "Meses — Finanças" }] }),
  component: MonthsList,
});

function MonthsList() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const { data: installments = [] } = useInstallments();
  const { data: debits = [] } = useDebits();
  const { data: incomes = [] } = useIncomes();

  const monthSummary = (m: number) => {
    const cInst = installments.filter((i) => i.year === year && i.month === m);
    const ds = debits.filter((d) => {
      const dt = new Date(d.date);
      return dt.getFullYear() === year && dt.getMonth() === m;
    });
    const is = incomes.filter((i) => {
      const dt = new Date(i.date);
      return dt.getFullYear() === year && dt.getMonth() === m;
    });
    const out = cInst.reduce((s, i) => s + i.amount, 0) + ds.reduce((s, d) => s + d.amount, 0);
    const inc = is.reduce((s, i) => s + i.amount, 0);
    return { out, inc, count: cInst.length + ds.length + is.length };
  };

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:py-12">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Visão anual</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">Meses de {year}</h1>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border bg-card p-1">
          <button
            onClick={() => setYear((y) => y - 1)}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-secondary"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-16 text-center text-sm font-semibold">{year}</span>
          <button
            onClick={() => setYear((y) => y + 1)}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-secondary"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {MONTHS.map((name, m) => {
          const { out, inc, count } = monthSummary(m);
          const balance = inc - out;
          return (
            <Link
              key={m}
              to="/meses/$year/$month"
              params={{ year: String(year), month: String(m) }}
              className="group relative overflow-hidden rounded-2xl border border-border bg-gradient-card p-5 transition-all hover:border-primary/40 hover:shadow-glow"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {MONTHS_SHORT[m]}
              </p>
              <p className="mt-1 text-lg font-bold">{name}</p>
              <p className={`mt-4 text-xl font-bold ${balance >= 0 ? "text-success" : "text-destructive"}`}>
                {formatCurrency(balance)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {count} {count === 1 ? "lançamento" : "lançamentos"}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
