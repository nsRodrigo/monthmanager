import { useEffect, useRef } from "react";

/** Acha o ancestral que de fato rola — um painel com overflow-y-auto (telas
 * de /contas/*, que rolam de forma independente) ou, na ausência de um, a
 * janela (Home e demais telas fora do workspace de painéis). */
function findScrollAncestor(el: HTMLElement | null): HTMLElement | (Window & typeof globalThis) {
  let node = el?.parentElement ?? null;
  while (node) {
    const overflowY = getComputedStyle(node).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") return node;
    node = node.parentElement;
  }
  return window;
}

/**
 * Liga `--band-p` (progresso de colapso da faixa, 0–1) e `--band-pf`
 * (progresso de fade do card sobreposto, 0–1) no elemento com scroll real —
 * como são setadas via CSS custom property, `HeaderBand` (collapsible) e o
 * card sobreposto, irmãos dentro desse mesmo ancestral, herdam o valor sem
 * precisar de refs próprios.
 *
 * `collapseRange`/`frameRange` são a distância (em px) de scroll até cada
 * efeito ficar 100% concluído. Deixe `collapseRange` em 0 pra desligar o
 * colapso da faixa (ex.: Home, que não tem seletor pra encolher até ele).
 */
export function useBandScrollProgress<T extends HTMLElement>({
  collapseRange = 0,
  frameRange = 68,
}: {
  collapseRange?: number;
  frameRange?: number;
}) {
  const anchorRef = useRef<T>(null);

  useEffect(() => {
    const scrollEl = findScrollAncestor(anchorRef.current);
    const varsTarget: HTMLElement =
      scrollEl === window ? document.documentElement : (scrollEl as HTMLElement);
    const getY = () => (scrollEl === window ? window.scrollY : (scrollEl as HTMLElement).scrollTop);

    let ticking = false;
    const update = () => {
      ticking = false;
      const y = getY();
      const pf = Math.max(0, Math.min(1, y / frameRange));
      varsTarget.style.setProperty("--band-pf", String(pf));
      if (collapseRange > 0) {
        const p = Math.max(0, Math.min(1, y / collapseRange));
        varsTarget.style.setProperty("--band-p", String(p));
      }
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };

    update();
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scrollEl.removeEventListener("scroll", onScroll);
      varsTarget.style.removeProperty("--band-pf");
      if (collapseRange > 0) varsTarget.style.removeProperty("--band-p");
    };
  }, [collapseRange, frameRange]);

  return anchorRef;
}
