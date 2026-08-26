import { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, X } from "lucide-react";

const FOCUSABLE_FIELD_SELECTOR =
  'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="file"]):not([disabled]), textarea:not([disabled]), select:not([disabled])';

export function Modal({
  open,
  onClose,
  title,
  headerRight,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Conteúdo extra no cabeçalho, entre o título e o botão de fechar (ex.: PaidToggle). */
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  const scrollYRef = useRef(0);
  const bodyRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    scrollYRef.current = window.scrollY;
    const html = document.documentElement;
    html.style.overflow = "hidden";
    html.style.position = "fixed";
    html.style.top = `-${scrollYRef.current}px`;
    html.style.width = "100%";
    return () => {
      html.style.overflow = "";
      html.style.position = "";
      html.style.top = "";
      html.style.width = "";
      window.scrollTo(0, scrollYRef.current);
    };
  }, [open]);

  // Leva o foco pro primeiro campo do formulário ao abrir, pra dar pra
  // digitar direto sem precisar clicar dentro do modal antes.
  useEffect(() => {
    if (!open) return;
    const field = bodyRef.current?.querySelector<HTMLElement>(FOCUSABLE_FIELD_SELECTOR);
    field?.focus();
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="animate-modal-pop relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-elevated">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h3 className="text-base font-semibold">{title}</h3>
          <div className="flex shrink-0 items-center gap-2">
            {headerRight}
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div ref={bodyRef} className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-input bg-input px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary";

/**
 * Drop-in substituto de `<select className={inputClass}>` com seta
 * customizada — a seta nativa do navegador não é posicionável via CSS, então
 * escondemos ela (`appearance-none`) e desenhamos a nossa.
 */
export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...props} className={`${className ?? inputClass} appearance-none pr-8`}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-[12px] top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

/**
 * Pill de status, usado no cabeçalho do Modal (headerRight) para marcar um
 * lançamento como já pago/recebido — mesmo visual dos toggles de "Pago" nas
 * linhas da lista, só que como ação do próprio formulário.
 */
export function PaidToggle({
  checked,
  onChange,
  disabled,
  onLabel = "Pago",
  offLabel = "Marcar pago",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  onLabel?: string;
  offLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
        checked ? "bg-success/15 text-success hover:bg-success/25" : "bg-secondary text-muted-foreground hover:bg-secondary/70"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      {checked && <Check className="h-3 w-3" />}
      {checked ? onLabel : offLabel}
    </button>
  );
}

/**
 * Seção que expande ao clicar no cabeçalho (não num checkbox) — usada para
 * parâmetros opcionais que não representam, por si só, um "tipo" mutuamente
 * exclusivo (ex.: notificação de vencimento).
 */
export function Accordion({
  open,
  onOpenChange,
  label,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/50">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="flex w-full items-center justify-between gap-2 p-3 text-left text-sm font-medium"
      >
        <span>{label}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="space-y-3 border-t border-border p-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

/**
 * Checkbox com opções que expandem DENTRO do mesmo frame ao marcar — em vez
 * de um card de opções separado logo abaixo, como era antes (ex.: "É
 * parcelado?", "Recorrente", "Débito automático"). Usa a mesma animação de
 * altura (grid-rows 0fr/1fr) das seções de lançamentos.
 */
export function CheckboxExpand({
  checked,
  onChange,
  label,
  description,
  disabled,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/50">
      <label
        className={`flex items-start gap-3 p-3 ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
        />
        <span className="text-sm">
          <span className="font-medium">{label}</span>
          {description && (
            <span className="mt-0.5 block text-[11px] text-muted-foreground">{description}</span>
          )}
        </span>
      </label>
      {children && (
        <div
          className="grid transition-[grid-template-rows] duration-300 ease-in-out"
          style={{ gridTemplateRows: checked ? "1fr" : "0fr" }}
        >
          <div className="overflow-hidden">
            <div className="space-y-3 border-t border-border p-3">{children}</div>
          </div>
        </div>
      )}
    </div>
  );
}
