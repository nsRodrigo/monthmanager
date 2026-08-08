import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  parseHistoricalWorkbook,
  summarizeSections,
  type ParsedEntry,
  type ParseResult,
} from "@/lib/xlsxParser";
import { buildImportPlan } from "@/lib/xlsxImportPlan";
import {
  useAccounts,
  useImportHistorical,
  usePurgeAllMovements,
  type HistoricalImportProgress,
} from "@/store/finance";
import { formatCurrency } from "@/lib/format";
import { MobileMenuButton } from "@/components/MobileMenuButton";
import {
  Upload,
  FileSpreadsheet,
  Check,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Trash2,
  Database,
} from "lucide-react";

export const Route = createFileRoute("/importar-historico")({
  head: () => ({ meta: [{ title: "Importar Planilha Histórica — Finanças" }] }),
  component: HistoricalImportPage,
});

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function HistoricalImportPage() {
  const [results, setResults] = useState<ParseResult[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());
  const [confirmingPurge, setConfirmingPurge] = useState(false);
  const [importProgress, setImportProgress] = useState<HistoricalImportProgress | null>(null);

  // Conta padrão para débitos/recebimentos/investimentos sem banco identificável
  // (CARTEIRA, RECEBIDOS, INVESTIMENTO). Pode ser uma conta existente ou nova.
  const { data: accounts = [] } = useAccounts();
  const [defaultAccountChoice, setDefaultAccountChoice] = useState<string>("__new__");
  const [defaultAccountName, setDefaultAccountName] = useState("Geral");

  const importMut = useImportHistorical();
  const purgeMut = usePurgeAllMovements();

  const allEntries = useMemo<ParsedEntry[]>(() => results.flatMap((r) => r.entries), [results]);

  const stats = useMemo(() => {
    const byKind = { purchase: 0, debit: 0, income: 0, investment: 0 };
    let total = 0;
    for (const e of allEntries) {
      byKind[e.kind]++;
      total += e.amount;
    }
    return { byKind, total, count: allEntries.length };
  }, [allEntries]);

  // Resolve o nome da conta padrão: usa a selecionada OU o input "Nova"
  const resolvedDefaultName = useMemo(() => {
    if (defaultAccountChoice === "__new__") return defaultAccountName.trim() || "Geral";
    const a = accounts.find((x) => x.id === defaultAccountChoice);
    return a?.name ?? "Geral";
  }, [defaultAccountChoice, defaultAccountName, accounts]);

  const plan = useMemo(
    () =>
      allEntries.length > 0
        ? buildImportPlan(allEntries, { defaultAccountName: resolvedDefaultName })
        : null,
    [allEntries, resolvedDefaultName],
  );

  const byYear = useMemo(() => {
    const m = new Map<number, ParsedEntry[]>();
    for (const e of allEntries) {
      if (!m.has(e.year)) m.set(e.year, []);
      m.get(e.year)!.push(e);
    }
    return Array.from(m.entries()).sort((a, b) => a[0] - b[0]);
  }, [allEntries]);

  const onFile = async (file: File) => {
    setError(null);
    setSuccess(null);
    setParsing(true);
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const parsed = parseHistoricalWorkbook(buf);
      setResults(parsed);
      // Expande o primeiro ano por padrão
      const firstYear = parsed
        .flatMap((r) => r.entries)
        .map((e) => e.year)
        .sort()[0];
      if (firstYear) setExpandedYears(new Set([firstYear]));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao ler planilha.");
    } finally {
      setParsing(false);
    }
  };

  const toggleYear = (y: number) => {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(y)) next.delete(y);
      else next.add(y);
      return next;
    });
  };

  const submit = async () => {
    if (!plan) return;
    setError(null);
    setSuccess(null);
    setImportProgress({
      stage: "preparing",
      label: "Preparando importação",
      current: 0,
      total: stats.count,
    });
    try {
      const r = await importMut.mutateAsync({
        plan,
        onProgress: (progress) => setImportProgress(progress),
      });
      setSuccess(
        `✅ Importado: ${r.purchases} compras, ${r.debits} débitos, ${r.incomes} recebimentos, ${r.investments} investimentos. ${r.accounts} contas e ${r.cards} cartões criados/encontrados.`,
      );
      setResults([]);
      setImportProgress(null);
    } catch (e: any) {
      console.error("[importar-historico] falha:", e);
      const msg =
        e?.message ||
        e?.error_description ||
        e?.error ||
        e?.details ||
        e?.hint ||
        (typeof e === "string" ? e : null) ||
        (e ? JSON.stringify(e) : "Erro ao gravar dados.");
      setError(`Erro ao gravar dados: ${msg}`);
      setImportProgress(null);
    }
  };

  const purge = async () => {
    setError(null);
    setSuccess(null);
    try {
      await purgeMut.mutateAsync();
      setSuccess("✅ Todas as movimentações foram apagadas.");
      setConfirmingPurge(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao apagar.");
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 md:py-12">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Home
        </Link>
        <MobileMenuButton />
      </div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Importar planilha histórica</h1>
        <p className="text-sm text-muted-foreground">
          Carregue sua planilha XLSX completa — detectamos contas, cartões, parcelas e seções.
        </p>
      </header>

      <div className="space-y-6 pb-20">

      {/* Zona perigosa */}
      <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <div className="flex items-start gap-3">
          <Database className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-destructive">Antes de importar: limpe o banco</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Apaga TODAS as compras, parcelas, débitos, recebimentos e investimentos. Mantém suas
              contas e cartões cadastrados. Use isso se você importou dados de teste e quer começar
              do zero.
            </p>
            <div className="mt-3 flex gap-2">
              {!confirmingPurge ? (
                <button
                  onClick={() => setConfirmingPurge(true)}
                  className="inline-flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Apagar todas as movimentações
                </button>
              ) : (
                <>
                  <button
                    onClick={purge}
                    disabled={purgeMut.isPending}
                    className="inline-flex items-center gap-2 rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    {purgeMut.isPending ? "Apagando…" : "Confirmar (irreversível)"}
                  </button>
                  <button
                    onClick={() => setConfirmingPurge(false)}
                    className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary"
                  >
                    Cancelar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Upload */}
      <section className="rounded-xl border border-border bg-card/40 p-4">
        {/* Seletor de conta destino padrão */}
        <div className="mb-5 grid gap-3 rounded-xl border border-border bg-background/40 p-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Conta destino padrão
            </label>
            <select
              value={defaultAccountChoice}
              onChange={(e) => setDefaultAccountChoice(e.target.value)}
              className="w-full rounded-lg border border-input bg-input px-3 py-2.5 text-sm outline-none focus:border-primary"
            >
              <option value="__new__">+ Criar nova conta…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.type}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-muted-foreground">
              TODOS os lançamentos da planilha (débitos, recebimentos, investimentos) e TODOS os
              cartões serão associados a esta conta. Para separar por banco, cadastre as contas
              manualmente em <strong>Contas</strong> e re-importe.
            </p>
          </div>
          {defaultAccountChoice === "__new__" && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Nome da nova conta
              </label>
              <input
                type="text"
                value={defaultAccountName}
                onChange={(e) => setDefaultAccountName(e.target.value)}
                placeholder="Ex: Geral, Principal…"
                className="w-full rounded-lg border border-input bg-input px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Será criada automaticamente como conta corrente se ainda não existir.
              </p>
            </div>
          )}
        </div>

        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-background/50 p-10 text-center transition-colors hover:border-primary">
          <Upload className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">
            {parsing
              ? "Lendo planilha…"
              : fileName
                ? fileName
                : "Clique ou arraste sua planilha .xlsx"}
          </p>
          <p className="text-xs text-muted-foreground">
            Suporta o formato "ACOMPANHAMENTO DE GASTOS E COMPRAS" (2014-atual)
          </p>
          <input
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            disabled={parsing}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
        </label>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}
        {success && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-success/10 p-3 text-sm text-success">
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{success}</p>
          </div>
        )}
      </section>

      {/* Stats globais */}
      {results.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatCard label="Total de linhas" value={String(stats.count)} />
            <StatCard label="Compras (cartão)" value={String(stats.byKind.purchase)} />
            <StatCard label="Débitos" value={String(stats.byKind.debit)} />
            <StatCard label="Recebimentos" value={String(stats.byKind.income)} />
            <StatCard label="Investimentos" value={String(stats.byKind.investment)} />
          </div>

          {/* Plano de criação */}
          {plan && (
            <section className="rounded-xl border border-border bg-card/40 p-4">
              <h2 className="text-sm font-semibold">O que será criado</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Contas ({plan.accountsToCreate.length})
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {plan.accountsToCreate.map((a) => (
                      <span
                        key={a.name}
                        className="rounded-full px-2.5 py-1 text-xs font-medium"
                        style={{ backgroundColor: a.color + "25", color: a.color }}
                      >
                        {a.name}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Cartões ({plan.cardsToCreate.length})
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {plan.cardsToCreate.map((c) => (
                      <span
                        key={c.name}
                        className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-foreground"
                        title={`Conta: ${c.accountName}`}
                      >
                        {c.name} <span className="text-muted-foreground">· {c.accountName}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={submit}
                disabled={importMut.isPending}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 md:w-auto"
              >
                {importMut.isPending
                  ? "Gravando no banco…"
                  : `Confirmar e gravar ${stats.count} lançamentos`}
              </button>
              {importProgress && (
                <div className="mt-4 rounded-xl border border-border bg-background/60 p-4">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold">{importProgress.label}</span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {importProgress.current} de {importProgress.total}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{
                        width: `${importProgress.total > 0 ? Math.min(100, Math.round((importProgress.current / importProgress.total) * 100)) : 0}%`,
                      }}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                    {typeof importProgress.batch === "number" && importProgress.totalBatches ? (
                      <span>
                        Lote {importProgress.batch} de {importProgress.totalBatches}
                      </span>
                    ) : null}
                    {importProgress.attempt ? (
                      <span>Tentativa {importProgress.attempt}</span>
                    ) : null}
                    {importProgress.message ? <span>{importProgress.message}</span> : null}
                  </div>
                </div>
              )}
              <p className="mt-2 text-[11px] text-muted-foreground">
                Esta operação cria contas/cartões automaticamente e insere todas as linhas. Pode
                levar alguns segundos.
              </p>
            </section>
          )}

          {/* Árvore por ano > mês > seção */}
          <section className="rounded-xl border border-border bg-card/40 p-2">
            {byYear.map(([year, ents]) => {
              const open = expandedYears.has(year);
              const yearTotal = ents.reduce((s, e) => s + e.amount, 0);
              return (
                <div key={year} className="border-b border-border last:border-0">
                  <button
                    onClick={() => toggleYear(year)}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-secondary/40"
                  >
                    {open ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <FileSpreadsheet className="h-4 w-4 text-primary" />
                    <span className="font-semibold">{year}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {ents.length} lançamentos · {formatCurrency(yearTotal)}
                    </span>
                  </button>
                  {open && <YearBreakdown entries={ents} />}
                </div>
              );
            })}
          </section>
        </>
      )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

function YearBreakdown({ entries }: { entries: ParsedEntry[] }) {
  const byMonth = useMemo(() => {
    const m = new Map<number, ParsedEntry[]>();
    for (const e of entries) {
      if (!m.has(e.month)) m.set(e.month, []);
      m.get(e.month)!.push(e);
    }
    return Array.from(m.entries()).sort((a, b) => a[0] - b[0]);
  }, [entries]);

  return (
    <div className="bg-background/40 px-4 py-3">
      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
        {byMonth.map(([month, ents]) => {
          const sections = summarizeSections(ents);
          const total = ents.reduce((s, e) => s + e.amount, 0);
          return (
            <div key={month} className="rounded-lg border border-border bg-card p-3">
              <div className="mb-2 flex items-baseline justify-between">
                <p className="text-sm font-semibold">{MONTH_NAMES[month]}</p>
                <p className="text-[11px] text-muted-foreground">
                  {ents.length} · {formatCurrency(total)}
                </p>
              </div>
              <ul className="space-y-1">
                {sections.slice(0, 6).map((s) => (
                  <li key={s.key} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="truncate text-muted-foreground" title={s.label}>
                      {s.label}
                    </span>
                    <span className="shrink-0 font-mono text-foreground">
                      {formatCurrency(s.total)}
                    </span>
                  </li>
                ))}
                {sections.length > 6 && (
                  <li className="text-[10px] text-muted-foreground">
                    + {sections.length - 6} seções
                  </li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
