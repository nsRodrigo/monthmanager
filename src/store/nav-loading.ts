import { useSyncExternalStore } from "react";

/**
 * Sinaliza "navegação em andamento" pro app inteiro — usado por
 * `NavigationLoader` pra mostrar um overlay durante trocas de tela.
 *
 * Por que não basta observar o estado do próprio TanStack Router
 * (`router.isLoading`/`isTransitioning`): rotas sem `loader` "terminam" a
 * navegação quase instantaneamente aos olhos do router — o travamento real
 * acontece DEPOIS, durante o primeiro render da tela nova (ex.: a tela de
 * conta recalcula todo o histórico financeiro de forma síncrona). Esse
 * travamento fica fora da janela que o router expõe. `router.load` (não
 * `router.navigate` — ver comentário em `src/router.tsx` sobre por quê) é
 * envolvido em `src/router.tsx` pra chamar `begin()`/`end()` ao redor de
 * TODA troca de tela: cliques em `Link`, `navigate()` programático, e
 * também voltar/avançar do navegador — todos disparam `load()` por baixo.
 * Inclui uma folga de alguns frames antes/depois pra garantir que o
 * overlay pinta antes do travamento e continua visível até a tela nova
 * realmente aparecer.
 */
class NavLoadingStore {
  private count = 0;
  private listeners = new Set<() => void>();
  private snap = false;

  private emit() {
    const next = this.count > 0;
    if (next === this.snap) return;
    this.snap = next;
    this.listeners.forEach((l) => l());
  }

  begin = () => {
    this.count += 1;
    this.emit();
  };

  end = () => {
    this.count = Math.max(0, this.count - 1);
    this.emit();
  };

  subscribe = (cb: () => void) => {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  };

  getSnapshot = () => this.snap;
}

export const navLoading = new NavLoadingStore();

export function useNavLoading(): boolean {
  return useSyncExternalStore(navLoading.subscribe, navLoading.getSnapshot, navLoading.getSnapshot);
}

/** Resolve depois que o browser efetivamente PINTOU o frame atual — um único
 * `requestAnimationFrame` dispara ANTES do paint, então não garante nada
 * sozinho; o clássico "double rAF" garante que o paint do primeiro frame já
 * aconteceu antes de continuar. Também usado em `src/router.tsx` (import
 * daqui, não uma cópia — mas lá só é CHAMADO no cliente, com guard
 * `typeof window`, já que aquele arquivo roda no servidor também). */
export function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/**
 * Mesma ideia do embrulho de `router.load` em `src/router.tsx`, só que pra
 * transições que deliberadamente NÃO passam pelo router — ex.: trocar de
 * "view" dentro de um painel de conta (Meses ↔ Lançamentos), que é estado
 * local (`PaneView` em `src/store/panes.tsx`) pra parecer instantâneo como
 * abas, sem mudar a URL. Nesses casos o overlay não aparece sozinho porque
 * não existe navegação nenhuma pro router observar — chame isso manualmente
 * ao redor da troca de estado.
 */
export async function withNavLoading(fn: () => void): Promise<void> {
  navLoading.begin();
  await nextPaint();
  try {
    fn();
  } finally {
    await nextPaint();
    navLoading.end();
  }
}
