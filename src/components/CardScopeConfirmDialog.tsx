import { useEffect, useMemo, useState } from "react";
import { Modal, Field, inputClass, Select } from "./Modal";
import { MONTHS } from "@/lib/format";
import type { CardScope } from "@/store/finance";
import { AlertTriangle } from "lucide-react";

export type ScopeKind = "all" | "period" | "month";

/**
 * Confirmation dialog with scope picker. Opens AFTER the user clicks the
 * primary action (Save / Delete / Duplicate). Default selection: "Só este mês".
 *
 * "Por um período" sempre mostra dois selects "De" / "Até", cada um com uma
 * única opção combinada "Mês de Ano". Quando `availableMonths` é fornecido
 * (ex.: parcelamento finito), a lista fica restrita aos meses reais daquele
 * lançamento; caso contrário, gera uma janela ampla de meses (±5 anos a
 * partir do mês em edição) para escolha livre.
 */
export function CardScopeConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirmar",
  variant = "default",
  defaultYear,
  defaultMonth,
  initialKind = "month",
  loading = false,
  availableMonths,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (scope: CardScope) => void | Promise<void>;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  variant?: "default" | "destructive";
  defaultYear: number;
  defaultMonth: number;
  initialKind?: ScopeKind;
  loading?: boolean;
  /**
   * When provided, "Por um período" fica restrito a estes meses reais
   * (chronological). Caso contrário, uma janela genérica de ±5 anos é usada.
   */
  availableMonths?: Array<{ year: number; month: number }>;
}) {
  // Unique, chronological month options — reais (availableMonths) ou uma
  // janela genérica de ±5 anos ao redor do mês em edição.
  const monthOptions = useMemo(() => {
    if (availableMonths && availableMonths.length > 0) {
      const seen = new Set<string>();
      const uniq: Array<{ year: number; month: number }> = [];
      for (const m of availableMonths) {
        const k = `${m.year}-${m.month}`;
        if (seen.has(k)) continue;
        seen.add(k);
        uniq.push(m);
      }
      uniq.sort((a, b) => (a.year - b.year) || (a.month - b.month));
      return uniq;
    }
    const generic: Array<{ year: number; month: number }> = [];
    for (let y = defaultYear - 5; y <= defaultYear + 5; y++) {
      for (let m = 0; m < 12; m++) generic.push({ year: y, month: m });
    }
    return generic;
  }, [availableMonths, defaultYear]);

  const defaultIdx = useMemo(
    () => Math.max(0, monthOptions.findIndex((m) => m.year === defaultYear && m.month === defaultMonth)),
    [monthOptions, defaultYear, defaultMonth],
  );

  const [kind, setKind] = useState<ScopeKind>(initialKind);
  const [startIdx, setStartIdx] = useState(defaultIdx);
  const [endIdx, setEndIdx] = useState(defaultIdx);

  useEffect(() => {
    if (open) {
      setKind(initialKind);
      setStartIdx(defaultIdx);
      setEndIdx(defaultIdx);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialKind, defaultIdx]);

  const buildScope = (): CardScope => {
    if (kind === "all") return { kind: "all" };
    if (kind === "month") return { kind: "month", year: defaultYear, month: defaultMonth };
    const s = monthOptions[startIdx] ?? monthOptions[0];
    const e = monthOptions[endIdx] ?? monthOptions[monthOptions.length - 1];
    return {
      kind: "period",
      startYear: s.year,
      startMonth: s.month,
      endYear: e.year,
      endMonth: e.month,
    };
  };

  const periodInvalid = kind === "period" && startIdx > endIdx;

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-3">
        {variant === "destructive" && (
          <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div className="text-xs text-foreground">
              <p className="font-semibold text-destructive">Esta ação é irreversível.</p>
              {description && <div className="mt-1 text-muted-foreground">{description}</div>}
            </div>
          </div>
        )}
        {variant !== "destructive" && description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Aplicar em
          </p>
          <ScopeOption
            checked={kind === "month"}
            onCheck={() => setKind("month")}
            label={`Só este mês (${MONTHS[defaultMonth]} de ${defaultYear})`}
            description="Aplica somente a este mês."
          />
          <ScopeOption
            checked={kind === "period"}
            onCheck={() => setKind("period")}
            label="Por um período"
            description={
              availableMonths && availableMonths.length > 0
                ? "Escolha o intervalo entre os meses reais deste lançamento."
                : "Escolha o intervalo de meses."
            }
          >
            {kind === "period" && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Field label="De">
                  <Select
                    className={inputClass}
                    value={startIdx}
                    onChange={(e) => setStartIdx(parseInt(e.target.value))}
                  >
                    {monthOptions.map((m, idx) => (
                      <option key={`${m.year}-${m.month}`} value={idx}>
                        {MONTHS[m.month]} de {m.year}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Até">
                  <Select
                    className={inputClass}
                    value={endIdx}
                    onChange={(e) => setEndIdx(parseInt(e.target.value))}
                  >
                    {monthOptions.map((m, idx) => (
                      <option key={`${m.year}-${m.month}`} value={idx}>
                        {MONTHS[m.month]} de {m.year}
                      </option>
                    ))}
                  </Select>
                </Field>
                {periodInvalid && (
                  <p className="col-span-2 text-[11px] text-destructive">
                    O mês final deve ser igual ou posterior ao inicial.
                  </p>
                )}
              </div>
            )}
          </ScopeOption>
          <ScopeOption
            checked={kind === "all"}
            onCheck={() => setKind("all")}
            label="Toda a conta"
            description="Aplica a todos os lançamentos da conta, sem limite de data."
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-lg border border-border bg-background py-2.5 text-sm font-semibold hover:bg-secondary disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(buildScope())}
            disabled={loading || periodInvalid}
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50 ${
              variant === "destructive"
                ? "bg-destructive text-destructive-foreground hover:opacity-90"
                : "bg-primary text-primary-foreground hover:opacity-90"
            }`}
          >
            {loading ? "Processando…" : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ScopeOption({
  checked,
  onCheck,
  label,
  description,
  children,
}: {
  checked: boolean;
  onCheck: () => void;
  label: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`w-full rounded-xl border p-4 text-left transition-colors ${
        checked ? "border-primary bg-primary/5" : "border-border hover:border-primary"
      }`}
    >
      <button type="button" onClick={onCheck} className="flex w-full flex-col items-start gap-1">
        <span className="font-semibold text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </button>
      {children}
    </div>
  );
}
