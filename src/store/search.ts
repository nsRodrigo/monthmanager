import { useSyncExternalStore } from "react";

/** Estado aberto/fechado da busca global (paleta de comandos, Ctrl/Cmd+K). */
let isOpen = false;
const listeners = new Set<() => void>();

function set(v: boolean) {
  if (isOpen === v) return;
  isOpen = v;
  listeners.forEach((l) => l());
}

export const searchPalette = {
  open: () => set(true),
  close: () => set(false),
  toggle: () => set(!isOpen),
  setOpen: set,
};

export function useSearchOpen(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => isOpen,
    () => false,
  );
}
