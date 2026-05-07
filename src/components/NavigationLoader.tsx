import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

/**
 * Mostra um overlay sutil quando uma navegação demora mais que 150ms.
 * Evita flash em transições instantâneas.
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
      className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-0.5 overflow-hidden bg-transparent"
      aria-hidden="true"
    >
      <div className="h-full w-full origin-left animate-[nav-bar_1.2s_ease-in-out_infinite] bg-gradient-to-r from-primary via-primary/80 to-primary" />
      <style>{`@keyframes nav-bar { 0% { transform: scaleX(0); } 50% { transform: scaleX(0.7); } 100% { transform: scaleX(1); } }`}</style>
    </div>
  );
}
