import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

/**
 * Overlay sutil que aparece quando uma navegação demora mais que 150ms.
 * Mostra um fundo fosco com spinner centralizado até a próxima tela renderizar.
 */
export function NavigationLoader() {
  const isLoading = useRouterState({
    select: (s) => s.isLoading || s.isTransitioning,
  });
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setShow(false);
      return;
    }
    const t = setTimeout(() => setShow(true), 150);
    return () => clearTimeout(t);
  }, [isLoading]);

  if (!show) return null;
  return (
    <div
      className="pointer-events-auto fixed inset-0 z-[200] flex items-center justify-center bg-background/60 backdrop-blur-sm"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-card/90 shadow-lg ring-1 ring-border">
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
      </div>
    </div>
  );
}
