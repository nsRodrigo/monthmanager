import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type PaneView = { type: "months" } | { type: "month"; year: number; month: number };
export type PaneEntry = { contaId: string; view: PaneView; size: number };

const STORAGE_KEY = "panes-workspace-v2";

type Persisted = { panes: PaneEntry[]; activeIds: string[] };

const EMPTY: Persisted = { panes: [], activeIds: [] };

function loadInitial(): Persisted {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    return {
      panes: Array.isArray(parsed?.panes) ? parsed.panes : [],
      activeIds: Array.isArray(parsed?.activeIds) ? parsed.activeIds : [],
    };
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

function findOrCreate(panes: PaneEntry[], contaId: string): PaneEntry[] {
  if (panes.some((p) => p.contaId === contaId)) return panes;
  return [...panes, { contaId, view: { type: "months" }, size: 1 }];
}

type PanesContextValue = {
  /** Todas as contas com painel lembrado — inclui as que não estão visíveis agora ("em segundo plano"). */
  panes: PaneEntry[];
  /** Quais dessas estão realmente lado a lado na tela agora, em ordem. */
  activeIds: string[];
  /** Abre só esta conta (as demais somem da tela, mas continuam lembradas no mês em que estavam). */
  openSingle: (contaId: string) => void;
  /** Adiciona esta conta ao lado das que já estão visíveis (split). */
  splitIn: (contaId: string) => void;
  /** Fecha de vez este painel — some da tela e do que é lembrado. */
  closePane: (contaId: string) => void;
  /** Atualiza o mês/visão de um painel lembrado. */
  setView: (contaId: string, view: PaneView) => void;
  /** Redistribui o espaço entre dois painéis visíveis adjacentes. */
  resizeAt: (index: number, deltaFraction: number) => void;
  /** Recorta a lista de visíveis pro limite de painéis do breakpoint atual. */
  capActive: (max: number) => void;
};

const Ctx = createContext<PanesContextValue | null>(null);

/**
 * Estado compartilhado dos painéis de conta — vive na raiz do app (nunca
 * desmonta ao navegar) e é persistido em sessionStorage. `panes` é a
 * memória de fundo (toda conta que já teve painel aberto nesta sessão);
 * `activeIds` é só quem está realmente lado a lado na tela agora. Navegar
 * normalmente pra uma conta sempre reabre SÓ ela (`openSingle`); Ctrl+clique
 * numa conta, ou clicar num item "em segundo plano" enquanto já se está
 * dentro de /contas/*, divide a tela (`splitIn`).
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
      setState((prev) => ({ panes: findOrCreate(prev.panes, contaId), activeIds: [contaId] }));
    },
    [setState],
  );

  const splitIn = useCallback(
    (contaId: string) => {
      setState((prev) =>
        prev.activeIds.includes(contaId)
          ? prev
          : { panes: findOrCreate(prev.panes, contaId), activeIds: [...prev.activeIds, contaId] },
      );
    },
    [setState],
  );

  const closePane = useCallback(
    (contaId: string) => {
      setState((prev) =>
        prev.activeIds.length <= 1
          ? prev
          : {
              panes: prev.panes.filter((p) => p.contaId !== contaId),
              activeIds: prev.activeIds.filter((id) => id !== contaId),
            },
      );
    },
    [setState],
  );

  const setView = useCallback(
    (contaId: string, view: PaneView) => {
      setState((prev) => ({ ...prev, panes: prev.panes.map((p) => (p.contaId === contaId ? { ...p, view } : p)) }));
    },
    [setState],
  );

  const resizeAt = useCallback(
    (index: number, deltaFraction: number) => {
      setState((prev) => {
        const ids = prev.activeIds;
        const entries = ids.map((id) => prev.panes.find((p) => p.contaId === id)).filter((p): p is PaneEntry => !!p);
        if (!entries[index] || !entries[index + 1]) return prev;
        const total = entries.reduce((s, p) => s + p.size, 0);
        const a = entries[index].size + deltaFraction * total;
        const b = entries[index + 1].size - deltaFraction * total;
        const min = total * 0.18;
        if (a < min || b < min) return prev;
        const panes = prev.panes.map((p) => {
          if (p.contaId === ids[index]) return { ...p, size: a };
          if (p.contaId === ids[index + 1]) return { ...p, size: b };
          return p;
        });
        return { ...prev, panes };
      });
    },
    [setState],
  );

  const capActive = useCallback(
    (max: number) => {
      setState((prev) => (prev.activeIds.length > max ? { ...prev, activeIds: prev.activeIds.slice(0, max) } : prev));
    },
    [setState],
  );

  return (
    <Ctx.Provider
      value={{
        panes: state.panes,
        activeIds: state.activeIds,
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
