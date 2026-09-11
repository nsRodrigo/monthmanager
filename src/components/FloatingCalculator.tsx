import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Calculator as CalculatorIcon, GripHorizontal, X } from "lucide-react";
import { Calculator } from "./Calculator";

const STORAGE_KEY = "floating-calculator:rect";
const MIN_WIDTH = 220;
const MIN_HEIGHT = 340;

type Rect = { left: number; top: number; width: number; height: number };

function loadRect(): Rect {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Rect;
      if (parsed.width >= MIN_WIDTH && parsed.height >= MIN_HEIGHT) return parsed;
    }
  } catch {
    // ignore
  }
  const width = 264;
  const height = 400;
  return {
    width,
    height,
    left: Math.max(16, (typeof window !== "undefined" ? window.innerWidth : 400) - width - 24),
    top: Math.max(16, (typeof window !== "undefined" ? window.innerHeight : 800) - height - 96),
  };
}

function saveRect(rect: Rect) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rect));
  } catch {
    // ignore
  }
}

/**
 * Calculadora em painel flutuante — arrastável (título) e redimensionável
 * (canto inferior direito), sem escurecer o resto da tela: substitui o
 * antigo `CalculatorModal` (que bloqueava tudo atrás). Posição/tamanho
 * ficam guardados em localStorage (preferência de dispositivo, não dado de
 * conta) e voltam do jeito que a pessoa deixou da última vez.
 */
export function FloatingCalculator({
  open,
  onClose,
  onUse,
}: {
  open: boolean;
  onClose: () => void;
  onUse?: (value: number) => void;
}) {
  const [result, setResult] = useState<number | null>(0);
  const [rect, setRect] = useState<Rect>(() => loadRect());
  const panelRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const rectRef = useRef(rect);
  rectRef.current = rect;

  useEffect(() => {
    const head = headRef.current;
    const handle = handleRef.current;
    if (!head || !handle) return;

    let mode: "drag" | "resize" | null = null;
    let sx = 0;
    let sy = 0;
    let start: Rect = rectRef.current;

    const onMove = (e: PointerEvent) => {
      if (!mode) return;
      e.preventDefault();
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      if (mode === "drag") {
        const maxLeft = Math.max(0, window.innerWidth - start.width);
        const maxTop = Math.max(0, window.innerHeight - 48);
        setRect((r) => ({
          ...r,
          left: Math.min(maxLeft, Math.max(0, start.left + dx)),
          top: Math.min(maxTop, Math.max(0, start.top + dy)),
        }));
      } else {
        setRect((r) => ({
          ...r,
          width: Math.max(MIN_WIDTH, start.width + dx),
          height: Math.max(MIN_HEIGHT, start.height + dy),
        }));
      }
    };
    const onUp = (e: PointerEvent) => {
      if (!mode) return;
      mode = null;
      saveRect(rectRef.current);
      const target = e.currentTarget as Element | null;
      if (target?.hasPointerCapture?.(e.pointerId)) target.releasePointerCapture(e.pointerId);
    };
    // `setPointerCapture` prende TODO o gesto (mouse/touch/caneta) neste
    // elemento até soltar o dedo/botão — sem isso, arrastar no celular também
    // rola a página por baixo (o toque "vaza" pro conteúdo atrás do painel,
    // que é `position: fixed` mas não bloqueia touch-scroll sozinho).
    const onHeadDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest("button")) return;
      e.preventDefault();
      mode = "drag";
      sx = e.clientX;
      sy = e.clientY;
      start = rectRef.current;
      head.setPointerCapture(e.pointerId);
    };
    const onHandleDown = (e: PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      mode = "resize";
      sx = e.clientX;
      sy = e.clientY;
      start = rectRef.current;
      handle.setPointerCapture(e.pointerId);
    };

    head.addEventListener("pointerdown", onHeadDown);
    handle.addEventListener("pointerdown", onHandleDown);
    head.addEventListener("pointermove", onMove);
    handle.addEventListener("pointermove", onMove);
    head.addEventListener("pointerup", onUp);
    handle.addEventListener("pointerup", onUp);
    head.addEventListener("pointercancel", onUp);
    handle.addEventListener("pointercancel", onUp);
    return () => {
      head.removeEventListener("pointerdown", onHeadDown);
      handle.removeEventListener("pointerdown", onHandleDown);
      head.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointermove", onMove);
      head.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointerup", onUp);
      head.removeEventListener("pointercancel", onUp);
      handle.removeEventListener("pointercancel", onUp);
    };
  }, [open]);

  if (!open) return null;

  async function handlePrimary() {
    if (result === null) return;
    if (onUse) {
      onUse(result);
      onClose();
    } else {
      try {
        await navigator.clipboard.writeText(String(result).replace(".", ","));
        toast.success("Resultado copiado.");
      } catch {
        toast.error("Não deu pra copiar — copie manualmente.");
      }
    }
  }

  return createPortal(
    <div
      ref={panelRef}
      className="fixed z-[9998] flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-elevated"
      style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
    >
      <div
        ref={headRef}
        className="flex shrink-0 cursor-grab touch-none items-center justify-between gap-2 border-b border-border bg-secondary px-3 py-2 active:cursor-grabbing"
      >
        <span className="flex items-center gap-1.5 text-xs font-semibold">
          <CalculatorIcon className="h-3.5 w-3.5 text-primary" /> Calculadora
        </span>
        <button
          onClick={onClose}
          aria-label="Fechar calculadora"
          className="rounded-md p-1 text-muted-foreground hover:bg-background hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col p-3">
        <div className="min-h-0 flex-1">
          <Calculator onResultChange={setResult} />
        </div>
        <button
          type="button"
          onClick={handlePrimary}
          disabled={result === null}
          className="mt-3 w-full shrink-0 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {onUse ? "Usar este valor" : "Copiar resultado"}
        </button>
      </div>
      <div
        ref={handleRef}
        className="absolute right-0.5 bottom-0.5 flex h-4 w-4 touch-none cursor-nwse-resize items-center justify-center text-muted-foreground"
        aria-hidden="true"
      >
        <GripHorizontal className="h-3 w-3 rotate-45" />
      </div>
    </div>,
    document.body,
  );
}
