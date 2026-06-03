import { useEffect } from "react";
import { Undo2, Redo2 } from "lucide-react";
import { useHistory } from "@/store/history";

/**
 * Botões fixos de desfazer/refazer no estilo Google Sheets.
 *
 * - Sempre visíveis; ficam desabilitados (cinza) quando a pilha está vazia.
 * - Atalhos globais: Ctrl/⌘+Z e Ctrl/⌘+Shift+Z.
 * - Atalhos são ignorados quando o foco está em campo de texto, para não
 *   atropelar o undo nativo do input/textarea.
 */
export function UndoRedoBar({ compact = false }: { compact?: boolean }) {
  const { canUndo, canRedo, nextUndoLabel, nextRedoLabel, busy, undo, redo } = useHistory();

  useEffect(() => {
    function isEditable(el: EventTarget | null) {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (el.isContentEditable) return true;
      return false;
    }

    function onKey(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key !== "z" && key !== "y") return;
      if (isEditable(e.target)) return;

      const isRedo = (key === "z" && e.shiftKey) || key === "y";
      e.preventDefault();
      if (isRedo) void redo();
      else void undo();
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const size = compact ? "h-8 w-8" : "h-9 w-9";
  const icon = compact ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <div className="flex items-center gap-1" role="toolbar" aria-label="Desfazer e refazer">
      <button
        type="button"
        onClick={() => void undo()}
        disabled={!canUndo}
        title={canUndo ? `Desfazer: ${nextUndoLabel} (Ctrl+Z)` : "Nada para desfazer"}
        aria-label={canUndo ? `Desfazer: ${nextUndoLabel}` : "Desfazer (indisponível)"}
        className={`flex ${size} items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-card`}
      >
        <Undo2 className={icon} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => void redo()}
        disabled={!canRedo}
        title={canRedo ? `Refazer: ${nextRedoLabel} (Ctrl+Shift+Z)` : "Nada para refazer"}
        aria-label={canRedo ? `Refazer: ${nextRedoLabel}` : "Refazer (indisponível)"}
        className={`flex ${size} items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-card`}
      >
        <Redo2 className={icon} aria-hidden="true" />
      </button>
      {busy && (
        <span className="ml-1 text-[10px] text-muted-foreground" aria-live="polite">
          ...
        </span>
      )}
    </div>
  );
}
