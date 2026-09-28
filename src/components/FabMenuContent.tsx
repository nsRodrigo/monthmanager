import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "./ui/sheet";
import type { IconComponent } from "@/lib/fab-catalog";
import type { Tone } from "./FabAction";

export type ResolvedFabEntry =
  | { kind: "action"; id: string; label: string; icon: IconComponent; tone: Tone; onClick: () => void }
  | { kind: "folder"; id: string; label: string; icon: IconComponent; onOpen: () => void };

/**
 * Botão quadrado + gaveta inferior com a lista de opções — presentacional
 * puro, sem posicionamento próprio pro botão (`fixed`/`absolute` fica por
 * conta de quem usa) e sem diálogos de criar. A gaveta é igual ao "Mais" da
 * barra inferior (ver `MoreSheetContent` em `__root.tsx`). Usado tanto por
 * `ConfigurableFab` (telas simples) quanto direto pela tela de Lançamento.
 */
export function FabMenuContent({
  mainIcon: MainIcon,
  open,
  onOpenChange,
  entries,
  isSubLevel,
  onBack,
  positionClassName,
  title = "Adicionar",
  onMainClick,
  mainLabel,
}: {
  mainIcon: IconComponent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: ResolvedFabEntry[];
  isSubLevel: boolean;
  onBack: () => void;
  positionClassName?: string;
  title?: string;
  /**
   * Quando informado, o botão principal executa essa ação direto (ex.: abrir
   * o modal de novo lançamento) em vez de abrir a gaveta — que passa a ser
   * alcançada por um botão menor ao lado, com as demais opções.
   */
  onMainClick?: () => void;
  /** Rótulo acessível do botão principal quando `onMainClick` está definido. */
  mainLabel?: string;
}) {
  return (
    <>
      <div
        className={
          positionClassName ??
          "pointer-events-auto fixed bottom-[calc(var(--bnav-h)-3rem)] left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-3 md:left-auto md:right-8 md:bottom-10 md:translate-x-0 md:items-end"
        }
      >
        {onMainClick && (
          <button
            type="button"
            onClick={() => onOpenChange(true)}
            aria-label="Mais opções"
            title="Mais opções"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-elevated hover:text-foreground"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => (onMainClick ? onMainClick() : onOpenChange(true))}
          aria-label={onMainClick ? mainLabel : "Abrir menu"}
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-elevated"
        >
          <MainIcon className="h-6 w-6" />
        </button>
      </div>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="flex max-h-[80vh] flex-col gap-0 overflow-y-auto rounded-t-2xl p-4"
        >
          <SheetTitle className="mb-2 flex items-center gap-1.5 font-display text-lg font-semibold tracking-tight">
            {isSubLevel && (
              <button
                type="button"
                onClick={onBack}
                aria-label="Voltar"
                className="-ml-1 rounded-md p-1 text-muted-foreground hover:bg-secondary"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            {title}
          </SheetTitle>
          <div className="space-y-0.5">
            {entries.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => (e.kind === "folder" ? e.onOpen() : e.onClick())}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left text-[15px] font-medium hover:bg-secondary"
              >
                <e.icon className="h-[18px] w-[18px] shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="flex-1 truncate">{e.label}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
