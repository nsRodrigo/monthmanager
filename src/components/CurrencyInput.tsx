import { useEffect, useRef, useState } from "react";
import { inputClass } from "./Modal";
import { CalculatorModal } from "./CalculatorModal";
import { Calculator as CalculatorIcon } from "lucide-react";

/**
 * Masked BRL currency input.
 * - Display: "R$ 1.234,56" (or "-R$ 1.234,56" when negative)
 * - Stores numeric value (e.g. 1234.56) via onValueChange.
 * - Progressive typing: digits build the value from cents up.
 * - When `allowNegative` is true, typing "-" anywhere preserves a negative
 *   sign — useful for refunds / ajustes negativos.
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

  return (
    <input
      type="text"
      // "decimal" abre o teclado numérico no mobile, mas esse teclado não
      // tem tecla de "-" em nenhuma plataforma — quando o campo aceita
      // negativo, usamos "text" pra garantir acesso ao "-".
      inputMode={allowNegative ? "text" : "decimal"}
      autoFocus={autoFocus}
      className={className ?? inputClass}
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
  );
}

/**
 * `CurrencyInput` + botão de calculadora ao lado — abre a calculadora por
 * cima do modal atual (sem fechá-lo); "Usar este valor" escreve o resultado
 * aqui e volta pro formulário. Usado nos campos "Valor" dos formulários de
 * lançamento; `CurrencyInput` puro continua disponível pra outros contextos
 * (filtros etc.) onde uma calculadora não faz sentido.
 */
export function CurrencyInputWithCalculator(props: {
  value: number | undefined | null;
  onValueChange: (n: number) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  allowNegative?: boolean;
}) {
  const [calcOpen, setCalcOpen] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <CurrencyInput {...props} />
      </div>
      <button
        type="button"
        onClick={() => setCalcOpen(true)}
        title="Abrir calculadora"
        aria-label="Abrir calculadora"
        className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg border border-input bg-input text-primary transition-colors hover:border-primary"
      >
        <CalculatorIcon className="h-[18px] w-[18px]" />
      </button>
      <CalculatorModal open={calcOpen} onClose={() => setCalcOpen(false)} onUse={props.onValueChange} />
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
