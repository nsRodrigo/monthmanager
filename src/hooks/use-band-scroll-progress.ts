import { useEffect, useRef, useState, type RefObject } from "react";

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

/**
 * Volta o scroll pro topo sempre que algo em `deps` muda — pro painel de
 * /contas/* (que rola dentro de um div próprio, não a janela), trocar de
 * conta ou de mês/ano herdava o scrollTop de onde a tela anterior tinha
 * ficado, em vez de começar do topo. Reaproveita o mesmo `anchorRef` de
 * `useBandScrollProgress` — os dois vivem dentro do mesmo ancestral com
 * scroll real.
 */
export function useResetScrollOnChange(ref: RefObject<HTMLElement | null>, deps: unknown[]) {
  useEffect(() => {
    const scrollEl = findScrollAncestor(ref.current);
    if (scrollEl === window) window.scrollTo(0, 0);
    else (scrollEl as HTMLElement).scrollTop = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * Booleano com histerese (não fica "piscando" na fronteira): vira `true`
 * quando o scroll passa de `enterAt`, só volta a `false` quando cai abaixo
 * de `exitAt`. Usado pra colapsar/expandir um bloco por estado do React
 * (classe CSS com transição normal) em vez de recalcular `max-height` a
 * cada pixel via CSS var — essa segunda abordagem, dentro de um ancestral
 * `position: sticky`, tinha layout e pintura dessincronizando durante a
 * animação (o conteúdo seguinte aparecia "fantasma" por cima).
 */
export function useScrollPastThreshold(
  ref: RefObject<HTMLElement | null>,
  { enterAt, exitAt }: { enterAt: number; exitAt: number },
) {
  const [past, setPast] = useState(false);

  useEffect(() => {
    const scrollEl = findScrollAncestor(ref.current);
    const getY = () => (scrollEl === window ? window.scrollY : (scrollEl as HTMLElement).scrollTop);

    let ticking = false;
    const update = () => {
      ticking = false;
      const y = getY();
      setPast((prev) => (prev ? y > exitAt : y > enterAt));
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };

    update();
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollEl.removeEventListener("scroll", onScroll);
  }, [ref, enterAt, exitAt]);

  return past;
}

/**
 * Fecha um bloco (acordeão) acompanhando o scroll em tempo real — a altura
 * vai de "auto" (medida via ResizeObserver, pra continuar certa se o
 * conteúdo mudar) até 0 conforme o scroll avança até `closeRange`, e volta
 * a abrir do mesmo jeito ao rolar de volta pro topo.
 *
 * Só funciona sem "fantasma"/travamento se o ancestral que rola tiver
 * `overflow-anchor: none` — sem isso, o navegador tenta compensar
 * sozinho a posição de scroll toda vez que esse bloco muda de altura
 * (scroll anchoring), brigando com a própria lógica daqui.
 */
export function useAccordionScrollClose(
  scrollRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  { closeRange = 130, chevronRef }: { closeRange?: number; chevronRef?: RefObject<HTMLElement | null> } = {},
) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollEl = findScrollAncestor(scrollRef.current);
    const wrapper = wrapperRef.current;
    const content = contentRef.current;
    if (!wrapper || !content) return;

    const getY = () => (scrollEl === window ? window.scrollY : (scrollEl as HTMLElement).scrollTop);

    let naturalHeight = content.scrollHeight;
    let ticking = false;
    const update = () => {
      ticking = false;
      const y = getY();
      const p = Math.max(0, Math.min(1, y / closeRange));
      wrapper.style.height = `${naturalHeight * (1 - p)}px`;
      wrapper.style.opacity = String(1 - p);
      if (chevronRef?.current) chevronRef.current.style.transform = `rotate(${p * -180}deg)`;
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };

    const ro = new ResizeObserver(() => {
      naturalHeight = content.scrollHeight;
      update();
    });
    ro.observe(content);

    update();
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      ro.disconnect();
      scrollEl.removeEventListener("scroll", onScroll);
    };
  }, [scrollRef, contentRef, closeRange]);

  return wrapperRef;
}
