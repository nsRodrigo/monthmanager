import { useSyncExternalStore } from "react";

/**
 * Estado global da calculadora avulsa (a que abre pelo "+ Novo"/FAB/Mais,
 * sem campo alvo — diferente da calculadora por campo em CurrencyInput, que
 * continua local a cada input). Um único <FloatingCalculator> é montado uma
 * vez em `AuthGate` (src/routes/__root.tsx), fora da árvore de rotas, então
 * abrir aqui e navegar pra outra tela não fecha mais a calculadora.
 */
let open = false;
const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}

export function openFloatingCalculator() {
  open = true;
  emit();
}

export function closeFloatingCalculator() {
  open = false;
  emit();
}

export function useFloatingCalculatorOpen(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => open,
    () => false,
  );
}
