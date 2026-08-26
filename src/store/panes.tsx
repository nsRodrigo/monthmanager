import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type PaneView = { type: "months" } | { type: "month"; year: number; month: number };
export type PaneEntry = { contaId: string; view: PaneView; size: number };

const STORAGE_KEY = "panes-workspace-v3";

type Persisted = { panes: PaneEntry[] };

const EMPTY: Persisted = { panes: [] };

function loadInitial(): Persisted {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    return { panes: Array.isArray(parsed?.panes) ? parsed.panes : [] };
  } catch {
    return EMPTY;
  }
}

function persist(state: Persisted) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // sessionStorage indisponível (ex.: modo privado) — a sessão simplesmente não é lembrada.
  }
}

type PanesContextValue = {
  /** Contas com painel na tela AGORA, em ordem — não existe mais "em segundo plano": ao
   * sair da tela (substituída ou fechada), a conta soma do estado por completo, como uma
   * aba de navegador que foi fechada. */
  panes: PaneEntry[];
  /** Abre só esta conta — fecha (descarta) as demais que estavam visíveis. */
  openSingle: (contaId: string) => void;
  /** Adiciona esta conta ao lado das que já estão visíveis (split). */
  splitIn: (contaId: string) => void;
  /** Fecha de vez este painel — some da tela e da lista de abas. */
  closePane: (contaId: string) => void;
  /** Atualiza o mês/visão de um painel visível. */
  setView: (contaId: string, view: PaneView) => void;
  /** Redistribui o espaço entre dois painéis visíveis adjacentes. */
  resizeAt: (index: number, deltaFraction: number) => void;
  /** Recorta a lista de visíveis pro limite de painéis do breakpoint atual. */
  capActive: (max: number) => void;
};

const Ctx = createContext<PanesContextValue | null>(null);

/**
 * Estado compartilhado dos painéis de conta — vive na raiz do app (nunca
 * desmonta ao navegar) e é persistido em sessionStorage. `panes` é
 * literalmente o que está visível na tela agora — funciona como abas de
 * navegador: clicar numa conta sem Ctrl fecha as demais e abre só ela;
 * Ctrl/Cmd+clique abre ao lado das que já estão visíveis; fechar pelo X
 * remove de vez (não fica lembrada em nenhuma lista pra reabrir depois).
 */
export function PanesRegistryProvider({ children }: { children: ReactNode }) {
  const [state, setStateRaw] = useState<Persisted>(loadInitial);

  const setState = useCallback((updater: Persisted | ((prev: Persisted) => Persisted)) => {
    setStateRaw((prev) => {
      const next = typeof updater === "function" ? (updater as (p: Persisted) => Persisted)(prev) : updater;
      persist(next);
      return next;
    });
  }, []);

  const openSingle = useCallback(
    (contaId: string) => {
      setState((prev) => {
        const existing = prev.panes.find((p) => p.contaId === contaId);
        return { panes: [existing ?? { contaId, view: { type: "months" }, size: 1 }] };
      });
    },
    [setState],
  );

  const splitIn = useCallback(
    (contaId: string) => {
      setState((prev) =>
        prev.panes.some((p) => p.contaId === contaId)
          ? prev
          : { panes: [...prev.panes, { contaId, view: { type: "months" }, size: 1 }] },
      );
    },
    [setState],
  );

  const closePane = useCallback(
    (contaId: string) => {
      setState((prev) =>
        prev.panes.length <= 1 ? prev : { panes: prev.panes.filter((p) => p.contaId !== contaId) },
      );
    },
    [setState],
  );

  const setView = useCallback(
    (contaId: string, view: PaneView) => {
      setState((prev) => ({ panes: prev.panes.map((p) => (p.contaId === contaId ? { ...p, view } : p)) }));
    },
    [setState],
  );

  const resizeAt = useCallback(
    (index: number, deltaFraction: number) => {
      setState((prev) => {
        const entries = prev.panes;
        if (!entries[index] || !entries[index + 1]) return prev;
        const total = entries.reduce((s, p) => s + p.size, 0);
        const a = entries[index].size + deltaFraction * total;
        const b = entries[index + 1].size - deltaFraction * total;
        const min = total * 0.18;
        if (a < min || b < min) return prev;
        const panes = entries.map((p, i) => {
          if (i === index) return { ...p, size: a };
          if (i === index + 1) return { ...p, size: b };
          return p;
        });
        return { panes };
      });
    },
    [setState],
  );

  const capActive = useCallback(
    (max: number) => {
      setState((prev) => (prev.panes.length > max ? { panes: prev.panes.slice(0, max) } : prev));
    },
    [setState],
  );

  return (
    <Ctx.Provider
      value={{
        panes: state.panes,
        openSingle,
        splitIn,
        closePane,
        setView,
        resizeAt,
        capActive,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function usePanes() {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePanes must be inside PanesRegistryProvider");
  return c;
}

/** Limite de painéis lado a lado por tamanho de tela — mobile nunca divide. */
export function useMaxPanes() {
  const [maxPanes, setMaxPanes] = useState(3);
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      setMaxPanes(w < 768 ? 1 : w >= 1280 ? 3 : 2);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return maxPanes;
}
