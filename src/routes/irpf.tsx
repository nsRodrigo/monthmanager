import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  Download,
  FileText,
  Loader2,
  ShieldAlert,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/store/confirm";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";

import {
  useAccounts,
  useCards,
  usePurchases,
  useInstallments,
  useDebits,
  useIncomes,
  useInvestments,
  computeMonthlyAccountBalance,
} from "@/store/finance";
import {
  useIrpfDocuments,
  useIrpfEntries,
  useIrpfSnapshots,
  useUploadIrpfDoc,
  useDeleteIrpfDoc,
  useReclassifyEntry,
  useUpsertSnapshot,
} from "@/store/irpf";
import {
  CATEGORY_LABEL,
  CATEGORY_OPTIONS,
  fichaForSubcategory,
  type IrpfCategory,
  type IrpfEntry,
} from "@/lib/irpf";
import { formatCurrency, formatDate } from "@/lib/format";

export const Route = createFileRoute("/irpf")({
  head: () => ({
    meta: [
      { title: "Imposto de Renda — Gestão Financeira" },
      { name: "description", content: "Pré-análise do seu IRPF a partir das movimentações do app e documentos importados." },
    ],
  }),
  component: IrpfPage,
});

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);

function IrpfPage() {
  const [year, setYear] = useState<number>(CURRENT_YEAR - 1);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:py-10">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Imposto de Renda
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
            Análise do IRPF {year}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Importe extratos e informes para gerar uma pré-análise. Esta ferramenta não
            substitui um contador e não envia dados à Receita.
          </p>
        </div>
        <div className="w-full sm:w-44">
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  Ano-base {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      <Disclaimer />

      <Tabs defaultValue="docs" className="mt-6">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="docs">Documentos</TabsTrigger>
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="declarar">Declarar</TabsTrigger>
          <TabsTrigger value="alertas">Alertas</TabsTrigger>
        </TabsList>

        <TabsContent value="docs" className="mt-4">
          <DocumentsTab year={year} />
        </TabsContent>
        <TabsContent value="resumo" className="mt-4">
          <ResumoTab year={year} />
        </TabsContent>
        <TabsContent value="declarar" className="mt-4">
          <DeclararTab year={year} />
        </TabsContent>
        <TabsContent value="alertas" className="mt-4">
          <AlertasTab year={year} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Disclaimer() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card/40 p-4">
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      <div className="text-xs text-muted-foreground">
        <p>
          <strong className="text-foreground">Dados sensíveis.</strong> Documentos enviados
          ficam restritos ao seu usuário e não são compartilhados.
        </p>
        <p className="mt-1">
          Esta análise é uma <strong>orientação</strong>. Para casos complexos consulte um
          contador. Nenhuma informação é enviada à Receita Federal.
        </p>
      </div>
    </div>
  );
}

// ---------------- DOCUMENTS ----------------

function DocumentsTab({ year }: { year: number }) {
  const confirmDialog = useConfirm();
  const { data: docs = [] } = useIrpfDocuments(year);
  const upload = useUploadIrpfDoc(year);
  const remove = useDeleteIrpfDoc();
  const [kind, setKind] = useState("extrato");

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      try {
        const r = await upload.mutateAsync({ file, kind });
        toast.success(`${file.name}: ${r.entriesCount} linhas processadas`);
      } catch (e: any) {
        toast.error(`Falha em ${file.name}: ${e?.message || e}`);
      }
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Tipo do documento
            </label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="extrato">Extrato bancário</SelectItem>
                <SelectItem value="informe">Informe de rendimentos</SelectItem>
                <SelectItem value="planilha">Planilha</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Enviar arquivo
            <input
              type="file"
              accept=".csv,.xlsx,.xls,.pdf"
              multiple
              className="hidden"
              onChange={(e) => onFiles(e.target.files)}
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Aceita CSV e XLSX (processados automaticamente). PDFs são armazenados mas
          ainda não são lidos automaticamente — use a aba <strong>Resumo</strong> para
          confirmar manualmente os valores.
        </p>
      </Card>

      <div className="space-y-2">
        {docs.length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhum documento enviado para {year}.
          </p>
        )}
        {docs.map((d) => (
          <Card key={d.id} className="flex items-center gap-3 p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{d.originalName}</p>
              <p className="text-[11px] text-muted-foreground">
                {d.kind} · {d.size ? `${(d.size / 1024).toFixed(0)} KB` : "—"} ·{" "}
                {new Date(d.uploadedAt).toLocaleDateString("pt-BR")}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={async () => {
                const ok = await confirmDialog({
                  title: "Excluir documento",
                  description: `Excluir ${d.originalName}?`,
                  variant: "destructive",
                  confirmLabel: "Excluir",
                });
                if (!ok) return;
                await remove.mutateAsync(d);
                toast.success("Documento excluído.");
              }}
              aria-label="Excluir"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------------- RESUMO ----------------

function useYearAggregations(year: number) {
  const { data: accounts = [] } = useAccounts();
  const { data: cards = [] } = useCards();
  const { data: purchases = [] } = usePurchases();
  const { data: installments = [] } = useInstallments();
  const { data: debits = [] } = useDebits();
  const { data: incomes = [] } = useIncomes();
  const { data: investments = [] } = useInvestments();
  const { data: entries = [] } = useIrpfEntries(year);
  const { data: snapshots = [] } = useIrpfSnapshots(year);

  return useMemo(() => {
    // Renda recebida no ano (incomes do app)
    let appIncomes = 0;
    for (const inc of incomes) {
      if (inc.isParent || !inc.date) continue;
      const [y] = inc.date.slice(0, 10).split("-").map(Number);
      if (y === year && inc.received) appIncomes += inc.amount;
    }
    for (const i of installments) {
      if (i.parentType !== "income" || !i.paid) continue;
      if (i.year === year) appIncomes += i.amount;
    }

    // Por categoria, vindo de irpf_entries
    const byCat: Record<IrpfCategory, number> = {
      tributavel: 0,
      isento: 0,
      exclusiva: 0,
      bens_direitos: 0,
      dividas: 0,
      nao_classificado: 0,
    };
    for (const e of entries) {
      byCat[e.category] += Math.abs(e.amount);
    }

    // Saldo em 31/12 por conta (projetado a partir do saldo mensal)
    const accountBalances31_12 = accounts.map((a) => {
      const monthly = computeMonthlyAccountBalance(
        a,
        cards,
        purchases,
        installments,
        debits,
        incomes,
        investments,
      );
      // Pegar maior chave Y-M com year <= year
      let saldo = a.initialBalance;
      const sorted = Array.from(monthly.values())
        .filter((b) => b.year < year || (b.year === year))
        .sort((x, y2) => (x.year !== y2.year ? x.year - y2.year : x.month - y2.month));
      for (const b of sorted) {
        if (b.year > year) break;
        saldo = b.saldoEmConta;
      }
      // override por snapshot
      const snap = snapshots.find((s) => s.accountId === a.id);
      return {
        accountId: a.id,
        name: a.name,
        value: snap ? snap.value : saldo,
        hasSnapshot: !!snap,
      };
    });

    const totalBensContas = accountBalances31_12.reduce((s, b) => s + Math.max(0, b.value), 0);

    return {
      appIncomes,
      byCat,
      accountBalances31_12,
      totalBensContas,
      entries,
      accounts,
      incomes,
      investments,
      installments,
      snapshots,
    };
  }, [accounts, cards, purchases, installments, debits, incomes, investments, entries, snapshots, year]);
}

function ResumoTab({ year }: { year: number }) {
  const agg = useYearAggregations(year);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard label="Tributáveis (importado)" value={agg.byCat.tributavel} accent="text-success" />
        <SummaryCard label="Recebido no app" value={agg.appIncomes} accent="text-success" />
        <SummaryCard label="Isentos" value={agg.byCat.isento} accent="text-primary" />
        <SummaryCard label="Tributação Exclusiva" value={agg.byCat.exclusiva} accent="text-credit" />
        <SummaryCard label="Bens (saldos 31/12)" value={agg.totalBensContas} accent="text-foreground" />
        <SummaryCard label="Dívidas" value={agg.byCat.dividas} accent="text-destructive" />
      </div>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold">Saldos em 31/12/{year}</h2>
        <div className="space-y-2">
          {agg.accountBalances31_12.map((a) => (
            <SnapshotRow key={a.accountId} year={year} accountId={a.accountId} name={a.name} value={a.value} hasSnapshot={a.hasSnapshot} />
          ))}
          {agg.accountBalances31_12.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma conta cadastrada.</p>
          )}
        </div>
      </Card>

      <EntriesList year={year} />
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 break-words text-xl font-bold ${accent}`}>{formatCurrency(value)}</p>
    </Card>
  );
}

function SnapshotRow({
  year,
  accountId,
  name,
  value,
  hasSnapshot,
}: {
  year: number;
  accountId: string;
  name: string;
  value: number;
  hasSnapshot: boolean;
}) {
  const { data: snapshots = [] } = useIrpfSnapshots(year);
  const upsert = useUpsertSnapshot();
  const existing = snapshots.find((s) => s.accountId === accountId);
  const [val, setVal] = useState<string>(value.toFixed(2));

  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="text-[11px] text-muted-foreground">
          {hasSnapshot ? "Confirmado" : "Calculado a partir do app"}
        </p>
      </div>
      <Input
        className="h-8 w-32 text-right"
        inputMode="decimal"
        value={val}
        onChange={(e) => setVal(e.target.value)}
      />
      <Button
        size="sm"
        variant={hasSnapshot ? "secondary" : "default"}
        onClick={() =>
          upsert.mutate({
            id: existing?.id,
            year,
            accountId,
            investmentId: null,
            label: name,
            value: parseFloat(val.replace(",", ".")) || 0,
          })
        }
      >
        {hasSnapshot ? "Atualizar" : "Confirmar"}
      </Button>
    </div>
  );
}

function EntriesList({ year }: { year: number }) {
  const { data: entries = [] } = useIrpfEntries(year);
  const reclassify = useReclassifyEntry();
  const [filter, setFilter] = useState<IrpfCategory | "all">("all");

  const visible = filter === "all" ? entries : entries.filter((e) => e.category === filter);

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold">Itens importados ({entries.length})</h2>
        <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
          <SelectTrigger className="h-8 w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {CATEGORY_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum item para mostrar.</p>
      ) : (
        <div className="space-y-1.5">
          {visible.slice(0, 200).map((e) => (
            <div
              key={e.id}
              className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 rounded-lg border border-border/60 p-2 text-xs"
            >
              <span className="w-16 text-muted-foreground">{e.date ? formatDate(e.date) : "—"}</span>
              <span className="min-w-0 truncate" title={e.description}>{e.description}</span>
              <span className={e.amount < 0 ? "text-destructive" : "text-foreground"}>
                {formatCurrency(e.amount)}
              </span>
              <Select
                value={e.category}
                onValueChange={(v) =>
                  reclassify.mutate({ id: e.id, category: v as IrpfCategory, subcategory: e.subcategory })
                }
              >
                <SelectTrigger className="h-7 w-36 text-[11px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
          {visible.length > 200 && (
            <p className="pt-2 text-center text-[11px] text-muted-foreground">
              Mostrando 200 de {visible.length}.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

// ---------------- DECLARAR ----------------

function DeclararTab({ year }: { year: number }) {
  const agg = useYearAggregations(year);
  const { data: entries = [] } = useIrpfEntries(year);

  // agrupa por (categoria, subcategoria)
  const groups = useMemo(() => {
    const map = new Map<string, { category: IrpfCategory; subcategory: string | null; total: number; items: IrpfEntry[] }>();
    for (const e of entries) {
      if (e.category === "nao_classificado") continue;
      const key = `${e.category}|${e.subcategory || ""}`;
      const g = map.get(key) ?? { category: e.category, subcategory: e.subcategory, total: 0, items: [] };
      g.total += Math.abs(e.amount);
      g.items.push(e);
      map.set(key, g);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [entries]);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h2 className="text-sm font-semibold">Bens e Direitos — Saldos bancários em 31/12/{year}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Para cada conta, declare na ficha <strong>Bens e Direitos</strong>, grupo
          <strong> 04 (Aplicações e Investimentos)</strong> ou <strong>04.01 (Conta Corrente)</strong>.
        </p>
        <div className="mt-3 space-y-2">
          {agg.accountBalances31_12.map((a) => (
            <DeclarationBlock
              key={a.accountId}
              ficha="Bens e Direitos"
              grupo="04"
              codigo="01"
              descricao={`Conta — ${a.name}`}
              value={a.value}
            />
          ))}
        </div>
      </Card>

      {groups.map((g) => {
        const f = fichaForSubcategory(g.category, g.subcategory);
        return (
          <Card key={`${g.category}|${g.subcategory}`} className="p-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {CATEGORY_LABEL[g.category]}
            </p>
            <h3 className="text-sm font-semibold">{g.subcategory || "Geral"}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{f.descricao}</p>
            <div className="mt-3">
              <DeclarationBlock
                ficha={f.ficha}
                grupo={f.grupo}
                codigo={f.codigo}
                descricao={g.subcategory || CATEGORY_LABEL[g.category]}
                value={g.total}
              />
            </div>
          </Card>
        );
      })}

      {groups.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Importe documentos ou reclassifique os itens para gerar instruções de declaração.
        </p>
      )}
    </div>
  );
}

function DeclarationBlock({
  ficha,
  grupo,
  codigo,
  descricao,
  value,
}: {
  ficha: string;
  grupo?: string;
  codigo?: string;
  descricao: string;
  value: number;
}) {
  const text = [
    `Ficha: ${ficha}`,
    grupo ? `Grupo: ${grupo}` : null,
    codigo ? `Código: ${codigo}` : null,
    `Descrição: ${descricao}`,
    `Valor: ${formatCurrency(value)}`,
  ]
    .filter(Boolean)
    .join("\n");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copiado para a área de transferência");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <div className="grid grid-cols-[1fr_auto] items-start gap-2 rounded-lg border border-border bg-background/40 p-3">
      <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-foreground">{text}</pre>
      <Button size="sm" variant="outline" onClick={copy} className="shrink-0">
        <ClipboardCopy className="mr-1 h-3 w-3" /> Copiar
      </Button>
    </div>
  );
}

// ---------------- ALERTAS ----------------

function AlertasTab({ year }: { year: number }) {
  const agg = useYearAggregations(year);
  const { data: entries = [] } = useIrpfEntries(year);

  const alerts: { kind: "warn" | "error" | "ok"; text: string }[] = [];

  // Recebimentos no app vs entries tributáveis
  if (agg.appIncomes > 0 && agg.byCat.tributavel === 0) {
    alerts.push({
      kind: "warn",
      text: `Você marcou ${formatCurrency(agg.appIncomes)} como recebido no app, mas nenhuma entrada tributável foi importada para ${year}. Verifique se os informes de rendimento foram enviados.`,
    });
  }
  if (agg.byCat.tributavel > 0 && Math.abs(agg.byCat.tributavel - agg.appIncomes) > 100 && agg.appIncomes > 0) {
    alerts.push({
      kind: "warn",
      text: `Diferença entre recebimentos do app (${formatCurrency(agg.appIncomes)}) e tributáveis importados (${formatCurrency(agg.byCat.tributavel)}). Confira possíveis omissões.`,
    });
  }
  // Snapshots faltantes
  const semSnap = agg.accountBalances31_12.filter((a) => !a.hasSnapshot);
  if (semSnap.length > 0) {
    alerts.push({
      kind: "warn",
      text: `${semSnap.length} conta(s) ainda sem saldo confirmado em 31/12. Confirme os valores na aba Resumo.`,
    });
  }
  // Itens não classificados
  const naoClass = entries.filter((e) => e.category === "nao_classificado").length;
  if (naoClass > 0) {
    alerts.push({
      kind: "warn",
      text: `${naoClass} item(s) ainda não classificados. Reclassifique-os para que apareçam nas instruções de declaração.`,
    });
  }
  // Investimentos cadastrados sem entries de tributação exclusiva
  if (agg.investments.length > 0 && agg.byCat.exclusiva === 0) {
    alerts.push({
      kind: "warn",
      text: "Você possui investimentos no app mas nenhum rendimento de tributação exclusiva foi identificado. Importe o informe da corretora/banco.",
    });
  }

  // Checklist
  const checklist = [
    { ok: agg.accountBalances31_12.every((a) => a.hasSnapshot) && agg.accountBalances31_12.length > 0, text: "Saldos bancários em 31/12 confirmados" },
    { ok: agg.byCat.tributavel > 0 || agg.appIncomes > 0, text: "Rendimentos tributáveis informados" },
    { ok: agg.byCat.exclusiva > 0 || agg.investments.length === 0, text: "Rendimentos de aplicações financeiras importados" },
    { ok: naoClass === 0, text: "Todos os itens importados foram classificados" },
  ];

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold">Alertas</h2>
        {alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tudo certo até aqui.</p>
        ) : (
          <ul className="space-y-2">
            {alerts.map((a, i) => (
              <li key={i} className="flex items-start gap-2 rounded-lg border border-border/60 p-2 text-xs">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <span>{a.text}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold">Checklist de declaração</h2>
        <ul className="space-y-2">
          {checklist.map((c, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              {c.ok ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-destructive" />
              )}
              <span className={c.ok ? "text-foreground" : "text-muted-foreground"}>{c.text}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
