import { useSyncExternalStore } from "react";

/**
 * Registro do último campo "Valor" (CurrencyInput) que recebeu foco — usado
 * pela calculadora avulsa (aberta pelo FAB, sem alvo fixo) pra saber se e
 * onde aplicar "Usar este valor". Um token por instância de campo evita que
 * o blur/desmonte de um campo antigo apague o campo que está ativo agora.
 */
type Setter = (n: number) => void;

let currentToken: symbol | null = null;
let currentSetter: Setter | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function setActiveValueField(token: symbol, setter: Setter) {
  currentToken = token;
  currentSetter = setter;
  emit();
}

export function clearActiveValueField(token: symbol) {
  if (currentToken === token) {
    currentToken = null;
    currentSetter = null;
    emit();
  }
}

/** Consome e limpa o campo ativo — usado ao clicar em "Usar este valor". */
export function consumeActiveValueField(): Setter | null {
  const setter = currentSetter;
  currentToken = null;
  currentSetter = null;
  emit();
  return setter;
}

export function useHasActiveValueField(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => currentSetter !== null,
    () => false,
  );
}
