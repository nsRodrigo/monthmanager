import { useEffect, useRef, useState } from "react";
import { Undo2, Redo2 } from "lucide-react";
import { useHistory } from "@/store/history";

/**
 * Botões flutuantes de desfazer/refazer.
 *
 * - Aparecem no canto inferior direito apenas após uma nova ação ser
 *   registrada (ex.: salvar em um modal); somem após alguns segundos.
 * - Atalhos globais: Ctrl/⌘+Z e Ctrl/⌘+Shift+Z (ignorados em campos editáveis).
 */
export function UndoRedoBar() {
  const { canUndo, canRedo, nextUndoLabel, nextRedoLabel, busy, pushVersion, undo, redo } = useHistory();
  const [visible, setVisible] = useState(false);
  const lastVersion = useRef(pushVersion);

  // Atalhos de teclado globais
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

  // Mostra os botões apenas quando uma nova ação é registrada (push).
  // Some após 6s; não reaparece só porque ainda há algo desfazível.
  useEffect(() => {
    if (pushVersion === lastVersion.current) return;
    lastVersion.current = pushVersion;
    setVisible(true);
    const t = window.setTimeout(() => setVisible(false), 6000);
    return () => window.clearTimeout(t);
  }, [pushVersion]);

  if (!visible) return null;
  if (!canUndo && !canRedo) return null;

  return (
    <div
      className={`pointer-events-none fixed bottom-4 right-4 z-50 transition-all duration-200 ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
      }`}
      onMouseEnter={() => setVisible(true)}
    >
      <div
        className="pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-card/95 p-1 shadow-lg backdrop-blur"
        role="toolbar"
        aria-label="Desfazer e refazer"
      >
        <button
          type="button"
          onClick={() => void undo()}
          disabled={!canUndo}
          title={canUndo ? `Desfazer: ${nextUndoLabel} (Ctrl+Z)` : "Nada para desfazer"}
          aria-label={canUndo ? `Desfazer: ${nextUndoLabel}` : "Desfazer (indisponível)"}
          className="flex h-10 w-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <Undo2 className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => void redo()}
          disabled={!canRedo}
          title={canRedo ? `Refazer: ${nextRedoLabel} (Ctrl+Shift+Z)` : "Nada para refazer"}
          aria-label={canRedo ? `Refazer: ${nextRedoLabel}` : "Refazer (indisponível)"}
          className="flex h-10 w-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <Redo2 className="h-4 w-4" aria-hidden="true" />
        </button>
        {busy && (
          <span className="px-1 text-[10px] text-muted-foreground" aria-live="polite">
            ...
          </span>
        )}
      </div>
    </div>
  );
}
