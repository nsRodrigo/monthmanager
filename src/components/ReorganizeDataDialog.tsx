import { useState } from "react";
import { Modal, Field, inputClass } from "./Modal";
import { MONTHS } from "@/lib/format";
import { useReorganizeData } from "@/store/finance";
import { toast } from "sonner";

export function ReorganizeDataDialog({
  open,
  onClose,
  contaId,
  yearList,
}: {
  open: boolean;
  onClose: () => void;
  contaId: string;
  yearList: number[];
}) {
  const currentYear = new Date().getFullYear();
  const years = yearList.length > 0 ? yearList : [currentYear];

  const [mode, setMode] = useState<"month" | "year">("month");

  // Opcao A: mover mes
  const [fromMonth, setFromMonth] = useState(0);
  const [fromYear, setFromYear] = useState(years[0] ?? currentYear);
  const [toMonth, setToMonth] = useState(0);
  const [toYear, setToYear] = useState(years[0] ?? currentYear);

  // Opcao B: mover ano
  const [fromYearOnly, setFromYearOnly] = useState(years[0] ?? currentYear);
  const [toYearOnly, setToYearOnly] = useState(years[0] ?? currentYear);

  const reorganize = useReorganizeData();
  const [loading, setLoading] = useState(false);

  const isSame =
    mode === "month"
      ? fromMonth === toMonth && fromYear === toYear
      : fromYearOnly === toYearOnly;

  const warningText =
    mode === "month"
      ? `Todos os debitos, receitas, investimentos e parcelas de ${MONTHS[fromMonth]}/${fromYear} serao movidos para ${MONTHS[toMonth]}/${toYear}. Esta acao nao pode ser desfeita.`
      : `Todos os lancamentos de ${fromYearOnly} (${12} meses) serao movidos para ${toYearOnly}. Esta acao nao pode ser desfeita.`;

  const handleConfirm = async () => {
    if (isSame) return;
    setLoading(true);
    try {
      await reorganize.mutateAsync({
        contaId,
        mode,
        fromMonth,
        fromYear,
        toMonth,
        toYear,
        fromYearOnly,
        toYearOnly,
      });
      toast.success("Dados reorganizados com sucesso.");
      onClose();
    } catch {
      toast.error("Erro ao reorganizar os dados. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Reorganizar dados">
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Mova um mes ou um ano inteiro para outra data.
          Todos os lancamentos serao atualizados.
        </p>

        {/* Radio options */}
        <div className="space-y-2">
          {(["month", "year"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`w-full rounded-xl border p-3 text-left transition-colors ${
                mode === m
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-secondary"
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    mode === m ? "border-primary bg-primary" : "border-muted-foreground"
                  }`}
                >
                  {mode === m && (
                    <div className="h-1.5 w-1.5 rounded-full bg-white" />
                  )}
                </div>
                <span className="text-sm font-semibold">
                  {m === "month" ? "Mover um mes especifico" : "Mover um ano inteiro"}
                </span>
              </div>
              <p className="mt-1 pl-6 text-[11px] text-muted-foreground">
                {m === "month"
                  ? "Selecione o mes de origem e para qual mes deseja mover os dados."
                  : "Move todos os lancamentos de um ano para outro de uma vez."}
              </p>
            </button>
          ))}
        </div>

        {/* Fields */}
        <div className="rounded-xl bg-secondary/30 p-3 space-y-3">
          {mode === "month" ? (
            <>
              <div>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Mes de origem
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="">
                    <select
                      className={inputClass}
                      value={fromMonth}
                      onChange={(e) => setFromMonth(Number(e.target.value))}
                    >
                      {MONTHS.map((name, idx) => (
                        <option key={idx} value={idx}>{name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="">
                    <select
                      className={inputClass}
                      value={fromYear}
                      onChange={(e) => setFromYear(Number(e.target.value))}
                    >
                      {years.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-border" />
                <span className="text-primary text-sm">→</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Mes de destino
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="">
                    <select
                      className={inputClass}
                      value={toMonth}
                      onChange={(e) => setToMonth(Number(e.target.value))}
                    >
                      {MONTHS.map((name, idx) => (
                        <option key={idx} value={idx}>{name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="">
                    <select
                      className={inputClass}
                      value={toYear}
                      onChange={(e) => setToYear(Number(e.target.value))}
                    >
                      {[...new Set([...years, toYear])].sort().map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
              <Field label="Ano de origem">
                <select
                  className={inputClass}
                  value={fromYearOnly}
                  onChange={(e) => setFromYearOnly(Number(e.target.value))}
                >
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </Field>
              <span className="pb-2 text-primary text-lg">→</span>
              <Field label="Ano de destino">
                <select
                  className={inputClass}
                  value={toYearOnly}
                  onChange={(e) => setToYearOnly(Number(e.target.value))}
                >
                  {[...new Set([...years, toYearOnly])].sort().map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </Field>
            </div>
          )}
        </div>

        {/* Warning */}
        {!isSame && (
          <div className="rounded-xl border border-warning/30 bg-warning/8 p-3 text-[11px] text-warning leading-relaxed">
            ⚠ {warningText}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border bg-background py-2.5 text-sm font-semibold hover:bg-secondary"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSame || loading}
            className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Movendo..." : "Mover dados"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
