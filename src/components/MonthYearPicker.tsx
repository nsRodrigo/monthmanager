import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MONTHS } from "@/lib/format";

type Props = {
  contaId: string;
  year: number;
  month: number; // 0-11
  prev: { y: number; m: number };
  next: { y: number; m: number };
};

const YEARS_BACK = 3;
const YEARS_FORWARD = 3;

export function MonthYearPicker({ contaId, year, month, prev, next }: Props) {
  const navigate = useNavigate();
  const today = new Date();
  const baseYear = today.getFullYear();
  const yearList: number[] = [];
  for (let y = baseYear - YEARS_BACK; y <= baseYear + YEARS_FORWARD; y++) yearList.push(y);
  if (!yearList.includes(year)) yearList.push(year);
  yearList.sort((a, b) => a - b);

  const go = (y: number, m: number) => {
    navigate({
      to: "/contas/$contaId/$ano/$mes",
      params: { contaId, ano: String(y), mes: String(m) },
    });
  };

  return (
    <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
      <button
        type="button"
        onClick={() => go(prev.y, prev.m)}
        className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
        aria-label="Mês anterior"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </button>

      <div className="flex items-center gap-1 px-1">
        <label className="sr-only" htmlFor="month-select">
          Mês
        </label>
        <select
          id="month-select"
          value={month}
          onChange={(e) => go(year, Number(e.target.value))}
          className="cursor-pointer rounded-md border-0 bg-transparent px-1 py-0.5 text-xs font-semibold capitalize outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
        >
          {MONTHS.map((mname, m) => (
            <option key={m} value={m}>
              {mname}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="year-select">
          Ano
        </label>
        <select
          id="year-select"
          value={year}
          onChange={(e) => go(Number(e.target.value), month)}
          className="cursor-pointer rounded-md border-0 bg-transparent px-1 py-0.5 text-xs font-semibold outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
        >
          {yearList.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={() => go(next.y, next.m)}
        className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
        aria-label="Próximo mês"
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
