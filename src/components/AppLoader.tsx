import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";

/**
 * Tela de abertura do app — aparece por um instante no primeiro carregamento
 * (PWA cold start) e some com fade. Puramente decorativa, sem lógica de
 * negócio; respeita `prefers-reduced-motion` via a regra global em
 * styles.css que zera a duração de todas as transições/animações.
 */
export function AppLoader() {
  const [visible, setVisible] = useState(true);
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setVisible(false), 900);
    const unmountTimer = setTimeout(() => setMounted(false), 1200);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(unmountTimer);
    };
  }, []);

  if (!mounted) return null;

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center gap-3 bg-gradient-band transition-opacity duration-300 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <div className="animate-splash-icon-in">
        <Logo size="lg" />
      </div>
      <span className="animate-splash-text-in text-lg font-extrabold tracking-tight text-white">
        Gestão Financeira
      </span>
    </div>
  );
}
