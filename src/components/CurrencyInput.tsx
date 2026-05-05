import { useEffect, useRef, useState } from "react";
import { inputClass } from "./Modal";

/**
 * Masked BRL currency input.
 * - Display: "R$ 1.234,56"
 * - Stores numeric value (e.g. 1234.56) via onValueChange.
 * - Progressive typing: digits build the value from cents up.
 */
export function CurrencyInput({
  value,
  onValueChange,
  placeholder = "R$ 0,00",
  className,
  autoFocus,
}: {
  /** Numeric value (e.g. 1234.56). Use undefined or NaN for empty. */
  value: number | undefined | null;
  onValueChange: (n: number) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState<string>("");
  const lastEmitted = useRef<number | undefined>(undefined);

  // Keep displayed text in sync when value changes from outside.
  useEffect(() => {
    if (value === undefined || value === null || Number.isNaN(value)) {
      setText("");
      lastEmitted.current = undefined;
      return;
    }
    if (lastEmitted.current === value) return; // avoid resetting while typing
    setText(formatBRL(value));
    lastEmitted.current = value;
  }, [value]);

  return (
    <input
      type="text"
      inputMode="decimal"
      autoFocus={autoFocus}
      className={className ?? inputClass}
      placeholder={placeholder}
      value={text}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "");
        if (!digits) {
          setText("");
          lastEmitted.current = 0;
          onValueChange(0);
          return;
        }
        const cents = parseInt(digits, 10);
        const num = cents / 100;
        const formatted = formatBRL(num);
        setText(formatted);
        lastEmitted.current = num;
        onValueChange(num);
      }}
    />
  );
}

export function formatBRL(n: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}
