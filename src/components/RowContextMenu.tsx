import { useEffect, useRef } from "react";

export type RowContextMenuAction = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  destructive?: boolean;
};

/**
 * Popover de ações rápidas ancorado numa linha — aberto via toque longo
 * (mobile) ou clique direito (desktop, ver useLongPress). Fecha ao clicar
 * fora. Extraído do menu que já existia inline em CardRow.
 */
export function RowContextMenu({
  open,
  onClose,
  actions,
  align = "below",
  className,
}: {
  open: boolean;
  onClose: () => void;
  actions: RowContextMenuAction[];
  /** "below" (padrão, ancorado no topo — uso em linhas/cabeçalhos) ou "above" (ancorado embaixo — uso no FAB). */
  align?: "below" | "above";
  /** Classes extras de posicionamento (sobrepõe o padrão "left-4"). */
  className?: string;
}) {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: Event) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={menuRef}
      className={
        className ??
        `absolute left-4 z-20 min-w-[180px] overflow-hidden rounded-xl border border-border bg-popover shadow-lg ${
          align === "above" ? "bottom-full mb-1" : "top-full mt-1"
        }`
      }
    >
      {actions.map((a) => (
        <button
          key={a.label}
          type="button"
          onClick={() => {
            onClose();
            a.onClick();
          }}
          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary ${
            a.destructive ? "text-destructive" : ""
          }`}
        >
          <a.icon className="h-3.5 w-3.5" /> {a.label}
        </button>
      ))}
    </div>
  );
}
