import { useCallback, useEffect, useState } from "react";
import { Filter, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PAYMENT_METHOD_OPTIONS, type PaymentMethod } from "@/store/finance";

export type PaymentTerm = "vista" | "parc";

export type EntryFilterState = {
  methods: Exclude<PaymentMethod, null>[];
  terms: PaymentTerm[];
};

const EMPTY: EntryFilterState = { methods: [], terms: [] };
const PREFIX = "monthmanager:filter:";

function read(scope: string): EntryFilterState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(PREFIX + scope);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<EntryFilterState>;
    return {
      methods: Array.isArray(parsed.methods) ? parsed.methods : [],
      terms: Array.isArray(parsed.terms) ? parsed.terms : [],
    };
  } catch {
    return EMPTY;
  }
}

function write(scope: string, state: EntryFilterState) {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(PREFIX + scope, JSON.stringify(state));
  } catch {
    // ignore
  }
}

/** Persiste o filtro (meio de pagamento + prazo) por seção, igual ao `useSortPreference`. */
export function useFilterPreference(scope: string) {
  const [state, setState] = useState<EntryFilterState>(() => read(scope));

  useEffect(() => {
    setState(read(scope));
  }, [scope]);

  const toggleMethod = useCallback(
    (m: Exclude<PaymentMethod, null>) => {
      setState((prev) => {
        const has = prev.methods.includes(m);
        const next = { ...prev, methods: has ? prev.methods.filter((x) => x !== m) : [...prev.methods, m] };
        write(scope, next);
        return next;
      });
    },
    [scope],
  );

  const toggleTerm = useCallback(
    (t: PaymentTerm) => {
      setState((prev) => {
        const has = prev.terms.includes(t);
        const next = { ...prev, terms: has ? prev.terms.filter((x) => x !== t) : [...prev.terms, t] };
        write(scope, next);
        return next;
      });
    },
    [scope],
  );

  const clear = useCallback(() => {
    setState(EMPTY);
    write(scope, EMPTY);
  }, [scope]);

  return { filter: state, toggleMethod, toggleTerm, clear };
}

/** `true` quando o item passa no filtro — chamador decide o `term` (vista/parc) do item. */
export function matchesEntryFilter(
  filter: EntryFilterState,
  method: PaymentMethod | null | undefined,
  term: PaymentTerm,
): boolean {
  const methodOk = filter.methods.length === 0 || (!!method && filter.methods.includes(method));
  const termOk = filter.terms.length === 0 || filter.terms.includes(term);
  return methodOk && termOk;
}

export function isFilterActive(filter: EntryFilterState): boolean {
  return filter.methods.length > 0 || filter.terms.length > 0;
}

const TERM_OPTIONS: { value: PaymentTerm; label: string }[] = [
  { value: "vista", label: "À vista" },
  { value: "parc", label: "Parcelado" },
];

/**
 * Botão "Filtrar" ao lado do "Ordenar" (mesmo visual do `SortMenu`) — filtra
 * por meio de pagamento (Débitos/Recebimentos, que têm esse campo) e por
 * prazo (à vista/parcelado, nas 3 seções). `showMethods=false` esconde o
 * primeiro grupo (usado em Cartões, que não tem meio de pagamento próprio —
 * toda compra já é sempre no cartão).
 */
export function FilterMenu({
  filter,
  onToggleMethod,
  onToggleTerm,
  onClear,
  showMethods = true,
}: {
  filter: EntryFilterState;
  onToggleMethod: (m: Exclude<PaymentMethod, null>) => void;
  onToggleTerm: (t: PaymentTerm) => void;
  onClear: () => void;
  showMethods?: boolean;
}) {
  const activeCount = filter.methods.length + filter.terms.length;
  const active = activeCount > 0;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label="Filtrar"
          title={active ? `${activeCount} filtro${activeCount === 1 ? "" : "s"} ativo${activeCount === 1 ? "" : "s"}` : "Filtrar"}
          className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2 text-[10px] font-semibold transition-colors ${
            active ? "bg-primary/15 text-primary hover:bg-primary/25" : "text-muted-foreground hover:bg-secondary"
          }`}
        >
          <Filter className="h-3.5 w-3.5" />
          {active && <span>Filtrar · {activeCount}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-1" onClick={(e) => e.stopPropagation()}>
        {showMethods && (
          <div className="px-1 py-1">
            <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Meio de pagamento
            </div>
            {PAYMENT_METHOD_OPTIONS.map((opt) => {
              const checked = filter.methods.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onToggleMethod(opt.value)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-secondary"
                >
                  {checked ? <Check className="h-3.5 w-3.5 text-primary" /> : <span className="h-3.5 w-3.5" />}
                  <span className={checked ? "font-semibold text-foreground" : "text-muted-foreground"}>{opt.label}</span>
                </button>
              );
            })}
          </div>
        )}
        <div className={showMethods ? "mt-1 border-t border-border px-1 py-1" : "px-1 py-1"}>
          <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Prazo de pagamento
          </div>
          {TERM_OPTIONS.map((opt) => {
            const checked = filter.terms.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onToggleTerm(opt.value)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-secondary"
              >
                {checked ? <Check className="h-3.5 w-3.5 text-primary" /> : <span className="h-3.5 w-3.5" />}
                <span className={checked ? "font-semibold text-foreground" : "text-muted-foreground"}>{opt.label}</span>
              </button>
            );
          })}
        </div>
        {!showMethods && (
          <p className="px-3 py-1.5 text-[10px] leading-relaxed text-muted-foreground">
            Sem filtro de meio de pagamento aqui — toda compra do cartão já é sempre no cartão.
          </p>
        )}
        <button
          type="button"
          onClick={onClear}
          disabled={!active}
          className="mt-1 w-full rounded-md border-t border-border px-2 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
        >
          Limpar filtros
        </button>
      </PopoverContent>
    </Popover>
  );
}
