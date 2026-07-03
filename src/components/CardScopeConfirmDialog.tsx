import { useEffect, useState } from "react";
import { Modal, Field, inputClass } from "./Modal";
import { MONTHS } from "@/lib/format";
import type { CardScope } from "@/store/finance";
import { AlertTriangle } from "lucide-react";

export type ScopeKind = "all" | "period" | "month";

/**
 * Confirmation dialog with scope picker. Opens AFTER the user clicks the
 * primary action (Save / Delete / Duplicate). Default selection: "Só este mês".
 *
 * Period uses two real <input type="date"> pickers; we keep month-level
 * granularity internally by deriving year/month from the chosen dates.
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
}) {
  const [kind, setKind] = useState<ScopeKind>(initialKind);
  const toIso = (y: number, m: number, last = false) => {
    const day = last ? new Date(y, m + 1, 0).getDate() : 1;
    const p = (n: number) => String(n).padStart(2, "0");
    return `${y}-${p(m + 1)}-${p(day)}`;
  };
  const [startDate, setStartDate] = useState(toIso(defaultYear, defaultMonth));
  const [endDate, setEndDate] = useState(toIso(defaultYear, defaultMonth, true));

  useEffect(() => {
    if (open) {
      setKind(initialKind);
      setStartDate(toIso(defaultYear, defaultMonth));
      setEndDate(toIso(defaultYear, defaultMonth, true));
    }
  }, [open, initialKind, defaultYear, defaultMonth]);

  const buildScope = (): CardScope => {
    if (kind === "all") return { kind: "all" };
    if (kind === "month") return { kind: "month", year: defaultYear, month: defaultMonth };
    const [sy, sm] = startDate.split("-").map(Number);
    const [ey, em] = endDate.split("-").map(Number);
    return {
      kind: "period",
      startYear: sy,
      startMonth: sm - 1,
      endYear: ey,
      endMonth: em - 1,
    };
  };

  const periodInvalid = kind === "period" && startDate > endDate;

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
            description="Selecione um intervalo de datas."
          />
          <ScopeOption
            checked={kind === "all"}
            onCheck={() => setKind("all")}
            label="Toda a conta"
            description="Aplica a todos os lançamentos da conta, sem limite de data."
          />
        </div>


        {kind === "period" && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Data inicial">
              <input
                type="date"
                className={inputClass}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </Field>
            <Field label="Data final">
              <input
                type="date"
                className={inputClass}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </Field>
            {periodInvalid && (
              <p className="col-span-2 text-[11px] text-destructive">
                Data final deve ser igual ou posterior à inicial.
              </p>
            )}
          </div>
        )}

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
}: {
  checked: boolean;
  onCheck: () => void;
  label: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${
        checked ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/40"
      }`}
    >
      <input
        type="radio"
        checked={checked}
        onChange={onCheck}
        className="h-3.5 w-3.5 accent-primary"
      />
      <span className="font-semibold text-foreground">{label}</span>
    </label>
  );
}
