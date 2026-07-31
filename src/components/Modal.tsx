import { useEffect } from "react";
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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-50 flex h-dvh items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-t-3xl border border-border bg-card shadow-elevated sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-base font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
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
