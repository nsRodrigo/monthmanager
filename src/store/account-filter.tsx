import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * Global "selected account" filter.
 * - `null` means "all accounts" (consolidated view)
 * - persisted to localStorage so the user keeps the same filter across reloads
 */
type Ctx = {
  accountId: string | null;
  setAccountId: (id: string | null) => void;
};

const AccountFilterCtx = createContext<Ctx | null>(null);

const KEY = "fin:selectedAccount";

export function AccountFilterProvider({ children }: { children: ReactNode }) {
  const [accountId, setAccountIdState] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(KEY);
    if (stored && stored !== "all") setAccountIdState(stored);
  }, []);

  const setAccountId = (id: string | null) => {
    setAccountIdState(id);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(KEY, id ?? "all");
    }
  };

  return (
    <AccountFilterCtx.Provider value={{ accountId, setAccountId }}>
      {children}
    </AccountFilterCtx.Provider>
  );
}

export function useAccountFilter() {
  const c = useContext(AccountFilterCtx);
  if (!c) throw new Error("useAccountFilter must be inside AccountFilterProvider");
  return c;
}
