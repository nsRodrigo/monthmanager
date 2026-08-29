import { useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useAccounts } from "@/store/finance";
import { usePanes, useMaxPanes } from "@/store/panes";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * "Abas" — como abas de navegador, espelha exatamente as contas visíveis na
 * tela agora (`panes`), nesta ordem. Clique normal num chip abre só aquela
 * conta, fechando as demais (`openSingle`) — igual a clicar na conta na
 * barra lateral. Ctrl/Cmd+clique (só faz sentido já dentro de /contas/*)
 * divide a tela — adiciona aquela conta ao lado da(s) que já está(ão)
 * visível(is), respeitando o limite de painéis do tamanho de tela atual. O
 * "+" faz o mesmo, mas por clique normal — abre um menu com as contas que
 * ainda não estão na tela. Fechar um painel pelo X remove a conta tanto da
 * tela quanto desta faixa — não fica lembrada em lugar nenhum.
 *
 * Embutido centralizado na barra superior de cada tela (Home, Meses,
 * Lançamento) — não existe em telas pequenas (nunca há mais de 1 painel
 * lado a lado ali).
 */
export function PaneTabsBar() {
  const { panes, splitIn, openSingle } = usePanes();
  const maxPanes = useMaxPanes();
  const location = useRouterState({ select: (s) => s.location });
  const { data: accounts = [] } = useAccounts();
  const navigate = useNavigate();
  const [pickerOpen, setPickerOpen] = useState(false);

  if (maxPanes === 1) return null;
  if (panes.length === 0) return null;

  const onContasRoute = location.pathname.startsWith("/contas/");
  const canSplit = panes.length < maxPanes;
  const availableToAdd = accounts.filter((a) => !panes.some((p) => p.contaId === a.id));

  return (
    <div className="pointer-events-auto flex max-w-full items-center gap-1.5 overflow-x-auto">
      {panes.map((p) => {
        const a = accounts.find((x) => x.id === p.contaId);
        if (!a) return null;
        return (
          <button
            key={p.contaId}
            type="button"
            title="Clique para abrir sozinha · Ctrl/Cmd+clique para abrir ao lado"
            onClick={(e) => {
              if ((e.ctrlKey || e.metaKey) && onContasRoute) {
                if (canSplit) splitIn(p.contaId);
                return;
              }
              openSingle(p.contaId);
              navigate({ to: "/contas/$contaId", params: { contaId: p.contaId } });
            }}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-primary/35 bg-primary/15 px-3 text-xs font-semibold text-primary transition-colors hover:border-primary/60"
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: a.color }}
              aria-hidden="true"
            />
            <span className="max-w-[8rem] truncate">{a.name}</span>
          </button>
        );
      })}
      {onContasRoute && canSplit && availableToAdd.length > 0 && (
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Abrir outra conta ao lado"
              title="Abrir outra conta ao lado"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-dashed border-border/60 text-primary transition-colors hover:border-primary"
            >
              <Plus className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="center" className="w-56 p-1.5">
            {availableToAdd.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  splitIn(a.id);
                  setPickerOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-secondary"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: a.color }}
                  aria-hidden="true"
                />
                <span className="truncate">{a.name}</span>
              </button>
            ))}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
