import { useEffect, useRef, useState } from "react";
import { inputClass } from "./Modal";

/**
 * Masked BRL currency input.
 * - Display: "R$ 1.234,56" (or "-R$ 1.234,56" when negative)
 * - Stores numeric value (e.g. 1234.56) via onValueChange.
 * - Progressive typing: digits build the value from cents up.
 * - When `allowNegative` is true:
 *    • Typing "-" anywhere preserves a negative sign.
 *    • A "±" toggle button appears inside the input to flip the sign.
 *    • Useful for refunds / ajustes negativos.
 */
export function CurrencyInput({
  value,
  onValueChange,
  placeholder = "R$ 0,00",
  className,
  autoFocus,
  allowNegative = false,
}: {
  value: number | undefined | null;
  onValueChange: (n: number) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  allowNegative?: boolean;
}) {
  const [text, setText] = useState<string>("");
  const lastEmitted = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (value === undefined || value === null || Number.isNaN(value)) {
      setText("");
      lastEmitted.current = undefined;
      return;
    }
    if (lastEmitted.current === value) return;
    setText(formatBRL(value));
    lastEmitted.current = value;
  }, [value]);

  const toggleSign = () => {
    const cur = value ?? 0;
    const next = -cur;
    setText(next === 0 ? "" : formatBRL(next));
    lastEmitted.current = next;
    onValueChange(next);
  };

  return (
    <div className="relative">
      {allowNegative && (
        <button
          type="button"
          onClick={toggleSign}
          aria-label="Alternar sinal"
          title="Alternar sinal (positivo/negativo)"
          className="absolute left-1.5 top-1/2 z-10 -translate-y-1/2 rounded-md border border-border bg-secondary px-1.5 py-0.5 text-[11px] font-bold text-foreground hover:bg-secondary/80"
        >
          ±
        </button>
      )}
      <input
        type="text"
        inputMode="decimal"
        autoFocus={autoFocus}
        className={`${className ?? inputClass} ${allowNegative ? "pl-10" : ""}`}
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          const raw = e.target.value;
          const isNeg = allowNegative && /-/.test(raw);
          const digits = raw.replace(/\D/g, "");
          if (!digits) {
            setText(isNeg ? "-" : "");
            lastEmitted.current = 0;
            onValueChange(0);
            return;
          }
          const cents = parseInt(digits, 10);
          const num = (cents / 100) * (isNeg ? -1 : 1);
          setText(formatBRL(num));
          lastEmitted.current = num;
          onValueChange(num);
        }}
      />
    </div>
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
