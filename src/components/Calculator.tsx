import { useState } from "react";
import { Delete } from "lucide-react";

const KEYS: Array<{ label: string; value: string; tone?: "op" | "fn" | "eq" }> = [
  { label: "C", value: "C", tone: "fn" },
  { label: "(", value: "(" },
  { label: ")", value: ")" },
  { label: "÷", value: "÷", tone: "op" },
  { label: "7", value: "7" },
  { label: "8", value: "8" },
  { label: "9", value: "9" },
  { label: "×", value: "×", tone: "op" },
  { label: "4", value: "4" },
  { label: "5", value: "5" },
  { label: "6", value: "6" },
  { label: "-", value: "-", tone: "op" },
  { label: "1", value: "1" },
  { label: "2", value: "2" },
  { label: "3", value: "3" },
  { label: "+", value: "+", tone: "op" },
  { label: "0", value: "0" },
  { label: ",", value: "," },
  { label: "%", value: "%" },
  { label: "=", value: "=", tone: "eq" },
];

/** Avalia uma expressão simples (+, -, ×, ÷, %, parênteses) com vírgula decimal. */
export function evaluateExpression(expr: string): number | null {
  const safe = expr
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/,/g, ".")
    .replace(/(\d+(?:\.\d+)?)%/g, "($1/100)");
  if (!safe.trim() || /[^0-9+\-*/.() ]/.test(safe)) return null;
  try {
    // eslint-disable-next-line no-new-func
    const result = Function('"use strict";return (' + safe + ")")();
    return typeof result === "number" && isFinite(result) ? Math.round(result * 100) / 100 : null;
  } catch {
    return null;
  }
}

/**
 * Calculadora simples (+, -, ×, ÷, %, parênteses) — usada tanto embutida no
 * campo Valor (via `CalculatorModal`) quanto avulsa pelo FAB/menu lateral.
 * Puramente apresentacional: quem usa decide o que fazer com o resultado.
 */
export function Calculator({ onResultChange }: { onResultChange?: (result: number | null) => void }) {
  const [expr, setExpr] = useState("");
  const result = evaluateExpression(expr);

  function press(value: string) {
    let next = expr;
    if (value === "C") {
      next = "";
    } else if (value === "=") {
      next = result !== null ? String(result).replace(".", ",") : expr;
    } else {
      next = expr + value;
    }
    setExpr(next);
    onResultChange?.(evaluateExpression(next));
  }

  function backspace() {
    const next = expr.slice(0, -1);
    setExpr(next);
    onResultChange?.(evaluateExpression(next));
  }

  const displayResult = result !== null ? String(result).replace(".", ",") : "0";

  return (
    <div className="flex flex-col">
      <div className="px-1 pb-4 text-right">
        <div className="min-h-[18px] truncate text-xs text-muted-foreground">{expr || " "}</div>
        <div className="mt-1 truncate text-3xl font-bold tabular-nums">{displayResult}</div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {KEYS.map((k) => (
          <button
            key={k.label}
            type="button"
            onClick={() => press(k.value)}
            className={`flex h-12 items-center justify-center rounded-xl text-lg font-semibold tabular-nums transition-colors active:scale-95 ${
              k.tone === "op"
                ? "bg-primary/15 text-primary"
                : k.tone === "fn"
                  ? "bg-destructive/15 text-destructive"
                  : k.tone === "eq"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-foreground"
            }`}
          >
            {k.label}
          </button>
        ))}
        <button
          type="button"
          onClick={backspace}
          className="col-span-4 mt-1 flex h-10 items-center justify-center gap-2 rounded-xl bg-secondary text-sm font-semibold text-muted-foreground"
        >
          <Delete className="h-4 w-4" /> Apagar
        </button>
      </div>
    </div>
  );
}
