import { useSyncExternalStore } from "react";
import { useAuth } from "./auth";

/**
 * "Qual conta estou vendo": normalmente a própria (`null`), ou a de outra
 * pessoa depois de uma concessão de acesso aprovada (ver
 * `src/store/account-access.ts`). Persistido em localStorage pra
 * sobreviver a um reload — `AccountSwitcher`/`AdminViewingBanner` validam
 * contra os grants ativos e limpam sozinhos se o acesso foi revogado.
 */
export type ViewingAs = { userId: string; email: string; name: string } | null;

const STORAGE_KEY = "account-view:viewing-as";

class AccountViewStore {
  private value: ViewingAs = null;
  private loaded = false;
  private listeners = new Set<() => void>();

  private ensureLoaded() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      this.value = raw ? (JSON.parse(raw) as ViewingAs) : null;
    } catch {
      this.value = null;
    }
  }

  set = (next: ViewingAs) => {
    this.value = next;
    try {
      if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // localStorage indisponível (modo privado etc.) — segue só em memória.
    }
    this.listeners.forEach((l) => l());
  };

  subscribe = (cb: () => void) => {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  };

  getSnapshot = () => {
    this.ensureLoaded();
    return this.value;
  };

  getServerSnapshot = () => null;
}

export const accountView = new AccountViewStore();

export function useViewingAs(): [ViewingAs, (v: ViewingAs) => void] {
  const value = useSyncExternalStore(
    accountView.subscribe,
    accountView.getSnapshot,
    accountView.getServerSnapshot,
  );
  return [value, accountView.set];
}

/**
 * Id de usuário a usar em toda leitura/gravação de dado financeiro — a
 * própria conta, ou a que está sendo vista via concessão de acesso.
 * NUNCA usar isto pra checagem de papel/permissão (`useIsAdmin` etc.):
 * admin é sempre da pessoa autenticada de verdade, não da conta que ela
 * está vendo.
 */
export function useActiveUserId(): string | undefined {
  const { user } = useAuth();
  const [viewingAs] = useViewingAs();
  return viewingAs?.userId ?? user?.id;
}
