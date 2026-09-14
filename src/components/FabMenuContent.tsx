import { ChevronLeft } from "lucide-react";
import { FabAction } from "./FabAction";
import type { IconComponent } from "@/lib/fab-catalog";
import type { Tone } from "./FabAction";

export type ResolvedFabEntry =
  | { kind: "action"; id: string; label: string; icon: IconComponent; tone: Tone; onClick: () => void }
  | { kind: "folder"; id: string; label: string; icon: IconComponent; onOpen: () => void };

/**
 * Botão redondo + pills em leque — presentacional puro, sem posicionamento
 * (`fixed`/`absolute` fica por conta de quem usa) e sem diálogos próprios.
 * Usado tanto por `ConfigurableFab` (telas simples) quanto direto pela tela
 * de Lançamento (que mantém seu próprio posicionamento/embedded/portal).
 */
export function FabMenuContent({
  mainIcon: MainIcon,
  open,
  onOpenChange,
  entries,
  isSubLevel,
  onBack,
  positionClassName,
  backdropClassName,
}: {
  mainIcon: IconComponent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: ResolvedFabEntry[];
  isSubLevel: boolean;
  onBack: () => void;
  positionClassName?: string;
  backdropClassName?: string;
}) {
  return (
    <>
      {open && (
        <div className={backdropClassName ?? "fixed inset-0 z-30"} onClick={() => onOpenChange(false)} aria-hidden="true" />
      )}
      <div className={positionClassName ?? "fixed bottom-10 right-4 z-40 flex flex-col items-end gap-3 md:right-8"}>
        {open && (
          <div className="flex flex-col items-end gap-2.5">
            {isSubLevel && <FabAction icon={ChevronLeft} label="Voltar" tone="primary" onClick={onBack} />}
            {entries.map((e) =>
              e.kind === "folder" ? (
                <FabAction key={e.id} icon={e.icon} label={e.label} tone="primary" onClick={e.onOpen} />
              ) : (
                <FabAction key={e.id} icon={e.icon} label={e.label} tone={e.tone} onClick={e.onClick} />
              ),
            )}
          </div>
        )}
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
          className={`flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-elevated transition-transform duration-200 ${
            open ? "rotate-45" : ""
          }`}
        >
          <MainIcon className="h-6 w-6" />
        </button>
      </div>
    </>
  );
}
