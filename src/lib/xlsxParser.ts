/**
 * Parser para a planilha histórica "ACOMPANHAMENTO DE GASTOS E COMPRAS".
 *
 * Suporta dois formatos:
 *  - LEGACY (2014-2021): blocos de 3 meses lado a lado, colunas
 *    [PAGAMENTO | PARC | VALOR | STATUS], sem data exata por linha.
 *  - MODERN (2022+): blocos de 3 meses lado a lado, colunas
 *    [DESCRIÇÃO | DATA | TRANSAÇÃO | PARC | VALOR | STATUS],
 *    com sub-seções por categoria (RECEBIDOS, CARTEIRA, INVESTIMENTO,
 *    ITAU UNICLASS xxx - CRÉDITO, CONTA NUBANK, etc).
 */
import * as XLSX from "xlsx";

const MONTHS_PT = [
  "JANEIRO",
  "FEVEREIRO",
  "MARÇO",
  "MARCO",
  "ABRIL",
  "MAIO",
  "JUNHO",
  "JULHO",
  "AGOSTO",
  "SETEMBRO",
  "OUTUBRO",
  "NOVEMBRO",
  "DEZEMBRO",
];

const MONTH_INDEX: Record<string, number> = {
  JANEIRO: 0,
  FEVEREIRO: 1,
  MARÇO: 2,
  MARCO: 2,
  ABRIL: 3,
  MAIO: 4,
  JUNHO: 5,
  JULHO: 6,
  AGOSTO: 7,
  SETEMBRO: 8,
  OUTUBRO: 9,
  NOVEMBRO: 10,
  DEZEMBRO: 11,
};

export type EntryKind =
  | "purchase" // compra de cartão (pode ser parcelada ou à vista)
  | "debit" // débito de conta corrente
  | "income" // recebimento
  | "investment"; // aplicação/resgate

export type SectionKind =
  | "RECEBIDOS"
  | "CARTEIRA"
  | "INVESTIMENTO"
  | "CREDITO" // qualquer cartão
  | "CONTA"; // conta caixa/nubank/mp etc

export type ParsedEntry = {
  year: number;
  month: number; // 0-11
  description: string;
  date: string | null; // YYYY-MM-DD ou null se não havia data
  transaction: string | null;
  installmentCurrent: number | null;
  installmentTotal: number | null;
  amount: number;
  paid: boolean;
  rawStatus: string;
  kind: EntryKind;
  // identificador da seção dentro do mês (ex: "ITAU UNICLASS BLACK - CRÉDITO" ou "RECEBIDOS")
  sectionLabel: string;
  sectionKind: SectionKind;
  sourceRow: number; // linha original na planilha (1-indexed)
};

export type ParseResult = {
  sheetName: string;
  entries: ParsedEntry[];
  yearsDetected: number[];
  warnings: string[];
};

// ---------- helpers ----------

const norm = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  return String(v).trim();
};

const upper = (v: unknown): string => norm(v).toUpperCase();

const parseAmount = (v: unknown): number => {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  let s = String(v).trim().replace(/[^\d.,-]/g, "");
  if (!s) return 0;
  // Detecta formato pt-BR: "1.234,56" → tem vírgula como separador decimal
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  }
  // Senão, é formato US/já-numérico: "1234.56" → mantém ponto
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

const parseDateCell = (v: unknown): string | null => {
  if (v === null || v === undefined || v === "" || v === "-") return null;
  if (v instanceof Date) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  }
  if (typeof v === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(v);
    if (d) {
      return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    }
    return null;
  }
  const s = String(v).trim();
  // ISO-ish
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // dd/mm/yyyy or dd-mm-yyyy
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (m) {
    let y = m[3];
    if (y.length === 2) y = "20" + y;
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
};

/**
 * Parser de PARC. Aceita:
 *   "01/12"        → 1 de 12
 *   "01 de 12"     → 1 de 12
 *   "02-03/10"     → 2 de 10  (parcela dupla, retornamos a primeira)
 *   "12"           → 12 de 12 (apenas total quando vier sozinho? ambíguo, ignoramos)
 *   "-"            → null
 *   ""             → null
 *   datas tipo "05/04/2015" → null (vai cair em PARC mas é uma data, ignoramos)
 */
const parseParc = (v: unknown): { current: number | null; total: number | null } => {
  const s = norm(v).toLowerCase();
  if (!s || s === "-") return { current: null, total: null };
  // formato "01 de 12"
  let m = s.match(/^(\d{1,3})\s*de\s*(\d{1,3})$/);
  if (m) return { current: parseInt(m[1]), total: parseInt(m[2]) };
  // formato "01-02/10" ou "02-03/10"
  m = s.match(/^(\d{1,3})\s*-\s*(\d{1,3})\s*\/\s*(\d{1,3})$/);
  if (m) return { current: parseInt(m[1]), total: parseInt(m[3]) };
  // formato "01/12"
  m = s.match(/^(\d{1,3})\s*\/\s*(\d{1,3})$/);
  if (m) {
    const a = parseInt(m[1]);
    const b = parseInt(m[2]);
    // se a > 31 e b > 31 e tem formato data dd/mm, ignorar
    // mas com /YYYY (4 dígitos) já é data
    return { current: a, total: b };
  }
  // formato "01/12/2015" - é uma data, não parcela
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)) return { current: null, total: null };
  return { current: null, total: null };
};

const parsePaid = (v: unknown): boolean => {
  const s = upper(v);
  if (!s) return false;
  if (s === "TRUE" || s === "VERDADEIRO") return true;
  if (s === "FALSE" || s === "FALSO") return false;
  return ["PAGO", "PAID", "RECEBIDO", "RECEBIDOS", "OK", "SIM", "S", "Y", "YES"].includes(s);
};

// ---------- main ----------

type Cell = unknown;
type Grid = Cell[][];

export function parseHistoricalWorkbook(file: ArrayBuffer): ParseResult[] {
  const wb = XLSX.read(file, { cellDates: true });
  return wb.SheetNames.map((name) => parseSheet(name, wb.Sheets[name]));
}

function parseSheet(sheetName: string, sheet: XLSX.WorkSheet): ParseResult {
  const grid: Grid = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    blankrows: true,
    defval: null,
  });

  const entries: ParsedEntry[] = [];
  const warnings: string[] = [];
  const yearsDetected = new Set<number>();

  // 1) Identificar blocos de ano: linhas com "ACOMPANHAMENTO ... | YYYY"
  const yearMarkers: { row: number; year: number }[] = [];
  for (let r = 0; r < grid.length; r++) {
    for (const cell of grid[r]) {
      const s = norm(cell);
      const m = s.match(/ACOMPANHAMENTO.*?(\d{4})/i);
      if (m) {
        yearMarkers.push({ row: r, year: parseInt(m[1]) });
        yearsDetected.add(parseInt(m[1]));
        break;
      }
    }
  }

  if (yearMarkers.length === 0) {
    warnings.push(`Aba "${sheetName}": nenhum cabeçalho de ano encontrado.`);
    return { sheetName, entries, yearsDetected: [], warnings };
  }

  // Para cada ano, processar até o próximo marcador
  for (let yi = 0; yi < yearMarkers.length; yi++) {
    const start = yearMarkers[yi].row;
    const end = yi + 1 < yearMarkers.length ? yearMarkers[yi + 1].row : grid.length;
    const year = yearMarkers[yi].year;
    parseYearBlock(grid, start, end, year, sheetName, entries, warnings);
  }

  return {
    sheetName,
    entries,
    yearsDetected: Array.from(yearsDetected).sort(),
    warnings,
  };
}

/**
 * Dentro de um bloco de ano, descobrir as colunas-âncora dos meses.
 * O layout é repetido em "trimestres": 3 meses lado a lado, cada mês
 * ocupando 4 ou 6 colunas dependendo do formato.
 *
 * Estratégia: percorrer linhas procurando cabeçalhos com "PAGAMENTO" ou
 * "DESCRIÇÃO" — registramos cada coluna onde aparecem; cada coluna inicia
 * um "slot de mês". Em paralelo, procuramos rótulos de mês ("JANEIRO" etc)
 * para mapear slot → mês. Linhas posteriores (até o próximo cabeçalho ou
 * próximo trimestre) são as entradas.
 */
function parseYearBlock(
  grid: Grid,
  start: number,
  end: number,
  year: number,
  sheetName: string,
  entries: ParsedEntry[],
  warnings: string[],
): void {
  // Percorre o bloco em "frames" delimitados por linhas de cabeçalho
  // (PAGAMENTO/DESCRIÇÃO). Cada frame tem N slots (colunas-âncora) e
  // cada slot está associado a um mês (descoberto por linhas TOTAL ou
  // por contagem trimestral).
  let monthCursor = 0; // 0..11 — avança quando encontramos novo trimestre

  for (let r = start; r < end; r++) {
    const row = grid[r] || [];
    // Detectar cabeçalho
    const headerSlots = findHeaderSlots(row);
    if (headerSlots.length === 0) continue;

    const isModern = headerSlots[0].kind === "MODERN";
    const slotWidth = isModern ? 6 : 4;

    // Para cada slot, descobrir o mês olhando na linha TOTAL (mais confiável)
    // ou usando o cursor trimestral.
    const slotMonths: number[] = [];
    // Procura "TOTAL" linha algumas linhas abaixo
    const totalRow = findTotalRow(grid, r, end, headerSlots, slotWidth);
    if (totalRow >= 0) {
      for (let i = 0; i < headerSlots.length; i++) {
        const startCol = headerSlots[i].col;
        // O nome do mês geralmente está na coluna anterior à "Total" (dentro do mesmo slot)
        const m = findMonthInRange(grid[totalRow], startCol, startCol + slotWidth);
        slotMonths.push(m >= 0 ? m : monthCursor + i);
      }
    } else {
      for (let i = 0; i < headerSlots.length; i++) {
        slotMonths.push(monthCursor + i);
      }
    }

    // Avança cursor de trimestre
    monthCursor = Math.max(...slotMonths) + 1;
    if (monthCursor > 12) monthCursor = 0;

    // Detecta o fim do frame (próximo cabeçalho ou próximo trimestre)
    let frameEnd = end;
    for (let rr = r + 1; rr < end; rr++) {
      const sub = grid[rr] || [];
      if (findHeaderSlots(sub).length > 0) {
        frameEnd = rr;
        break;
      }
      // se encontramos novo "ACOMPANHAMENTO", também para
      if (sub.some((c) => /ACOMPANHAMENTO/i.test(norm(c)))) {
        frameEnd = rr;
        break;
      }
    }

    // Para cada slot, parsear suas entradas
    for (let i = 0; i < headerSlots.length; i++) {
      const slotCol = headerSlots[i].col;
      const slotMonth = slotMonths[i];
      if (slotMonth < 0 || slotMonth > 11) continue;

      parseSlot(
        grid,
        r + 1,
        frameEnd,
        slotCol,
        slotWidth,
        isModern,
        year,
        slotMonth,
        sheetName,
        entries,
        warnings,
      );
    }

    // pula até o fim do frame
    r = frameEnd - 1;
  }
}

type HeaderSlot = { col: number; kind: "MODERN" | "LEGACY" };

/**
 * Detecta cabeçalhos PAGAMENTO/DESCRIÇÃO numa linha.
 * Retorna a coluna inicial de cada slot (pode haver 1, 2 ou 3 slots).
 */
function findHeaderSlots(row: Cell[]): HeaderSlot[] {
  const slots: HeaderSlot[] = [];
  for (let c = 0; c < row.length; c++) {
    const s = upper(row[c]);
    if (s === "PAGAMENTO" || s === "VALE") {
      // legacy: PAGAMENTO | PARC | VALOR | STATUS
      const next = upper(row[c + 1]);
      const next2 = upper(row[c + 2]);
      if ((next === "PARC" || next === "PARC.") && (next2 === "VALOR" || next2 === "VALOR ")) {
        slots.push({ col: c, kind: "LEGACY" });
      }
    } else if (s === "DESCRIÇÃO" || s === "DESCRICAO") {
      // modern: DESCRIÇÃO | DATA | TRANSAÇÃO | PARC | VALOR | STATUS
      const next = upper(row[c + 1]);
      if (next === "DATA") {
        slots.push({ col: c, kind: "MODERN" });
      }
    }
  }
  return slots;
}

/** Procura uma linha "TOTAL" alguns passos abaixo (typically ~15-20 rows). */
function findTotalRow(grid: Grid, from: number, to: number, slots: HeaderSlot[], width: number): number {
  const limit = Math.min(to, from + 80);
  for (let r = from + 1; r < limit; r++) {
    const row = grid[r] || [];
    for (const slot of slots) {
      const range = row.slice(slot.col, slot.col + width);
      if (range.some((c) => upper(c) === "TOTAL")) return r;
    }
  }
  return -1;
}

function findMonthInRange(row: Cell[], from: number, to: number): number {
  for (let c = from; c < to; c++) {
    const s = upper(row[c]);
    const cleaned = s.replace(/\s+/g, "");
    if (MONTH_INDEX[cleaned] !== undefined) return MONTH_INDEX[cleaned];
    for (const mn of MONTHS_PT) {
      if (cleaned === mn) return MONTH_INDEX[mn];
    }
  }
  return -1;
}

/**
 * Parser para um slot de mês específico.
 * Detecta sub-seções (RECEBIDOS, CARTEIRA, etc) no formato moderno.
 */
function parseSlot(
  grid: Grid,
  rStart: number,
  rEnd: number,
  col: number,
  width: number,
  isModern: boolean,
  year: number,
  month: number,
  sheetName: string,
  entries: ParsedEntry[],
  warnings: string[],
): void {
  let currentSection: { label: string; kind: SectionKind } = isModern
    ? { label: "DESPESAS", kind: "CONTA" }
    : { label: sheetName, kind: "CREDITO" }; // legacy: por padrão é cartão (a aba é "ITAU")

  for (let r = rStart; r < rEnd; r++) {
    const row = grid[r] || [];
    const desc = norm(row[col]);
    const upDesc = desc.toUpperCase();

    // pular linhas vazias
    if (!desc) continue;

    // se for outro cabeçalho (PAGAMENTO/DESCRIÇÃO), parar
    if (
      upDesc === "PAGAMENTO" ||
      upDesc === "DESCRIÇÃO" ||
      upDesc === "DESCRICAO" ||
      upDesc === "VALE"
    ) {
      return;
    }

    // detectar linha "TOTAL" (de mês ou de sub-seção)
    const isTotalRow = (() => {
      for (let c = col; c < Math.min(col + width, row.length); c++) {
        if (upper(row[c]) === "TOTAL") return true;
      }
      return false;
    })();

    // Detectar sub-seção (apenas no formato moderno).
    // IMPORTANTE: cabeçalhos de sub-seção sempre têm "TOTAL" na mesma linha
    // (ex: "RECEBIDOS ... TOTAL 7495.11"). Exigir essa coexistência reduz
    // falsos positivos com descrições reais.
    if (isModern && isTotalRow && isSectionHeader(upDesc)) {
      currentSection = classifySection(upDesc);
      continue;
    }

    if (isTotalRow) continue;

    // Pular se a linha é só um nome de mês (rótulo de total trimestral)
    const cleaned = upDesc.replace(/\s+/g, "");
    if (MONTH_INDEX[cleaned] !== undefined) continue;

    // Parse entrada
    const entry = isModern
      ? parseModernRow(row, col, year, month, currentSection, r + 1)
      : parseLegacyRow(row, col, year, month, sheetName, r + 1);

    if (entry) entries.push(entry);
  }
}

const SECTION_PATTERNS: Array<{ re: RegExp; kind: SectionKind; cleanup?: (s: string) => string }> = [
  { re: /^RECEBIDO/i, kind: "RECEBIDOS" },
  { re: /^CARTEIRA/i, kind: "CARTEIRA" },
  { re: /^INVESTIMENTO/i, kind: "INVESTIMENTO" },
  { re: /CRÉDITO|CREDITO/i, kind: "CREDITO" },
  { re: /^FATURA\s+/i, kind: "CREDITO" },
  { re: /^CONTA\s+/i, kind: "CONTA" },
  { re: /UNICLASS|BLACK|PLATINUM|SIGNATURE|SAMSUNG|VISA|MASTERCARD/i, kind: "CREDITO" },
];

function isSectionHeader(upDesc: string): boolean {
  // Cabeçalhos que conhecemos (não devem virar entradas).
  // Alguns aparecem com a palavra "TOTAL" na mesma linha — capturamos isso à parte.
  return SECTION_PATTERNS.some((p) => p.re.test(upDesc));
}

function classifySection(upDesc: string): { label: string; kind: SectionKind } {
  for (const p of SECTION_PATTERNS) {
    if (p.re.test(upDesc)) {
      return { label: upDesc, kind: p.kind };
    }
  }
  return { label: upDesc, kind: "CONTA" };
}

function entryKindFromSection(kind: SectionKind): EntryKind {
  switch (kind) {
    case "RECEBIDOS":
      return "income";
    case "INVESTIMENTO":
      return "investment";
    case "CARTEIRA":
      return "debit";
    case "CREDITO":
      return "purchase";
    case "CONTA":
      return "debit";
  }
}

function parseModernRow(
  row: Cell[],
  col: number,
  year: number,
  month: number,
  section: { label: string; kind: SectionKind },
  sourceRow: number,
): ParsedEntry | null {
  // Layout: DESCRIÇÃO | DATA | TRANSAÇÃO | PARC | VALOR | STATUS
  const description = norm(row[col]);
  const date = parseDateCell(row[col + 1]);
  const transaction = norm(row[col + 2]) || null;
  const parc = parseParc(row[col + 3]);
  const amount = parseAmount(row[col + 4]);
  const paid = parsePaid(row[col + 5]);
  const rawStatus = norm(row[col + 5]);

  if (!description || amount === 0) return null;
  // Ignorar linhas que são apenas continuação textual (sem valor)
  if (!amount) return null;

  return {
    year,
    month,
    description,
    date,
    transaction,
    installmentCurrent: parc.current,
    installmentTotal: parc.total,
    amount,
    paid,
    rawStatus,
    kind: entryKindFromSection(section.kind),
    sectionLabel: section.label,
    sectionKind: section.kind,
    sourceRow,
  };
}

function parseLegacyRow(
  row: Cell[],
  col: number,
  year: number,
  month: number,
  sheetName: string,
  sourceRow: number,
): ParsedEntry | null {
  // Layout: PAGAMENTO | PARC | VALOR | STATUS
  // Mas variações ocorrem: às vezes PARC vira data e VALOR pula uma coluna.
  const description = norm(row[col]);
  let parcCell: unknown = row[col + 1];
  let amount = parseAmount(row[col + 2]);
  let statusCell: unknown = row[col + 3];

  // Se o "parc" for uma data e o "amount" for 0, tentar shift
  if (amount === 0) {
    const tryAmount = parseAmount(row[col + 3]);
    if (tryAmount > 0) {
      // shift: PARC=data, depois algo, depois VALOR
      amount = tryAmount;
      parcCell = row[col + 2]; // talvez tenha info de parcela ali
      statusCell = row[col + 4];
    }
  }

  const parc = parseParc(parcCell);
  const paid = parsePaid(statusCell);
  const rawStatus = norm(statusCell);

  if (!description || amount === 0) return null;

  return {
    year,
    month,
    description,
    date: null, // legacy não tem data exata
    transaction: null,
    installmentCurrent: parc.current,
    installmentTotal: parc.total,
    amount,
    paid,
    rawStatus,
    kind: "purchase", // assumimos cartão por default no legacy (aba "ITAU")
    sectionLabel: sheetName,
    sectionKind: "CREDITO",
    sourceRow,
  };
}

// =====================================================================
// Sumarização e mapeamento auxiliar para a tela de preview
// =====================================================================

export type SectionGroup = {
  key: string; // sectionLabel normalizado
  label: string;
  kind: SectionKind;
  count: number;
  total: number;
};

export function summarizeSections(entries: ParsedEntry[]): SectionGroup[] {
  const map = new Map<string, SectionGroup>();
  for (const e of entries) {
    const key = e.sectionLabel;
    const cur = map.get(key);
    if (cur) {
      cur.count++;
      cur.total += e.amount;
    } else {
      map.set(key, {
        key,
        label: e.sectionLabel,
        kind: e.sectionKind,
        count: 1,
        total: e.amount,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export function summarizeByYearMonth(entries: ParsedEntry[]): Map<number, Map<number, number>> {
  const out = new Map<number, Map<number, number>>();
  for (const e of entries) {
    if (!out.has(e.year)) out.set(e.year, new Map());
    const m = out.get(e.year)!;
    m.set(e.month, (m.get(e.month) || 0) + e.amount);
  }
  return out;
}
