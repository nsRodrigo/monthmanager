import type { ReactNode } from "react";
import { ChevronLeft, X } from "lucide-react";

/**
 * Faixa de identidade (verde-esmeralda → teal) usada no topo das telas
 * principais. Puramente apresentacional — recebe tudo via props, não busca
 * dados nem contém lógica de negócio.
 */
export function HeaderBand({
  title,
  eyebrow,
  subtitle,
  onBack,
  avatar,
  right,
  onClose,
  className = "",
  collapsible = false,
}: {
  title: string;
  eyebrow?: ReactNode;
  subtitle?: ReactNode;
  onBack?: () => void;
  avatar?: ReactNode;
  right?: ReactNode;
  /** Botão de fechar painel, no canto superior direito da faixa (distinto de `onBack`). */
  onClose?: () => void;
  className?: string;
  /**
   * Quando true, a faixa encolhe (título/eyebrow somem) ao rolar a tela,
   * guiada pela CSS var `--band-p` (0–1) que `useBandScrollProgress` liga no
   * ancestral com scroll real — `onBack`/`avatar`/`right` continuam sempre
   * visíveis, só o bloco de título é que recolhe.
   */
  collapsible?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden bg-gradient-band px-5 sm:px-[30px] ${
        collapsible ? "" : "pb-10"
      } ${className}`}
      style={
        collapsible
          ? {
              paddingTop: "calc(22px - 6px * var(--band-p, 0) + env(safe-area-inset-top))",
              paddingBottom: "calc(40px - 34px * var(--band-p, 0))",
              transition: "padding-top .12s linear, padding-bottom .12s linear",
            }
          : {
              // Faixa agora fica sticky no topo de verdade em todas as telas —
              // soma a safe-area pra não desenhar o botão voltar/avatar por
              // baixo do notch/status bar no iOS (viewport-fit=cover).
              paddingTop: "calc(22px + env(safe-area-inset-top))",
            }
      }
    >
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar este painel"
          title="Fechar este painel"
          className="absolute top-1 right-1 flex h-7 w-7 shrink-0 items-center justify-center text-white/80 transition-colors hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      <div className="relative flex items-center gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Voltar"
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        {avatar}
        <div
          className="min-w-0 flex-1"
          style={
            collapsible
              ? {
                  opacity: "calc(1 - var(--band-p, 0))",
                  maxHeight: "calc(52px * (1 - var(--band-p, 0)))",
                  overflow: "hidden",
                  transition: "opacity .12s linear",
                }
              : undefined
          }
        >
          {eyebrow && (
            <p className="truncate text-[11.5px] font-medium text-white/70">{eyebrow}</p>
          )}
          <h1 className="mt-px truncate text-[23px] leading-tight font-extrabold tracking-tight text-white">
            {title}
          </h1>
          {subtitle && <p className="mt-0.5 truncate text-xs text-white/75">{subtitle}</p>}
        </div>
        {right}
      </div>
    </div>
  );
}
