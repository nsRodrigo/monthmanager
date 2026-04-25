import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import Papa from "papaparse";
import { useCards, useImportPurchases, type ImportedRow } from "@/store/finance";
import { Upload, FileText, Check, AlertCircle, Download } from "lucide-react";

export const Route = createFileRoute("/importar")({
  head: () => ({ meta: [{ title: "Importar CSV — Finanças" }] }),
  component: ImportPage,
});

type ParsedRow = Record<string, string>;

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

const FIELD_MAP: Record<string, string> = {
  descricao: "description",
  description: "description",
  desc: "description",
  datacompra: "purchase_date",
  data: "purchase_date",
  date: "purchase_date",
  valortotal: "total_amount",
  valor: "total_amount",
  total: "total_amount",
  parcelas: "installments_count",
  numparcelas: "installments_count",
  numerodeparcelas: "installments_count",
  installments: "installments_count",
  numeroparcela: "installment_number",
  parcela: "installment_number",
  numero: "installment_number",
  valorparcela: "installment_amount",
  datavencimento: "installment_due",
  vencimento: "installment_due",
  status: "status",
  pago: "status",
  conta: "account",
  cartao: "card",
  card: "card",
};

function parseAmount(raw: string | undefined) {
  if (!raw) return 0;
  return parseFloat(
    raw
      .replace(/[^\d.,-]/g, "")
      .replace(/\./g, "")
      .replace(",", "."),
  ) || 0;
}

function parseDate(raw: string | undefined) {
  if (!raw) return new Date().toISOString().slice(0, 10);
  const t = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (m) {
    const day = m[1].padStart(2, "0");
    const month = m[2].padStart(2, "0");
    let year = m[3];
    if (year.length === 2) year = "20" + year;
    return `${year}-${month}-${day}`;
  }
  return new Date().toISOString().slice(0, 10);
}

function parsePaid(raw: string | undefined) {
  if (!raw) return false;
  const v = norm(raw);
  return ["pago", "paid", "true", "1", "sim", "yes", "y"].includes(v);
}

function ImportPage() {
  const { data: cards = [] } = useCards();
  const importMut = useImportPurchases();
  const [defaultCardId, setDefaultCardId] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onFile = (file: File) => {
    setError(null);
    setSuccess(null);
    Papa.parse<ParsedRow>(file, {
      header: true,
      skipEmptyLines: true,
      delimiter: "", // auto-detect (",", ";", "\t", "|")
      delimitersToGuess: [",", ";", "\t", "|"],
      complete: (res) => {
        if (res.meta?.delimiter) {
          console.log("[CSV] Delimitador detectado:", JSON.stringify(res.meta.delimiter));
        }
        const data = res.data;
        if (!data.length) {
          setError("CSV vazio.");
          return;
        }
        // normalize keys
        const normalized = data.map((r) => {
          const out: ParsedRow = {};
          for (const k of Object.keys(r)) {
            const mapped = FIELD_MAP[norm(k)] ?? norm(k);
            out[mapped] = String(r[k] ?? "").trim();
          }
          return out;
        });
        setHeaders(Object.keys(normalized[0]));
        setRows(normalized);
      },
      error: (err) => setError(err.message),
    });
  };

  const detected = rows.some((r) => r.installment_number && r.installment_number !== "");

  const submit = async () => {
    setError(null);
    setSuccess(null);
    if (!defaultCardId) {
      setError("Selecione um cartão padrão para a importação.");
      return;
    }
    if (rows.length === 0) {
      setError("Nenhuma linha para importar.");
      return;
    }

    // Resolve cardId per row using "card" column when possible, else default
    const cardByName = new Map(cards.map((c) => [norm(c.name), c.id]));
    const imported: ImportedRow[] = rows.map((r) => {
      const cName = r.card ? norm(r.card) : "";
      const cardId = (cName && cardByName.get(cName)) || defaultCardId;
      const purchaseDate = parseDate(r.purchase_date);
      const totalAmount = parseAmount(r.total_amount);
      const installmentsCount = Math.max(1, parseInt(r.installments_count || "1") || 1);
      const installmentNumber = r.installment_number ? parseInt(r.installment_number) : undefined;
      const installmentAmount = r.installment_amount ? parseAmount(r.installment_amount) : undefined;
      const installmentDueDate = r.installment_due ? parseDate(r.installment_due) : undefined;
      return {
        description: r.description || "(sem descrição)",
        purchaseDate,
        totalAmount,
        installmentsCount,
        cardId,
        installmentNumber,
        installmentAmount,
        installmentDueDate,
        paid: parsePaid(r.status),
      };
    });

    try {
      await importMut.mutateAsync(imported);
      setSuccess(`Importadas ${rows.length} linhas com sucesso.`);
      setRows([]);
      setHeaders([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao importar.");
    }
  };

  const downloadSample = () => {
    const sample = `descricao;data_compra;valor_total;parcelas;numero_parcela;valor_parcela;data_vencimento;status;cartao
Notebook Dell;2024-03-15;4500,00;10;3;450,00;2024-06-15;nao;Cartão Principal
Geladeira;2024-05-10;3000,00;12;1;250,00;2024-06-10;nao;Cartão Principal
Mercado;2024-04-02;320,50;1;;;;nao;Cartão Principal`;
    const blob = new Blob([sample], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "exemplo-importacao.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 md:py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Importar histórico</h1>
        <p className="mt-2 text-muted-foreground">
          Importe compras antigas (parceladas ou à vista) via CSV. Detectamos automaticamente se o arquivo traz parcelas detalhadas.
        </p>
      </header>

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Cartão padrão (fallback)</span>
            <select
              className="w-full rounded-lg border border-input bg-input px-3 py-2.5 text-sm outline-none focus:border-primary"
              value={defaultCardId}
              onChange={(e) => setDefaultCardId(e.target.value)}
            >
              <option value="">Selecione um cartão…</option>
              {cards.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Usado quando a coluna <code>cartao</code> não bater com nenhum cartão cadastrado.
            </p>
          </label>

          <div className="flex flex-col justify-end">
            <button
              onClick={downloadSample}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium hover:bg-secondary"
            >
              <Download className="h-4 w-4" /> Baixar CSV de exemplo
            </button>
          </div>
        </div>

        <label className="mt-5 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-background/50 p-10 text-center transition-colors hover:border-primary">
          <Upload className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Clique ou arraste um arquivo .csv</p>
          <p className="text-xs text-muted-foreground">Codificação UTF-8, separador vírgula</p>
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
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

        {rows.length > 0 && (
          <div className="mt-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-primary" />
                <span className="font-semibold">{rows.length}</span>
                <span className="text-muted-foreground">linhas detectadas</span>
                <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  detected ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"
                }`}>
                  {detected ? "Modo: linha-âncora (gera N parcelas por linha)" : "Modo: gerar parcelas pela data de compra"}
                </span>
              </div>
              <button
                onClick={submit}
                disabled={importMut.isPending}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {importMut.isPending ? "Importando…" : `Importar ${rows.length} linhas`}
              </button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="bg-secondary/50">
                  <tr>
                    {headers.map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 10).map((r, idx) => (
                    <tr key={idx} className="border-t border-border">
                      {headers.map((h) => (
                        <td key={h} className="px-3 py-1.5 text-muted-foreground">{r[h]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 10 && (
                <p className="border-t border-border bg-secondary/30 px-3 py-2 text-center text-[11px] text-muted-foreground">
                  Mostrando 10 de {rows.length} linhas — todas serão importadas.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-sm font-semibold">Formato esperado</h2>
        <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
          <li>• Obrigatórios: <code className="text-foreground">descricao</code>, <code className="text-foreground">data_compra</code>, <code className="text-foreground">valor_total</code>, <code className="text-foreground">parcelas</code>, <code className="text-foreground">cartao</code></li>
          <li>• Opcionais: <code className="text-foreground">numero_parcela</code>, <code className="text-foreground">data_vencimento</code>, <code className="text-foreground">status</code> (<code>pago</code> / <code>nao</code>)</li>
          <li>• Delimitador <code>,</code> ou <code>;</code> (detectado automaticamente)</li>
        </ul>
        <div className="mt-3 space-y-2 text-xs text-muted-foreground">
          <p>
            <strong className="text-foreground">Cada linha = 1 compra completa.</strong> O sistema gera todas as N parcelas automaticamente, divididas igualmente (último ajuste de centavos na parcela final).
          </p>
          <p>
            <strong className="text-foreground">Modo linha-âncora</strong> (com <code>numero_parcela</code>): a parcela informada cai no mês de <code>data_vencimento</code> (ou <code>data_compra</code> se ausente). Parcelas anteriores caem nos meses passados e ficam <strong className="text-foreground">marcadas como pagas</strong>. As seguintes vão para os meses futuros.
          </p>
          <p>
            <strong className="text-foreground">Modo data de compra</strong> (sem <code>numero_parcela</code>): usa a regra de fechamento/vencimento do cartão para distribuir as parcelas a partir da próxima fatura.
          </p>
          <p>
            Você pode ajustar o status (pago / não pago) de qualquer parcela manualmente depois.
          </p>
        </div>
      </div>
    </div>
  );
}
