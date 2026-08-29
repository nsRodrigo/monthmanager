import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";

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
  className = "",
}: {
  title: string;
  eyebrow?: ReactNode;
  subtitle?: ReactNode;
  onBack?: () => void;
  avatar?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-b-[26px] bg-gradient-band px-5 pt-4 pb-8 sm:px-7 ${className}`}
    >
      <div
        className="pointer-events-none absolute -top-10 right-[-10%] h-40 w-[60%] rounded-full bg-white/15 blur-2xl"
        aria-hidden="true"
      />
      <div className="relative flex items-center gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Voltar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        {avatar}
        <div className="min-w-0 flex-1">
          {eyebrow && <p className="truncate text-[11px] font-medium text-white/70">{eyebrow}</p>}
          <h1 className="truncate text-lg font-extrabold tracking-tight text-white sm:text-xl">
            {title}
          </h1>
          {subtitle && <p className="mt-0.5 truncate text-xs text-white/75">{subtitle}</p>}
        </div>
        {right}
      </div>
    </div>
  );
}
