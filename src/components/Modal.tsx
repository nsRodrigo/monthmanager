import { useEffect, useLayoutEffect, useRef } from "react";
import { X } from "lucide-react";

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const scrollYRef = useRef(0);

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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="animate-modal-pop relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-elevated">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-base font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
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
