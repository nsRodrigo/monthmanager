import { useEffect, useRef, useState } from "react";
import { inputClass } from "./Modal";
import { useCatalogItems, type CatalogItem } from "@/store/finance";
import { Search, MapPin, Package } from "lucide-react";

/**
 * Campo de Descrição ligado ao catálogo "Locais e Produtos" — um input
 * normal, digitável direto: conforme digita, filtra sugestões do catálogo
 * inteiro (cruzando débito/recebimento/compra/investimento, não só o
 * histórico do mesmo tipo). Escolher uma sugestão vincula a descrição a
 * ela; digitar algo sem correspondência e salvar o lançamento normalmente
 * cria esse item automaticamente no catálogo (ver `useUpsertCatalogItem`,
 * chamado no submit de cada diálogo) — sem nenhum passo extra aqui.
 */
export function CatalogDescriptionField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (name: string) => void;
  placeholder?: string;
}) {
  const { data: items = [] } = useCatalogItems();
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const q = value.trim().toLowerCase();
  const matches = q
    ? items.filter((i) => i.name.toLowerCase() !== q && i.name.toLowerCase().includes(q)).slice(0, 6)
    : [];

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  function select(item: CatalogItem) {
    onChange(item.name);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || matches.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      if (matches[highlight]) {
        e.preventDefault();
        select(matches[highlight]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        className={inputClass}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && matches.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-popover py-1 shadow-lg">
          {matches.map((item, idx) => {
            const Icon = item.kind === "local" ? MapPin : item.kind === "produto" ? Package : Search;
            return (
              <button
                key={item.id}
                type="button"
                onMouseEnter={() => setHighlight(idx)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(item);
                }}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm ${
                  idx === highlight ? "bg-secondary text-foreground" : ""
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${
                    item.kind === "local"
                      ? "bg-credit/20 text-credit"
                      : item.kind === "produto"
                        ? "bg-debit/20 text-debit"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                </span>
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">{item.usageCount}x</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
