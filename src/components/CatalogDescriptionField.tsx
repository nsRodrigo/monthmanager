import { useEffect, useRef, useState } from "react";
import { inputClass } from "./Modal";
import { useCatalogItems, type CatalogItem } from "@/store/finance";
import { Search, MapPin, Package } from "lucide-react";

/**
 * Campo de Descrição ligado ao catálogo "Locais e Produtos" — em vez de
 * digitar direto, o campo é um gatilho: ao tocar, abre um painel com um
 * campo de pesquisa no topo (que busca no catálogo inteiro, cruzando
 * débito/recebimento/compra/investimento) e a lista de itens abaixo.
 * Escolher um item vincula a descrição a ele; digitar algo sem
 * correspondência e fechar o painel usa esse texto — o item novo é
 * cadastrado automaticamente no catálogo quando o lançamento é salvo (ver
 * `useUpsertCatalogItem`), sem nenhum passo extra aqui.
 */
export function CatalogDescriptionField({
  value,
  onChange,
  placeholder = "Buscar ou digitar uma descrição...",
}: {
  value: string;
  onChange: (name: string) => void;
  placeholder?: string;
}) {
  const { data: items = [] } = useCatalogItems();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const q = query.trim().toLowerCase();
  const matches = (q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items).slice(0, 8);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close();
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function openPanel() {
    setOpen(true);
    setQuery("");
    setHighlight(0);
    setTimeout(() => searchRef.current?.focus(), 0);
  }

  function close(finalValue?: string) {
    setOpen(false);
    if (finalValue !== undefined && finalValue.trim()) onChange(finalValue.trim());
  }

  function select(item: CatalogItem) {
    close(item.name);
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      close();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, matches.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (matches[highlight]) select(matches[highlight]);
      else close(query);
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={openPanel}
        className={`${inputClass} flex items-center justify-between gap-2 text-left ${open ? "border-primary" : ""}`}
      >
        <span className={`truncate ${value ? "" : "text-muted-foreground"}`}>{value || placeholder}</span>
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlight(0);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="Pesquisar em Locais e Produtos..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {matches.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                {q ? (
                  <>&ldquo;{query.trim()}&rdquo; será criado automaticamente ao salvar.</>
                ) : (
                  "Nenhum item em Locais e Produtos ainda."
                )}
              </p>
            ) : (
              matches.map((item, idx) => {
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
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm ${idx === highlight ? "bg-secondary" : ""}`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
                        item.kind === "local"
                          ? "bg-credit/20 text-credit"
                          : item.kind === "produto"
                            ? "bg-debit/20 text-debit"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{item.usageCount}x</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
