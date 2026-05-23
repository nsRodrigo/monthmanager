import { useRef, useCallback } from "react";

/**
 * Hook para detectar long-press (clique e segurar) em elementos.
 * Retorna handlers para serem espalhados no elemento e uma função
 * para verificar se o long-press disparou (útil para suprimir o click subsequente).
 */
export function useLongPress(callback: () => void, ms = 450) {
  const timerRef = useRef<number | null>(null);
  const firedRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      firedRef.current = false;
      startPosRef.current = { x: e.clientX, y: e.clientY };
      clear();
      timerRef.current = window.setTimeout(() => {
        firedRef.current = true;
        callback();
      }, ms);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!startPosRef.current) return;
      const dx = e.clientX - startPosRef.current.x;
      const dy = e.clientY - startPosRef.current.y;
      if (Math.hypot(dx, dy) > 10) clear();
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (e: React.MouseEvent) => {
      // Evita o menu de contexto nativo no mobile durante long-press
      e.preventDefault();
    },
  };

  return {
    handlers,
    didFire: () => firedRef.current,
    reset: () => {
      firedRef.current = false;
    },
  };
}
