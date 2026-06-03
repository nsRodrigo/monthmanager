import { useSyncExternalStore } from "react";

/**
 * Undo/redo session-scoped history (Google-Sheets-style).
 *
 * Cada entrada armazena dois closures: `undo` reverte a ação, `redo` re-aplica.
 * As funções são puro JS — chamam supabase e React Query diretamente, então
 * funcionam fora do ciclo de renderização do React.
 *
 * Regra clássica do Ctrl+Z: ao registrar uma nova ação, a redoStack é limpa.
 */
export type HistoryEntry = {
  label: string;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
};

type Snapshot = {
  canUndo: boolean;
  canRedo: boolean;
  nextUndoLabel: string | null;
  nextRedoLabel: string | null;
  busy: boolean;
};

const MAX = 50;

class HistoryStore {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private listeners = new Set<() => void>();
  private busy = false;
  private snap: Snapshot = this.compute();

  private compute(): Snapshot {
    return {
      canUndo: this.undoStack.length > 0 && !this.busy,
      canRedo: this.redoStack.length > 0 && !this.busy,
      nextUndoLabel: this.undoStack[this.undoStack.length - 1]?.label ?? null,
      nextRedoLabel: this.redoStack[this.redoStack.length - 1]?.label ?? null,
      busy: this.busy,
    };
  }

  private emit() {
    this.snap = this.compute();
    this.listeners.forEach((l) => l());
  }

  push = (entry: HistoryEntry) => {
    this.undoStack.push(entry);
    if (this.undoStack.length > MAX) this.undoStack.shift();
    this.redoStack = [];
    this.emit();
  };

  undo = async () => {
    if (this.busy) return;
    const entry = this.undoStack.pop();
    if (!entry) return;
    this.busy = true;
    this.emit();
    try {
      await entry.undo();
      this.redoStack.push(entry);
    } catch (err) {
      // Falhou: devolve à pilha para o usuário tentar de novo.
      this.undoStack.push(entry);
      console.error("[history] undo failed:", err);
    } finally {
      this.busy = false;
      this.emit();
    }
  };

  redo = async () => {
    if (this.busy) return;
    const entry = this.redoStack.pop();
    if (!entry) return;
    this.busy = true;
    this.emit();
    try {
      await entry.redo();
      this.undoStack.push(entry);
    } catch (err) {
      this.redoStack.push(entry);
      console.error("[history] redo failed:", err);
    } finally {
      this.busy = false;
      this.emit();
    }
  };

  clear = () => {
    this.undoStack = [];
    this.redoStack = [];
    this.emit();
  };

  subscribe = (cb: () => void) => {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  };

  getSnapshot = () => this.snap;
}

export const history = new HistoryStore();

export function useHistory(): Snapshot & {
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  clear: () => void;
} {
  const snap = useSyncExternalStore(history.subscribe, history.getSnapshot, history.getSnapshot);
  return {
    ...snap,
    undo: history.undo,
    redo: history.redo,
    clear: history.clear,
  };
}
