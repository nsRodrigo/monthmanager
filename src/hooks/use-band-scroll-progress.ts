import { useCallback, useEffect, useRef, useState } from "react";

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
 * Como `useRef`, mas o valor vira estado do React (via callback ref) em vez
 * de só uma "caixinha" que muda por fora sem avisar ninguém.
 *
 * O motivo de existir: várias telas daqui (Home, Meses, Lançamentos) têm
 * uma primeira renderização de carregamento/vazio ANTES do conteúdo real
 * (por causa de dados que ainda não chegaram) — o elemento que os hooks de
 * scroll abaixo precisam só existe a partir da segunda renderização. Com
 * `useRef` puro, o efeito que liga o listener de scroll roda uma vez (vê o
 * ref `null`, desiste) e nunca mais — nada avisa o React que o valor mudou,
 * então o efeito não tem motivo (nenhuma dependência mudou) pra rodar de
 * novo quando o elemento de verdade aparece. Resultado: o scroll parece
 * "não fazer nada", porque o listener nunca chegou a existir.
 */
export function useAnchorNode<T extends HTMLElement>() {
  const nodeRef = useRef<T | null>(null);
  const [, forceUpdate] = useState(0);
  const setNode = useCallback((el: T | null) => {
    nodeRef.current = el;
    forceUpdate((n) => n + 1);
  }, []);
  return [nodeRef.current, setNode] as const;
}

/**
 * Liga `--band-p` (progresso de colapso da faixa, 0–1) e `--band-pf`
 * (progresso de fade do card sobreposto, 0–1) no elemento com scroll real —
 * como são setadas via CSS custom property, `HeaderBand` (collapsible) e o
 * card sobreposto, irmãos dentro desse mesmo ancestral, herdam o valor sem
 * precisar de refs próprios.
 *
 * `anchor` é o elemento de `useAnchorNode` (não um `useRef` puro — ver o
 * comentário lá em cima). `collapseRange`/`frameRange` são a distância (em
 * px) de scroll até cada efeito ficar 100% concluído. Deixe `collapseRange`
 * em 0 pra desligar o colapso da faixa (ex.: Home, que não tem seletor pra
 * encolher até ele).
 */
export function useBandScrollProgress(
  anchor: HTMLElement | null,
  { collapseRange = 0, frameRange = 68 }: { collapseRange?: number; frameRange?: number },
) {
  useEffect(() => {
    if (!anchor) return;
    const scrollEl = findScrollAncestor(anchor);
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
  }, [anchor, collapseRange, frameRange]);
}

/**
 * Volta o scroll pro topo sempre que algo em `deps` muda — pro painel de
 * /contas/* (que rola dentro de um div próprio, não a janela), trocar de
 * conta ou de mês/ano herdava o scrollTop de onde a tela anterior tinha
 * ficado, em vez de começar do topo.
 */
export function useResetScrollOnChange(anchor: HTMLElement | null, deps: unknown[]) {
  useEffect(() => {
    if (!anchor) return;
    const scrollEl = findScrollAncestor(anchor);
    if (scrollEl === window) window.scrollTo(0, 0);
    else (scrollEl as HTMLElement).scrollTop = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor, ...deps]);
}

/**
 * Booleano com histerese (não fica "piscando" na fronteira): vira `true`
 * quando o scroll passa de `enterAt`, só volta a `false` quando cai abaixo
 * de `exitAt`.
 */
export function useScrollPastThreshold(
  anchor: HTMLElement | null,
  { enterAt, exitAt }: { enterAt: number; exitAt: number },
) {
  const [past, setPast] = useState(false);

  useEffect(() => {
    if (!anchor) return;
    const scrollEl = findScrollAncestor(anchor);
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
  }, [anchor, enterAt, exitAt]);

  return past;
}

/**
 * Fecha um bloco (acordeão) acompanhando o scroll em tempo real — a altura
 * vai de "auto" (medida via ResizeObserver, pra continuar certa se o
 * conteúdo mudar) até 0 conforme o scroll avança até `closeRange`, e volta
 * a abrir do mesmo jeito ao rolar de volta pro topo.
 *
 * `wrapper`/`content` também vêm de `useAnchorNode` — não de `useRef` puro
 * — para reagir corretamente quando a tela troca de "carregando" pro
 * conteúdo real (ver o comentário grande lá em cima).
 *
 * Só funciona sem "fantasma"/travamento se o ancestral que rola tiver
 * `overflow-anchor: none` — sem isso, o navegador tenta compensar
 * sozinho a posição de scroll toda vez que esse bloco muda de altura
 * (scroll anchoring), brigando com a própria lógica daqui.
 */
export function useAccordionScrollClose(
  scrollAnchor: HTMLElement | null,
  {
    closeRange = 130,
    chevronRef,
  }: { closeRange?: number; chevronRef?: { current: HTMLElement | null } } = {},
) {
  const [wrapper, wrapperRef] = useAnchorNode<HTMLDivElement>();
  const [content, contentRef] = useAnchorNode<HTMLDivElement>();

  useEffect(() => {
    if (!scrollAnchor || !wrapper || !content) return;
    const scrollEl = findScrollAncestor(scrollAnchor);
    const getY = () => (scrollEl === window ? window.scrollY : (scrollEl as HTMLElement).scrollTop);

    let ticking = false;
    const update = () => {
      ticking = false;
      const y = getY();
      const p = Math.max(0, Math.min(1, y / closeRange));
      // Mede a altura natural fresca a cada chamada, em vez de guardar num
      // cache que só era atualizado quando o ResizeObserver disparava —
      // sobrava sempre uma frestinha (a 2ª fileira de stats cortada) quando
      // esse cache ficava um pixel desatualizado. `content` nunca tem altura
      // própria fixada, só o `wrapper`, então isso não custa um reflow extra
      // além do que já existe.
      const naturalHeight = content.scrollHeight;
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

    const ro = new ResizeObserver(update);
    ro.observe(content);

    update();
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      ro.disconnect();
      scrollEl.removeEventListener("scroll", onScroll);
    };
  }, [scrollAnchor, wrapper, content, closeRange, chevronRef]);

  return { wrapperRef, contentRef };
}
