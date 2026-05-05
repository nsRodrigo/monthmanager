/**
 * Lógica do módulo de Imposto de Renda (IRPF).
 *
 * - Tipos compartilhados.
 * - Parsing de CSV/XLSX em entries normalizadas.
 * - Classificação heurística por descrição.
 * - Mapa de "fichas" da Receita para instruções de declaração.
 *
 * IMPORTANTE: parse manual de datas (sem `new Date(string)`), seguindo a
 * convenção do app para evitar deslocamento de fuso.
 */
import * as XLSX from "xlsx";
import Papa from "papaparse";

export type IrpfCategory =
  | "tributavel"
  | "isento"
  | "exclusiva"
  | "bens_direitos"
  | "dividas"
  | "nao_classificado";

export const CATEGORY_LABEL: Record<IrpfCategory, string> = {
  tributavel: "Rendimentos Tributáveis",
  isento: "Rendimentos Isentos",
  exclusiva: "Tributação Exclusiva",
  bens_direitos: "Bens e Direitos",
  dividas: "Dívidas e Ônus",
  nao_classificado: "Não classificado",
};

export const CATEGORY_OPTIONS: { value: IrpfCategory; label: string }[] = (
  Object.keys(CATEGORY_LABEL) as IrpfCategory[]
).map((k) => ({ value: k, label: CATEGORY_LABEL[k] }));

export type IrpfDocument = {
  id: string;
  year: number;
  kind: string;
  filePath: string;
  originalName: string;
  mime: string | null;
  size: number | null;
  uploadedAt: string;
};

export type IrpfEntry = {
  id: string;
  documentId: string | null;
  date: string | null;
  description: string;
  amount: number;
  source: string | null;
  category: IrpfCategory;
  subcategory: string | null;
  year: number;
};

export type IrpfYearSnapshot = {
  id: string;
  year: number;
  accountId: string | null;
  investmentId: string | null;
  label: string;
  value: number;
};

// =====================================================
// Parsing
// =====================================================

export type ParsedRow = {
  date: string | null;
  description: string;
  amount: number;
  raw: Record<string, unknown>;
};

const parseAmount = (v: unknown): number => {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  let s = String(v).trim().replace(/[^\d.,-]/g, "");
  if (!s) return 0;
  if (s.includes(",") && (!s.includes(".") || s.lastIndexOf(",") > s.lastIndexOf("."))) {
    s = s.replace(/\./g, "").replace(",", ".");
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

const parseDateStr = (v: unknown): string | null => {
  if (!v) return null;
  if (v instanceof Date) {
    return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, "0")}-${String(v.getUTCDate()).padStart(2, "0")}`;
  }
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    return null;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (m) {
    let y = m[3];
    if (y.length === 2) y = "20" + y;
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
};

const findKey = (row: Record<string, unknown>, candidates: RegExp[]): string | null => {
  const keys = Object.keys(row);
  for (const re of candidates) {
    const k = keys.find((x) => re.test(x));
    if (k) return k;
  }
  return null;
};

function normalizeRows(records: Record<string, unknown>[]): ParsedRow[] {
  if (records.length === 0) return [];
  const sample = records[0];
  const dateKey = findKey(sample, [/data/i, /date/i, /^dt/i]);
  const descKey = findKey(sample, [
    /descri/i,
    /hist/i,
    /detalh/i,
    /memo/i,
    /lançamento/i,
    /lancamento/i,
    /description/i,
  ]);
  const amountKey = findKey(sample, [
    /valor/i,
    /amount/i,
    /vlr/i,
    /quantia/i,
    /credito|crédito/i,
    /debito|débito/i,
  ]);

  return records
    .map((r) => {
      const date = dateKey ? parseDateStr(r[dateKey]) : null;
      const description = descKey ? String(r[descKey] ?? "").trim() : "";
      const amount = amountKey ? parseAmount(r[amountKey]) : 0;
      return { date, description, amount, raw: r };
    })
    .filter((r) => r.description || r.amount !== 0);
}

export async function parseCsvFile(file: File): Promise<ParsedRow[]> {
  const text = await file.text();
  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  return normalizeRows(result.data || []);
}

export async function parseXlsxFile(file: File): Promise<ParsedRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { cellDates: true });
  const all: ParsedRow[] = [];
  for (const sn of wb.SheetNames) {
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sn], {
      defval: null,
    });
    all.push(...normalizeRows(json));
  }
  return all;
}

export async function parseAnyFile(file: File): Promise<ParsedRow[]> {
  const ext = file.name.toLowerCase().split(".").pop() || "";
  if (ext === "csv" || file.type.includes("csv")) return parseCsvFile(file);
  if (ext === "xlsx" || ext === "xls" || file.type.includes("sheet")) return parseXlsxFile(file);
  // PDF / outros: não processamos no MVP
  return [];
}

// =====================================================
// Classificação heurística
// =====================================================

type Rule = {
  re: RegExp;
  category: IrpfCategory;
  subcategory: string;
};

const RULES: Rule[] = [
  // Tributáveis
  { re: /sal[áa]rio|provent|folha\s*pgto|holerite|remunera/i, category: "tributavel", subcategory: "Salário" },
  { re: /pro\s*-?\s*labore|pro\s*labore/i, category: "tributavel", subcategory: "Pró-labore" },
  { re: /aluguel\s*recebido|loca[çc][ãa]o\s*receb/i, category: "tributavel", subcategory: "Aluguel recebido" },
  { re: /inss|aposentadoria|pens[ãa]o/i, category: "tributavel", subcategory: "INSS / Aposentadoria" },
  { re: /freela|honor[áa]rio|servi[çc]o\s*prestado|nota\s*fiscal|rps/i, category: "tributavel", subcategory: "Serviços prestados / Freelance" },

  // Isentos
  { re: /poupan[çc]a|rendimento\s*poupan/i, category: "isento", subcategory: "Rendimentos de poupança" },
  { re: /transfer[êe]ncia\s*entre\s*contas|transf\s*propria|transf[\s-]+mesma\s*titularidade/i, category: "isento", subcategory: "Transferência entre contas próprias" },
  { re: /dividendo/i, category: "isento", subcategory: "Dividendos isentos" },
  { re: /lci|lca/i, category: "isento", subcategory: "LCI/LCA" },
  { re: /fgts/i, category: "isento", subcategory: "FGTS" },

  // Tributação Exclusiva
  { re: /\bcdb\b|tesouro|fundo\s*di|fundo\s*renda\s*fixa|rendimento\s*aplica/i, category: "exclusiva", subcategory: "Aplicações financeiras (CDB / Tesouro / Fundos)" },
  { re: /13[ºo°]\s*sal[áa]rio|d[ée]cimo\s*terceiro/i, category: "exclusiva", subcategory: "13º salário" },
  { re: /jcp|juros\s*sobre\s*capital/i, category: "exclusiva", subcategory: "JCP" },

  // Bens e Direitos (movimentações de aquisição)
  { re: /a[çc][ãa]o[s]?\s*compra|compra\s*de\s*a[çc][ãa]o|b3|bovespa/i, category: "bens_direitos", subcategory: "Ações" },
  { re: /im[óo]vel|escritura|cart[óo]rio\s*registro/i, category: "bens_direitos", subcategory: "Imóvel" },
  { re: /ve[íi]culo|carro|moto|detran|despachante/i, category: "bens_direitos", subcategory: "Veículo" },

  // Dívidas
  { re: /empr[ée]stimo|financ[ie]amento|consign|cr[ée]dito\s*pessoal/i, category: "dividas", subcategory: "Empréstimo / Financiamento" },
];

export function classifyDescription(description: string): { category: IrpfCategory; subcategory: string | null } {
  const desc = (description || "").toLowerCase();
  for (const r of RULES) {
    if (r.re.test(desc)) return { category: r.category, subcategory: r.subcategory };
  }
  return { category: "nao_classificado", subcategory: null };
}

// =====================================================
// Fichas da Receita (instruções de declaração)
// =====================================================

export type FichaInstrucao = {
  ficha: string;
  grupo?: string;
  codigo?: string;
  descricao: string;
};

export function fichaForSubcategory(category: IrpfCategory, subcategory: string | null): FichaInstrucao {
  switch (category) {
    case "tributavel":
      if (/sal[áa]rio|13|pro/i.test(subcategory || ""))
        return { ficha: "Rendimentos Tributáveis Recebidos de PJ", descricao: "Informe o CNPJ da fonte pagadora e os valores do informe de rendimentos." };
      if (/aluguel/i.test(subcategory || ""))
        return { ficha: "Rendimentos Tributáveis de PF / Exterior", codigo: "Aluguel", descricao: "Aluguéis recebidos no ano. Informar mês a mês no Carnê-Leão." };
      return { ficha: "Rendimentos Tributáveis de PF", descricao: "Informar mês a mês via Carnê-Leão." };
    case "isento":
      if (/poupan/i.test(subcategory || ""))
        return { ficha: "Rendimentos Isentos e Não Tributáveis", codigo: "12", descricao: "Rendimentos de cadernetas de poupança." };
      if (/transfer/i.test(subcategory || ""))
        return { ficha: "—", descricao: "Não declarar. Apenas movimentação entre contas próprias." };
      if (/lci|lca/i.test(subcategory || ""))
        return { ficha: "Rendimentos Isentos e Não Tributáveis", codigo: "12", descricao: "Rendimentos de LCI/LCA." };
      if (/dividendo/i.test(subcategory || ""))
        return { ficha: "Rendimentos Isentos e Não Tributáveis", codigo: "09", descricao: "Lucros e dividendos recebidos." };
      return { ficha: "Rendimentos Isentos e Não Tributáveis", descricao: "Verificar código apropriado conforme natureza." };
    case "exclusiva":
      if (/13/i.test(subcategory || ""))
        return { ficha: "Rendimentos Sujeitos à Tributação Exclusiva", codigo: "05", descricao: "13º salário." };
      if (/jcp/i.test(subcategory || ""))
        return { ficha: "Rendimentos Sujeitos à Tributação Exclusiva", codigo: "10", descricao: "Juros sobre capital próprio." };
      return { ficha: "Rendimentos Sujeitos à Tributação Exclusiva", codigo: "06", descricao: "Rendimentos de aplicações financeiras." };
    case "bens_direitos":
      if (/a[çc][ãa]o/i.test(subcategory || ""))
        return { ficha: "Bens e Direitos", grupo: "03", codigo: "01", descricao: "Ações (inclusive de companhias). Informe quantidade, corretora e CNPJ." };
      if (/im[óo]vel/i.test(subcategory || ""))
        return { ficha: "Bens e Direitos", grupo: "01", codigo: "11/12", descricao: "Imóvel. Informe endereço, matrícula e data de aquisição." };
      if (/ve[íi]culo/i.test(subcategory || ""))
        return { ficha: "Bens e Direitos", grupo: "02", codigo: "01", descricao: "Veículo automotor. Informe placa, RENAVAM e ano." };
      return { ficha: "Bens e Direitos", grupo: "04", codigo: "01", descricao: "Saldo em conta corrente / poupança em 31/12." };
    case "dividas":
      return { ficha: "Dívidas e Ônus Reais", codigo: "11", descricao: "Empréstimo ou financiamento. Informar credor, CNPJ e saldo devedor em 31/12." };
    default:
      return { ficha: "—", descricao: "Reclassifique manualmente para gerar a instrução correta." };
  }
}
