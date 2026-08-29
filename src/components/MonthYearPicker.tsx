import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MONTHS } from "@/lib/format";
import {
  useCards,
  usePurchases,
  useInstallments,
  useDebits,
  useIncomes,
  useInvestments,
} from "@/store/finance";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Props = {
  contaId: string;
  year: number;
  month: number; // 0-11
  prev: { y: number; m: number };
  next: { y: number; m: number };
  /** Quando informado, troca de mês sem navegar a URL (usado dentro de um painel). */
  onNavigate?: (year: number, month: number) => void;
};

export function MonthYearPicker({ contaId, year, month, prev, next, onNavigate }: Props) {
  const navigate = useNavigate();
  const { data: cards = [] } = useCards();
  const { data: purchases = [] } = usePurchases();
  const { data: installments = [] } = useInstallments();
  const { data: debits = [] } = useDebits();
  const { data: incomes = [] } = useIncomes();
  const { data: investments = [] } = useInvestments();

  // Build map year -> Set<month> of months that have ANY value for this account
  const yearMonthMap = useMemo(() => {
    const map = new Map<number, Set<number>>();
    const add = (y: number, m: number) => {
      if (!map.has(y)) map.set(y, new Set());
      map.get(y)!.add(m);
    };
    const accountCardIds = new Set(
      cards.filter((c) => c.accountId === contaId).map((c) => c.id),
    );
    const accountPurchaseIds = new Set(
      purchases.filter((p) => accountCardIds.has(p.cardId)).map((p) => p.id),
    );

    // Installments
    for (const i of installments) {
      if (i.parentType === "purchase") {
        if (accountPurchaseIds.has(i.parentId)) add(i.year, i.month);
      } else if (i.parentType === "debit") {
        const d = debits.find((d) => d.id === i.parentId);
        if (d?.accountId === contaId) add(i.year, i.month);
      } else if (i.parentType === "income") {
        const inc = incomes.find((d) => d.id === i.parentId);
        if (inc?.accountId === contaId) add(i.year, i.month);
      }
    }

    // Debits single
    for (const d of debits) {
      if (d.accountId !== contaId || d.isParent) continue;
      if (d.referenceYear != null && d.referenceMonth != null) {
        add(d.referenceYear, d.referenceMonth);
      } else {
        if (!d.date) continue;
        const [y, m] = d.date.slice(0, 10).split("-").map(Number);
        if (y && m) add(y, m - 1);
      }
    }
    // Incomes single
    for (const inc of incomes) {
      if (inc.accountId !== contaId || inc.isParent) continue;
      if (inc.referenceYear != null && inc.referenceMonth != null) {
        add(inc.referenceYear, inc.referenceMonth);
      } else {
        if (!inc.date) continue;
        const [y, m] = inc.date.slice(0, 10).split("-").map(Number);
        if (y && m) add(y, m - 1);
      }
    }
    // Investments
    for (const inv of investments) {
      if (inv.accountId !== contaId || !inv.date) continue;
      const [y, m] = inv.date.slice(0, 10).split("-").map(Number);
      if (y && m) add(y, m - 1);
    }

    // Always include the currently viewed month so the picker can render it
    add(year, month);

    return map;
  }, [cards, purchases, installments, debits, incomes, investments, contaId, year, month]);

  const yearList = useMemo(
    () => Array.from(yearMonthMap.keys()).sort((a, b) => a - b),
    [yearMonthMap],
  );

  const monthsForYear = useMemo(() => {
    const set = yearMonthMap.get(year) ?? new Set<number>();
    return Array.from(set).sort((a, b) => a - b);
  }, [yearMonthMap, year]);

  const [openMonth, setOpenMonth] = useState(false);
  const [openYear, setOpenYear] = useState(false);

  // Mes anterior: determina se existe lancamento
  const prevHasData = (() => {
    const py = prev.y;
    const pm = prev.m;
    const months = yearMonthMap.get(py);
    return months ? months.has(pm) : false;
  })();

  const nextHasData = (() => {
    const ny = next.y;
    const nm = next.m;
    const months = yearMonthMap.get(ny);
    return months ? months.has(nm) : false;
  })();

  const go = (y: number, m: number) => {
    if (onNavigate) {
      onNavigate(y, m);
      return;
    }
    navigate({
      to: "/contas/$contaId/$ano/$mes",
      params: { contaId, ano: String(y), mes: String(m) },
    });
  };

  return (
    <div className="flex items-center gap-1 rounded-full border border-white/20 bg-white/15 p-1">
      <button
        type="button"
        onClick={() => go(prev.y, prev.m)}
        disabled={!prevHasData}
        className="rounded-full p-1.5 text-white/80 hover:bg-white/20 hover:text-white disabled:opacity-40 disabled:pointer-events-none"
        aria-label="Mês anterior"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </button>

      <div className="flex items-center gap-1 px-1">
        <Popover open={openMonth} onOpenChange={setOpenMonth}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="cursor-pointer rounded-md bg-transparent px-1.5 py-0.5 text-xs font-semibold text-white capitalize outline-none hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/50"
              aria-label="Selecionar mês"
            >
              {MONTHS[month]}
            </button>
          </PopoverTrigger>
          <PopoverContent align="center" className="w-40 p-1">
            <ul className="max-h-64 overflow-y-auto">
              {(monthsForYear.length > 0 ? monthsForYear : [month]).map((m) => (
                <li key={m}>
                  <button
                    type="button"
                    onClick={() => {
                      go(year, m);
                      setOpenMonth(false);
                    }}
                    className={cn(
                      "w-full rounded-md px-2 py-1.5 text-left text-sm capitalize hover:bg-secondary",
                      m === month && "bg-secondary font-semibold",
                    )}
                  >
                    {MONTHS[m]}
                  </button>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>

        <Popover open={openYear} onOpenChange={setOpenYear}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="cursor-pointer rounded-md bg-transparent px-1.5 py-0.5 text-xs font-semibold text-white outline-none hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/50"
              aria-label="Selecionar ano"
            >
              {year}
            </button>
          </PopoverTrigger>
          <PopoverContent align="center" className="w-28 p-1">
            <ul className="max-h-64 overflow-y-auto">
              {(yearList.length > 0 ? yearList : [year]).map((y) => (
                <li key={y}>
                  <button
                    type="button"
                    onClick={() => {
                      const months = yearMonthMap.get(y);
                      const targetMonth =
                        months && months.size > 0
                          ? months.has(month)
                            ? month
                            : Array.from(months).sort((a, b) => a - b)[0]
                          : month;
                      go(y, targetMonth);
                      setOpenYear(false);
                    }}
                    className={cn(
                      "w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary",
                      y === year && "bg-secondary font-semibold",
                    )}
                  >
                    {y}
                  </button>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      </div>

      <button
        type="button"
        onClick={() => go(next.y, next.m)}
        disabled={!nextHasData}
        className="rounded-full p-1.5 text-white/80 hover:bg-white/20 hover:text-white disabled:opacity-40 disabled:pointer-events-none"
        aria-label="Próximo mês"
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
