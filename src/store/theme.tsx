import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/** "dark" = Esmeralda Noite (padrão). "indigo" e "grafite" são outras paletas escuras. */
export type Theme = "dark" | "indigo" | "grafite" | "light" | "high-contrast";

const THEMES: Theme[] = ["dark", "indigo", "grafite", "light", "high-contrast"];
const THEME_COLOR: Record<Theme, string> = {
  dark: "#0a0f0e",
  indigo: "#0b0d14",
  grafite: "#0d0d0c",
  light: "#fafafa",
  "high-contrast": "#000000",
};

const STORAGE_KEY = "gf:theme";

type Ctx = { theme: Theme; setTheme: (t: Theme) => void };
const ThemeCtx = createContext<Ctx | null>(null);

function applyTheme(t: Theme) {
  const root = document.documentElement;
  root.classList.remove("dark", "theme-indigo", "theme-grafite", "theme-light", "theme-high-contrast");
  // As paletas escuras mantêm a classe `dark` (variantes dark: continuam valendo).
  if (t === "dark" || t === "indigo" || t === "grafite") root.classList.add("dark");
  if (t === "indigo") root.classList.add("theme-indigo");
  else if (t === "grafite") root.classList.add("theme-grafite");
  else if (t === "light") root.classList.add("theme-light");
  else if (t === "high-contrast") root.classList.add("theme-high-contrast");
  // Atualiza meta theme-color para a status bar do mobile
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_COLOR[t]);
}

function readInitial(): Theme {
  if (typeof window === "undefined") return "dark";
  const saved = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
  if (saved && THEMES.includes(saved)) return saved;
  return "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const t = readInitial();
    setThemeState(t);
    applyTheme(t);
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    applyTheme(t);
    try {
      window.localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
  };

  return <ThemeCtx.Provider value={{ theme, setTheme }}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const c = useContext(ThemeCtx);
  if (!c) throw new Error("useTheme must be used inside ThemeProvider");
  return c;
}
