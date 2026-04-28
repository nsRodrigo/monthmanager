import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "dark" | "light" | "high-contrast";

const STORAGE_KEY = "gf:theme";

type Ctx = { theme: Theme; setTheme: (t: Theme) => void };
const ThemeCtx = createContext<Ctx | null>(null);

function applyTheme(t: Theme) {
  const root = document.documentElement;
  root.classList.remove("dark", "theme-light", "theme-high-contrast");
  if (t === "dark") root.classList.add("dark");
  else if (t === "light") root.classList.add("theme-light");
  else root.classList.add("theme-high-contrast");
  // Atualiza meta theme-color para a status bar do mobile
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const color = t === "light" ? "#fafafa" : t === "high-contrast" ? "#000000" : "#0f172a";
    meta.setAttribute("content", color);
  }
}

function readInitial(): Theme {
  if (typeof window === "undefined") return "dark";
  const saved = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
  if (saved === "dark" || saved === "light" || saved === "high-contrast") return saved;
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
