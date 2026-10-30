import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GripHorizontal, X } from "lucide-react";

const FOCUSABLE_FIELD_SELECTOR =
  'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="file"]):not([disabled]), textarea:not([disabled]), select:not([disabled])';

const MIN_WIDTH = 340;
const MIN_HEIGHT = 320;

type Rect = { left: number; top: number; width: number; height: number };

function loadRect(storageKey: string, defaultWidth: number, defaultHeight: number): Rect {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw) as Rect;
      if (parsed.width >= MIN_WIDTH && parsed.height >= MIN_HEIGHT) return parsed;
    }
  } catch {
    // ignore
  }
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;
  return {
    width: defaultWidth,
    height: defaultHeight,
    left: Math.max(16, (vw - defaultWidth) / 2),
    top: Math.max(16, (vh - defaultHeight) / 2),
  };
}

function saveRect(storageKey: string, rect: Rect) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(rect));
  } catch {
    // ignore
  }
}

/**
 * Variante "flutuante" do `Modal` — mesma API de props (drop-in), mas em
 * painel arrastável (cabeçalho) e redimensionável (canto inferior direito),
 * sem escurecer nem bloquear o resto da tela: dá pra ver e mexer no que tá
 * atrás enquanto o painel fica aberto. Mesmo mecanismo de arrastar/
 * redimensionar do `FloatingCalculator` (pointer capture via
 * `head`/`handle`), só que abre CENTRALIZADO por padrão — a calculadora
 * abre num canto. Posição/tamanho (depois que a pessoa arrasta/
 * redimensiona) ficam salvos no localStorage por `storageKey`, pra lembrar
 * da próxima vez.
 *
 * Só usada em telas largas (ver `useIsMobile` no chamador) — no celular o
 * `Modal` de sempre continua centralizado com fundo escurecido, porque não
 * sobra espaço pra arrastar uma janela numa tela pequena.
 */
export function FloatingModal({
  open,
  onClose,
  title,
  headerRight,
  subheader,
  footer,
  tall,
  children,
  storageKey = "floating-modal:rect",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  headerRight?: React.ReactNode;
  subheader?: React.ReactNode;
  footer?: React.ReactNode;
  tall?: boolean;
  children: React.ReactNode;
  /** Chave no localStorage pra lembrar posição/tamanho — separada por diálogo. */
  storageKey?: string;
}) {
  const defaultWidth = 512;
  const defaultHeight = tall ? 704 : 560;
  const [rect, setRect] = useState<Rect>(() => loadRect(storageKey, defaultWidth, defaultHeight));
  const rectRef = useRef(rect);
  rectRef.current = rect;
  const headRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

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
      saveRect(storageKey, rectRef.current);
      const target = e.currentTarget as Element | null;
      if (target?.hasPointerCapture?.(e.pointerId)) target.releasePointerCapture(e.pointerId);
    };
    // `setPointerCapture` prende todo o gesto (mouse/touch/caneta) neste
    // elemento até soltar — sem isso, arrastar no celular também rolaria a
    // página por baixo (mesmo cuidado do FloatingCalculator).
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
    // Depende de `open`: no primeiro render o modal está fechado (refs ainda
    // null, o efeito só sai sem anexar nada) — precisa rodar de novo quando
    // abre de verdade e o cabeçalho/alça já existem no DOM.
  }, [open, storageKey]);

  // Mantém o painel dentro da viewport se a janela encolher (ex.: girar o
  // aparelho, redimensionar a janela do navegador).
  useEffect(() => {
    if (!open) return;
    setRect((r) => ({
      ...r,
      left: Math.min(r.left, Math.max(0, window.innerWidth - r.width)),
      top: Math.min(r.top, Math.max(0, window.innerHeight - 48)),
    }));
  }, [open]);

  // Leva o foco pro primeiro campo ao abrir — mesmo comportamento do Modal.
  useEffect(() => {
    if (!open) return;
    const field = bodyRef.current?.querySelector<HTMLElement>(FOCUSABLE_FIELD_SELECTOR);
    field?.focus();
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed z-[9999] flex flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-elevated"
      style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
    >
      <div
        ref={headRef}
        className="flex shrink-0 cursor-grab touch-none items-center justify-between gap-3 border-b border-border px-5 py-4 active:cursor-grabbing"
      >
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
      {subheader && <div className="shrink-0 border-b border-border px-5 py-3">{subheader}</div>}
      <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto p-5">
        {children}
      </div>
      {footer && <div className="shrink-0 border-t border-border px-5 py-3">{footer}</div>}
      <div
        ref={handleRef}
        className="absolute right-1 bottom-1 flex h-5 w-5 touch-none cursor-nwse-resize items-center justify-center text-muted-foreground"
        aria-hidden="true"
      >
        <GripHorizontal className="h-3.5 w-3.5 rotate-45" />
      </div>
    </div>,
    document.body,
  );
}
