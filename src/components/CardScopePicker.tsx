import { useState, useEffect } from "react";
import { Field, inputClass } from "./Modal";
import { MONTHS } from "@/lib/format";
import type { CardScope } from "@/store/finance";

export type ScopeKind = "all" | "period" | "month";

export function CardScopePicker({
  defaultYear,
  defaultMonth,
  value,
  onChange,
  labelAll = "Para toda a conta",
  labelMonth = "Somente este mês",
  labelPeriod = "Por um período",
}: {
  defaultYear: number;
  defaultMonth: number;
  value: CardScope;
  onChange: (s: CardScope) => void;
  labelAll?: string;
  labelMonth?: string;
  labelPeriod?: string;
}) {
  const [kind, setKind] = useState<ScopeKind>(value.kind);
  const [sY, setSY] = useState<number>(
    value.kind === "period" ? value.startYear : defaultYear,
  );
  const [sM, setSM] = useState<number>(
    value.kind === "period" ? value.startMonth : defaultMonth,
  );
  const [eY, setEY] = useState<number>(
    value.kind === "period" ? value.endYear : defaultYear,
  );
  const [eM, setEM] = useState<number>(
    value.kind === "period" ? value.endMonth : defaultMonth,
  );

  useEffect(() => {
    if (kind === "all") onChange({ kind: "all" });
    else if (kind === "month") onChange({ kind: "month", year: defaultYear, month: defaultMonth });
    else
      onChange({ kind: "period", startYear: sY, startMonth: sM, endYear: eY, endMonth: eM });
  }, [kind, sY, sM, eY, eM, defaultYear, defaultMonth]);

  const yearOptions = (() => {
    const cy = new Date().getFullYear();
    return Array.from({ length: 11 }, (_, i) => cy - 5 + i);
  })();

  return (
    <div className="space-y-2 rounded-xl border border-border bg-background/40 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Aplicar em
      </p>
      <div className="grid gap-1.5">
        <ScopeOption
          checked={kind === "all"}
          onCheck={() => setKind("all")}
          label={labelAll}
          desc="Vale para todos os meses da conta."
        />
        <ScopeOption
          checked={kind === "month"}
          onCheck={() => setKind("month")}
          label={`${labelMonth} (${MONTHS[defaultMonth]} de ${defaultYear})`}
          desc="Aplica somente no mês que está em edição."
        />
        <ScopeOption
          checked={kind === "period"}
          onCheck={() => setKind("period")}
          label={labelPeriod}
          desc="Selecione um intervalo de meses."
        />
      </div>

      {kind === "period" && (
        <div className="space-y-2 pt-2">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Mês inicial">
              <select className={inputClass} value={sM} onChange={(e) => setSM(Number(e.target.value))}>
                {MONTHS.map((m, i) => (
                  <option key={i} value={i}>{m}</option>
                ))}
              </select>
            </Field>
            <Field label="Ano inicial">
              <select className={inputClass} value={sY} onChange={(e) => setSY(Number(e.target.value))}>
                {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Mês final">
              <select className={inputClass} value={eM} onChange={(e) => setEM(Number(e.target.value))}>
                {MONTHS.map((m, i) => (
                  <option key={i} value={i}>{m}</option>
                ))}
              </select>
            </Field>
            <Field label="Ano final">
              <select className={inputClass} value={eY} onChange={(e) => setEY(Number(e.target.value))}>
                {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </Field>
          </div>
        </div>
      )}
    </div>
  );
}

function ScopeOption({
  checked,
  onCheck,
  label,
  desc,
}: {
  checked: boolean;
  onCheck: () => void;
  label: string;
  desc: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 transition-colors ${
        checked ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/40"
      }`}
    >
      <input
        type="radio"
        checked={checked}
        onChange={onCheck}
        className="mt-0.5 h-4 w-4 accent-primary"
      />
      <div className="text-xs">
        <p className="font-semibold text-foreground">{label}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{desc}</p>
      </div>
    </label>
  );
}
