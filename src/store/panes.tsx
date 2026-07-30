import { createContext, useContext, useRef, type ReactNode } from "react";

/**
 * Ponte entre a sidebar (sempre montada em __root.tsx) e o PanesWorkspace
 * (montado só dentro de /contas/$contaId) — permite Ctrl/Cmd+clique numa
 * conta da sidebar abrir um painel novo ao lado, sem precisar do "+" da tira
 * de abas. Quando nenhum PanesWorkspace está montado (ex.: na Home), o
 * clique simplesmente segue a navegação normal do link.
 */
type PanesRegistry = {
  registerAddPane: (fn: ((accountId: string) => void) | null) => void;
  addPaneIfActive: (accountId: string) => boolean;
};

const Ctx = createContext<PanesRegistry | null>(null);

export function PanesRegistryProvider({ children }: { children: ReactNode }) {
  const addPaneRef = useRef<((accountId: string) => void) | null>(null);
  const value: PanesRegistry = {
    registerAddPane: (fn) => {
      addPaneRef.current = fn;
    },
    addPaneIfActive: (accountId) => {
      if (!addPaneRef.current) return false;
      addPaneRef.current(accountId);
      return true;
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePanesRegistry() {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePanesRegistry must be inside PanesRegistryProvider");
  return c;
}
