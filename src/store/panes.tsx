import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

export type PaneView = { type: "months" } | { type: "month"; year: number; month: number };
export type PaneEntry = { contaId: string; view: PaneView; size: number };

const STORAGE_KEY = "panes-workspace-v1";

function loadInitialPanes(): PaneEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(panes: PaneEntry[]) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(panes));
  } catch {
    // sessionStorage indisponível (ex.: modo privado) — a sessão simplesmente não é lembrada.
  }
}

type PanesContextValue = {
  panes: PaneEntry[];
  setPanes: (updater: PaneEntry[] | ((prev: PaneEntry[]) => PaneEntry[])) => void;
  addPane: (contaId: string) => void;
  closePane: (contaId: string) => void;
  setView: (contaId: string, view: PaneView) => void;
};

const Ctx = createContext<PanesContextValue | null>(null);

/**
 * Estado compartilhado dos painéis de conta abertos em /contas/$contaId —
 * vive na raiz do app (nunca desmonta ao navegar) e é persistido em
 * sessionStorage. Assim, ao sair pra uma tela qualquer (Backup, IRPF...) e
 * voltar, os mesmos painéis reabrem no mesmo mês em que cada um estava.
 */
export function PanesRegistryProvider({ children }: { children: ReactNode }) {
  const [panes, setPanesRaw] = useState<PaneEntry[]>(loadInitialPanes);

  const setPanes = useCallback<PanesContextValue["setPanes"]>((updater) => {
    setPanesRaw((prev) => {
      const next = typeof updater === "function" ? (updater as (p: PaneEntry[]) => PaneEntry[])(prev) : updater;
      persist(next);
      return next;
    });
  }, []);

  const addPane = useCallback(
    (contaId: string) => {
      setPanes((prev) =>
        prev.some((p) => p.contaId === contaId)
          ? prev
          : [...prev, { contaId, view: { type: "months" }, size: 1 }],
      );
    },
    [setPanes],
  );

  const closePane = useCallback(
    (contaId: string) => {
      setPanes((prev) => (prev.length <= 1 ? prev : prev.filter((p) => p.contaId !== contaId)));
    },
    [setPanes],
  );

  const setView = useCallback(
    (contaId: string, view: PaneView) => {
      setPanes((prev) => prev.map((p) => (p.contaId === contaId ? { ...p, view } : p)));
    },
    [setPanes],
  );

  return <Ctx.Provider value={{ panes, setPanes, addPane, closePane, setView }}>{children}</Ctx.Provider>;
}

export function usePanes() {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePanes must be inside PanesRegistryProvider");
  return c;
}
