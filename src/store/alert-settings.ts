import { useEffect, useState } from "react";

export type AlertPosition = "top-center" | "bottom-center";
export type AlertDuration = 2000 | 3200 | 5000 | 0; // 0 = fica até fechar manualmente

type AlertSettings = { position: AlertPosition; duration: AlertDuration };

const KEY = "monthmanager:alerts";
const EVENT = "monthmanager:alerts-change";
const DEFAULT: AlertSettings = { position: "top-center", duration: 3200 };

function read(): AlertSettings {
  try {
    if (typeof window === "undefined") return DEFAULT;
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw);
    return {
      position: parsed.position === "bottom-center" ? "bottom-center" : "top-center",
      duration: [0, 2000, 3200, 5000].includes(parsed.duration)
        ? parsed.duration
        : DEFAULT.duration,
    };
  } catch {
    return DEFAULT;
  }
}

function write(next: AlertSettings) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* ignore */
  }
}

/**
 * Preferência global de duração/posição dos alertas (toasts) — configurada
 * em Notificações. O `<Toaster/>` fica montado uma vez na raiz do app e
 * nunca desmonta ao navegar, então o evento `EVENT` é o jeito dele reagir
 * quando essa tela (que desmonta a cada navegação) grava uma mudança.
 */
export function useAlertSettings() {
  const [state, setState] = useState<AlertSettings>(() => read());

  useEffect(() => {
    const onChange = () => setState(read());
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);

  const setPosition = (position: AlertPosition) => {
    setState((prev) => {
      const next = { ...prev, position };
      write(next);
      return next;
    });
  };
  const setDuration = (duration: AlertDuration) => {
    setState((prev) => {
      const next = { ...prev, duration };
      write(next);
      return next;
    });
  };

  return { ...state, setPosition, setDuration };
}
