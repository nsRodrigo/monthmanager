import { useCallback, useEffect, useState } from "react";
import { ArrowUpDown, ArrowDown, ArrowUp, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type SortOption = "default" | "name" | "amount" | "date";
export type SortDirection = "asc" | "desc";

export type SortState = { option: SortOption; direction: SortDirection };

const DEFAULT_STATE: SortState = { option: "default", direction: "asc" };
const PREFIX = "monthmanager:sort:";

function defaultDirection(option: SortOption): SortDirection {
  if (option === "amount" || option === "date") return "desc";
  return "asc";
}

function read(scope: string): SortState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(PREFIX + scope);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as SortState;
    if (!parsed || typeof parsed !== "object") return DEFAULT_STATE;
    return {
      option: (["default", "name", "amount", "date"].includes(parsed.option) ? parsed.option : "default") as SortOption,
      direction: parsed.direction === "desc" ? "desc" : "asc",
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function useSortPreference(scope: string) {
  const [state, setState] = useState<SortState>(() => read(scope));

  useEffect(() => {
    setState(read(scope));
  }, [scope]);

  const set = useCallback(
    (option: SortOption) => {
      setState((prev) => {
        let next: SortState;
        if (option === "default") {
          next = DEFAULT_STATE;
        } else if (prev.option === option) {
          next = { option, direction: prev.direction === "asc" ? "desc" : "asc" };
        } else {
          next = { option, direction: defaultDirection(option) };
        }
        try {
          if (typeof window !== "undefined") {
            window.localStorage.setItem(PREFIX + scope, JSON.stringify(next));
          }
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [scope],
  );

  return { sort: state, set };
}

const OPTIONS: { value: SortOption; label: string }[] = [
  { value: "default", label: "Padrão" },
  { value: "name", label: "Nome" },
  { value: "amount", label: "Valor" },
  { value: "date", label: "Data" },
];

function directionLabel(option: SortOption, direction: SortDirection) {
  if (option === "name") return direction === "asc" ? "A → Z" : "Z → A";
  if (option === "amount") return direction === "asc" ? "menor → maior" : "maior → menor";
  if (option === "date") return direction === "asc" ? "mais antiga" : "mais recente";
  return "";
}

export function SortMenu({
  scope,
  state,
  onChange,
  disableDate = false,
}: {
  scope: string;
  state: SortState;
  onChange: (option: SortOption) => void;
  /** Hide the Date option (e.g. for investments without date). */
  disableDate?: boolean;
}) {
  const active = state.option !== "default";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label="Ordenar"
          title={
            active
              ? `Ordenado por ${OPTIONS.find((o) => o.value === state.option)?.label} (${directionLabel(state.option, state.direction)})`
              : "Ordenar"
          }
          className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2 text-[10px] font-semibold transition-colors ${
            active
              ? "bg-primary/15 text-primary hover:bg-primary/25"
              : "text-muted-foreground hover:bg-secondary"
          }`}
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          {active && (
            <>
              <span>{OPTIONS.find((o) => o.value === state.option)?.label}</span>
              {state.direction === "asc" ? (
                <ArrowUp className="h-3 w-3" />
              ) : (
                <ArrowDown className="h-3 w-3" />
              )}
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-48 p-1"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Ordenar por
        </div>
        {OPTIONS.map((opt) => {
          if (opt.value === "date" && disableDate) return null;
          const isSel = state.option === opt.value;
          return (
            <button
              key={opt.value + scope}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-secondary ${
                isSel ? "font-semibold text-foreground" : "text-muted-foreground"
              }`}
            >
              <span className="flex items-center gap-2">
                {isSel ? (
                  <Check className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <span className="h-3.5 w-3.5" />
                )}
                {opt.label}
              </span>
              {isSel && opt.value !== "default" && (
                <span className="text-[10px] text-muted-foreground">
                  {state.direction === "asc" ? "↑" : "↓"}
                </span>
              )}
            </button>
          );
        })}
        {active && (
          <div className="border-t border-border mt-1 px-2 py-1.5 text-[10px] text-muted-foreground">
            Toque na opção ativa para inverter
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Generic comparator builder. Returns a sorted copy. */
export function applySort<T>(
  items: T[],
  state: SortState,
  accessors: {
    name: (it: T) => string;
    amount: (it: T) => number;
    date: (it: T) => string;
    id: (it: T) => string;
  },
): T[] {
  if (state.option === "default") return items;
  const dir = state.direction === "asc" ? 1 : -1;
  const arr = items.slice();
  arr.sort((a, b) => {
    let cmp = 0;
    if (state.option === "name") {
      cmp = accessors.name(a).localeCompare(accessors.name(b), "pt-BR", { sensitivity: "base" });
    } else if (state.option === "amount") {
      cmp = accessors.amount(a) - accessors.amount(b);
    } else if (state.option === "date") {
      cmp = accessors.date(a).localeCompare(accessors.date(b));
    }
    if (cmp !== 0) return cmp * dir;
    return accessors.id(a).localeCompare(accessors.id(b));
  });
  return arr;
}
