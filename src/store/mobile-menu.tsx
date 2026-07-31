import { createContext, useContext, type ReactNode } from "react";

/**
 * Ponte pra qualquer tela poder abrir a gaveta mobile — o estado
 * (`mobileOpen`) vive em `AuthGate` (__root.tsx), que é quem realmente
 * desenha a gaveta; este contexto só expõe a função de abrir pra quem
 * estiver dentro dele (todas as rotas, via `<Outlet/>`).
 */
type MobileMenuContextValue = {
  openMobileMenu: () => void;
};

const Ctx = createContext<MobileMenuContextValue | null>(null);

export function MobileMenuProvider({
  openMobileMenu,
  children,
}: {
  openMobileMenu: () => void;
  children: ReactNode;
}) {
  return <Ctx.Provider value={{ openMobileMenu }}>{children}</Ctx.Provider>;
}

export function useMobileMenu() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useMobileMenu must be inside MobileMenuProvider");
  return c;
}
