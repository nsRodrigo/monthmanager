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
 * Fecha um bloco (acordeão) por gesto — a altura vai de "auto" (medida via
 * ResizeObserver, pra continuar certa se o conteúdo mudar) até 0, e volta a
 * abrir do mesmo jeito no gesto contrário.
 *
 * NÃO reage a `scroll` (ver por quê abaixo) — em vez disso CAPTURA o gesto
 * (`wheel`/`touchmove`) enquanto o acordeão não estiver 100% aberto/fechado:
 * o dedo/mouse não rola a página de verdade, só avança um `progress` (0→1)
 * interno. Só quando o acordeão termina de fechar o gesto é liberado pro
 * scroll nativo normal (e vice-versa: rolar pra cima com a página já no
 * topo reabre o acordeão antes de soltar o gesto pro scroll).
 *
 * Por que não dá pra reagir a `scroll` (como as duas versões anteriores
 * faziam): quando este acordeão fica dentro de um bloco `sticky` (o card da
 * Home, com "Suas contas" logo abaixo), encolher o acordeão E rolar a
 * página são dois efeitos que SOMAM o quanto o conteúdo seguinte sobe na
 * tela — nunca cancelam, não importa a distância de fechamento escolhida.
 * Por isso itens abaixo (a lista "Suas contas") sempre acabavam se
 * movendo/cobrindo ANTES do acordeão terminar de fechar. Capturar o gesto
 * em vez de deixar a página rolar de verdade é a única forma de garantir
 * "nada embaixo se mexe até o acordeão fechar".
 *
 * `wrapper`/`content` também vêm de `useAnchorNode` — não de `useRef` puro
 * — para reagir corretamente quando a tela troca de "carregando" pro
 * conteúdo real (ver o comentário grande lá em cima).
 */
export function useAccordionScrollClose(
  scrollAnchor: HTMLElement | null,
  { chevronRef }: { chevronRef?: { current: HTMLElement | null } } = {},
) {
  const [wrapper, wrapperRef] = useAnchorNode<HTMLDivElement>();
  const [content, contentRef] = useAnchorNode<HTMLDivElement>();
  const progressRef = useRef(0);

  useEffect(() => {
    if (!scrollAnchor || !wrapper || !content) return;
    const scrollEl = findScrollAncestor(scrollAnchor);
    const getScrollTop = () => (scrollEl === window ? window.scrollY : (scrollEl as HTMLElement).scrollTop);

    const render = () => {
      const p = progressRef.current;
      if (chevronRef?.current) chevronRef.current.style.transform = `rotate(${p * -180}deg)`;
      // Totalmente aberto: NENHUMA altura fixa via JS — deixa o navegador
      // medir sozinho, removendo a propriedade em vez de fixar um valor
      // calculado (uma altura calculada errada já cortou a borda inferior
      // da última fileira em tentativas anteriores).
      if (p <= 0) {
        wrapper.style.removeProperty("height");
        wrapper.style.opacity = "1";
        return;
      }
      // `content` nunca tem altura própria fixada (só `wrapper` tem), então
      // isso sempre reflete a altura natural de verdade, mesmo com o
      // wrapper já encolhido.
      const naturalHeight = Math.max(1, Math.ceil(content.getBoundingClientRect().height));
      wrapper.style.height = `${naturalHeight * (1 - p)}px`;
      wrapper.style.opacity = String(1 - p);
    };

    // `deltaY` > 0 = gesto "pra baixo" (fechar); < 0 = "pra cima" (reabrir).
    // Retorna `true` quando captura o gesto (chamador deve dar preventDefault).
    const applyDelta = (deltaY: number) => {
      const naturalHeight = Math.max(1, Math.ceil(content.getBoundingClientRect().height));
      const goingDown = deltaY > 0;
      if (goingDown && progressRef.current < 1) {
        progressRef.current = Math.min(1, progressRef.current + deltaY / naturalHeight);
        render();
        return true;
      }
      if (!goingDown && getScrollTop() <= 0 && progressRef.current > 0) {
        progressRef.current = Math.max(0, progressRef.current + deltaY / naturalHeight);
        render();
        return true;
      }
      return false;
    };

    const onWheel = (e: WheelEvent) => {
      if (applyDelta(e.deltaY)) e.preventDefault();
    };

    let touchStartY: number | null = null;
    const onTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (touchStartY == null) return;
      const y = e.touches[0]?.clientY;
      if (y == null) return;
      const deltaY = touchStartY - y;
      if (applyDelta(deltaY)) e.preventDefault();
      touchStartY = y;
    };

    const target: HTMLElement | Window = scrollEl === window ? window : scrollEl;
    target.addEventListener("wheel", onWheel as EventListener, { passive: false });
    target.addEventListener("touchstart", onTouchStart as EventListener, { passive: true });
    target.addEventListener("touchmove", onTouchMove as EventListener, { passive: false });

    const ro = new ResizeObserver(render);
    ro.observe(content);

    render();
    return () => {
      ro.disconnect();
      target.removeEventListener("wheel", onWheel as EventListener);
      target.removeEventListener("touchstart", onTouchStart as EventListener);
      target.removeEventListener("touchmove", onTouchMove as EventListener);
    };
  }, [scrollAnchor, wrapper, content, chevronRef]);

  return { wrapperRef, contentRef };
}
