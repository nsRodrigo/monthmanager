import type { ReactNode } from "react";
import { ChevronLeft, X } from "lucide-react";
import { HeaderActions } from "@/components/HeaderActions";

/**
 * Cabeçalho de página do painel escuro: fino, na cor do fundo, com uma
 * borda inferior — em vez da antiga faixa de marca (~130px + card
 * sobreposto). Não contém lógica de negócio.
 *
 * `right` recebe controles próprios da tela; no canto direito ficam sempre a
 * busca e o perfil (`HeaderActions`) — exceto em painel dividido (`onClose`),
 * onde cada painel teria os seus repetidos. `avatar` fica antes do título.
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
  actions,
}: {
  title: string;
  eyebrow?: ReactNode;
  subtitle?: ReactNode;
  onBack?: () => void;
  avatar?: ReactNode;
  right?: ReactNode;
  /** Botão de fechar painel, no canto superior direito (distinto de `onBack`). */
  onClose?: () => void;
  className?: string;
  /** Mostra busca + perfil no canto direito. Padrão: sim, salvo em painel dividido. */
  actions?: boolean;
  /** Mantido só por compatibilidade com telas antigas — não tem mais efeito. */
  compact?: boolean;
}) {
  const showActions = actions ?? !onClose;
  return (
    <div
      className={`relative border-b border-border bg-background px-4 pb-3.5 sm:px-6 ${className}`}
      // Soma a safe-area pra não desenhar o botão voltar/avatar por baixo do
      // notch/status bar no iOS (viewport-fit=cover).
      style={{ paddingTop: "calc(14px + env(safe-area-inset-top))" }}
    >
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar este painel"
          title="Fechar este painel"
          className="absolute top-1 right-1 flex h-7 w-7 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
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
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:border-ring/40 hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        {avatar}
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <p className="truncate text-xs font-medium text-muted-foreground">{eyebrow}</p>
          )}
          <h1 className="truncate font-display text-[22px] leading-tight font-semibold tracking-tight text-foreground sm:text-2xl">
            {title}
          </h1>
          {subtitle && <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {right}
        {showActions && <HeaderActions />}
      </div>
    </div>
  );
}
