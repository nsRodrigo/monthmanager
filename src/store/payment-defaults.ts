import { useState } from "react";

export type DefaultPaymentType = "unico" | "parcelado" | "recorrente";

const METHOD_KEY = "monthmanager:default-payment-method";
const TYPE_KEY = "monthmanager:default-payment-type";

function readMethod(): string | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(METHOD_KEY);
  } catch {
    return null;
  }
}

function readType(): DefaultPaymentType {
  try {
    if (typeof window === "undefined") return "unico";
    const v = window.localStorage.getItem(TYPE_KEY);
    return v === "parcelado" || v === "recorrente" ? v : "unico";
  } catch {
    return "unico";
  }
}

/**
 * Meio e tipo de pagamento que vêm pré-selecionados ao abrir "Novo
 * lançamento" — configurados em Meios de pagamento. `methodKey` guarda o
 * `value` de um meio fixo (ver PAYMENT_METHOD_OPTIONS em finance.ts) ou o
 * `id` de um meio personalizado; `null` = nenhum (comportamento de sempre).
 */
export function usePaymentDefaults() {
  const [methodKey, setMethodKeyState] = useState<string | null>(() => readMethod());
  const [type, setTypeState] = useState<DefaultPaymentType>(() => readType());

  const setMethodKey = (key: string | null) => {
    setMethodKeyState(key);
    try {
      if (key) window.localStorage.setItem(METHOD_KEY, key);
      else window.localStorage.removeItem(METHOD_KEY);
    } catch {
      /* ignore */
    }
  };
  const setType = (t: DefaultPaymentType) => {
    setTypeState(t);
    try {
      window.localStorage.setItem(TYPE_KEY, t);
    } catch {
      /* ignore */
    }
  };

  return { methodKey, setMethodKey, type, setType };
}
