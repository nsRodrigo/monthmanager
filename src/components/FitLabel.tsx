import { useLayoutEffect, useRef, useState } from "react";

// Canvas único, reaproveitado por toda instância — medir texto não precisa
// de um canvas por rótulo, só de um contexto 2D pra chamar measureText.
let sharedCtx: CanvasRenderingContext2D | null | undefined;
function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (sharedCtx !== undefined) return sharedCtx;
  sharedCtx =
    typeof document === "undefined"
      ? null
      : (document.createElement("canvas").getContext("2d") ?? null);
  return sharedCtx;
}

/**
 * Rótulo que se ajusta à largura do próprio elemento: quando o texto
 * completo não cabe, corta da direita pra esquerda e acrescenta um "."
 * (ex.: "Investimento" → "Investim.") em vez de vazar ou usar reticências —
 * usado nas abas do modal de lançamento e nos itens da barra inferior, cuja
 * largura é pequena e fixa. Mede com Canvas `measureText` (sem manipular o
 * DOM visível, sem flicker) contra o próprio `clientWidth` do elemento, que
 * precisa ter uma largura definida (ex.: `w-full` dentro de um pai com
 * largura fixa) — sem isso não há "largura do botão" pra caber.
 */
export function FitLabel({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(text);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const recompute = () => {
      const ctx = getMeasureCtx();
      const available = el.clientWidth;
      if (!ctx || available <= 0) {
        setDisplay(text);
        return;
      }
      const style = getComputedStyle(el);
      ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const fits = (s: string) => ctx.measureText(s).width <= available;

      if (fits(text)) {
        setDisplay(text);
        return;
      }
      // Maior prefixo (+ ".") que ainda cabe.
      let lo = 1;
      let hi = text.length - 1;
      let best = 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (fits(text.slice(0, mid) + ".")) {
          best = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      setDisplay(text.slice(0, best) + ".");
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text]);

  return (
    <span
      ref={ref}
      className={`block w-full overflow-hidden text-center whitespace-nowrap ${className ?? ""}`}
    >
      {display}
    </span>
  );
}
