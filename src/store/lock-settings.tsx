import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type LockTimeoutOption = "instant" | "1min" | "5min" | "15min" | "30min";

/**
 * Cada preset controla dois timers do `BiometricLock`:
 *  - `backgroundMs`: quanto tempo o app pode ficar em segundo plano antes de
 *    exigir biometria de novo ao voltar.
 *  - `idleMs`: quanto tempo sem nenhuma interação (app aberto e visível)
 *    antes de bloquear sozinho.
 * `idleMs` sempre fica um pouco acima de `backgroundMs` — não faz sentido
 * bloquear por inatividade mais rápido do que bloquearia só por sair de vista.
 */
export const LOCK_TIMEOUT_PRESETS: Record<
  LockTimeoutOption,
  { label: string; backgroundMs: number; idleMs: number }
> = {
  instant: { label: "Imediato", backgroundMs: 0, idleMs: 2 * 60_000 },
  "1min": { label: "1 minuto", backgroundMs: 60_000, idleMs: 5 * 60_000 },
  "5min": { label: "5 minutos (padrão)", backgroundMs: 5 * 60_000, idleMs: 10 * 60_000 },
  "15min": { label: "15 minutos", backgroundMs: 15 * 60_000, idleMs: 20 * 60_000 },
  "30min": { label: "30 minutos", backgroundMs: 30 * 60_000, idleMs: 45 * 60_000 },
};

const STORAGE_KEY = "gf:lock-timeout";
const DEFAULT_OPTION: LockTimeoutOption = "5min";

function readInitial(): LockTimeoutOption {
  if (typeof window === "undefined") return DEFAULT_OPTION;
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved && saved in LOCK_TIMEOUT_PRESETS ? (saved as LockTimeoutOption) : DEFAULT_OPTION;
}

type Ctx = {
  option: LockTimeoutOption;
  setOption: (o: LockTimeoutOption) => void;
  backgroundMs: number;
  idleMs: number;
};
const LockSettingsCtx = createContext<Ctx | null>(null);

export function LockSettingsProvider({ children }: { children: ReactNode }) {
  const [option, setOptionState] = useState<LockTimeoutOption>(DEFAULT_OPTION);

  useEffect(() => {
    setOptionState(readInitial());
  }, []);

  const setOption = (o: LockTimeoutOption) => {
    setOptionState(o);
    try {
      window.localStorage.setItem(STORAGE_KEY, o);
    } catch {
      /* ignore */
    }
  };

  const preset = LOCK_TIMEOUT_PRESETS[option];
  return (
    <LockSettingsCtx.Provider
      value={{ option, setOption, backgroundMs: preset.backgroundMs, idleMs: preset.idleMs }}
    >
      {children}
    </LockSettingsCtx.Provider>
  );
}

export function useLockSettings() {
  const c = useContext(LockSettingsCtx);
  if (!c) throw new Error("useLockSettings must be used inside LockSettingsProvider");
  return c;
}
