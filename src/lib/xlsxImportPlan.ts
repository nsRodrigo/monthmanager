/**
 * Converte ParsedEntry[] (saída do xlsxParser) em HistoricalImportPlan
 * (formato consumido por useImportHistorical).
 *
 * REGRA SIMPLIFICADA (2026-04+):
 *  - TODA conta-padrão informada pelo usuário é usada para débitos,
 *    recebimentos, investimentos e como conta-mãe dos cartões.
 *  - Cartões são deduplicados por nome (limpo). Um cartão = uma seção
 *    no formato moderno (ex: "ITAU UNICLASS BLACK CRÉDITO - MASTERCARD").
 *  - NENHUMA conta secundária é criada automaticamente. Se o usuário quer
 *    uma conta separada para Inter, Santander, Carteira etc., ele cadastra
 *    manualmente em Contas e re-importa selecionando-a como destino.
 */
import type { ParsedEntry } from "./xlsxParser";
import type {
  AccountType,
  HistoricalImportEntry,
  HistoricalImportPlan,
} from "@/store/finance";

function cleanCardLabel(label: string): string {
  // Remove sufixos genéricos como " - CRÉDITO", "FATURA ", etc.
  return label
    .replace(/\s*-\s*CR[ÉE]DITO\s*$/i, "")
    .replace(/^FATURA\s+/i, "")
    .trim();
}

export type BuildPlanOptions = {
  approxDayForLegacy?: number; // dia usado quando entry não tem data exata (default 15)
  /**
   * Nome da conta destino. TODOS os lançamentos (débitos, recebimentos,
   * investimentos) e TODOS os cartões serão associados a esta conta.
   * Se a conta não existir, será criada automaticamente como corrente.
   */
  defaultAccountName?: string;
  defaultAccountColor?: string;
  defaultAccountType?: AccountType;
};

function dateInParsedMonth(e: ParsedEntry, approxDay: number): string {
  const dayFromCell = e.date ? Number(e.date.slice(8, 10)) : approxDay;
  const lastDay = new Date(e.year, e.month + 1, 0).getDate();
  const day = Math.min(Math.max(1, dayFromCell || approxDay), lastDay);
  return `${e.year}-${String(e.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function buildImportPlan(
  parsed: ParsedEntry[],
  opts: BuildPlanOptions = {},
): HistoricalImportPlan {
  const approxDay = opts.approxDayForLegacy ?? 15;
  const DEFAULT_ACCOUNT = opts.defaultAccountName?.trim() || "Geral";
  const DEFAULT_ACCOUNT_COLOR = opts.defaultAccountColor || "#8b5cf6";
  const DEFAULT_ACCOUNT_TYPE: AccountType = opts.defaultAccountType || "corrente";

  const cardsMap = new Map<string, { name: string; accountName: string; color: string }>();
  const entries: HistoricalImportEntry[] = [];

  // Única conta criada/usada — a escolhida pelo usuário
  const accountsToCreate = [
    {
      name: DEFAULT_ACCOUNT,
      type: DEFAULT_ACCOUNT_TYPE,
      color: DEFAULT_ACCOUNT_COLOR,
    },
  ];

  // Paleta para cores dos cartões (as contas usam a cor única do default)
  const cardPalette = [
    "#8b5cf6",
    "#06b6d4",
    "#f59e0b",
    "#ef4444",
    "#10b981",
    "#ec4899",
    "#6366f1",
    "#84cc16",
  ];
  let cardColorIdx = 0;

  for (const e of parsed) {
    // A coluna/mês da planilha é a competência real do lançamento.
    // A célula DATA pode ser a data original da compra (meses/anos anteriores),
    // então mantemos o dia, mas forçamos ano/mês detectados pelo parser.
    const dateStr = dateInParsedMonth(e, approxDay);

    if (e.kind === "purchase") {
      // Cartão de crédito: cria 1 cartão por sectionLabel limpo, todos sob a conta default
      const cardName = cleanCardLabel(e.sectionLabel);
      if (!cardsMap.has(cardName.toLowerCase())) {
        cardsMap.set(cardName.toLowerCase(), {
          name: cardName,
          accountName: DEFAULT_ACCOUNT,
          color: cardPalette[cardColorIdx++ % cardPalette.length],
        });
      }
      entries.push({
        kind: "purchase",
        description: e.description,
        amount: e.amount,
        date: dateStr,
        paid: e.paid,
        cardName,
        installmentNumber: e.installmentCurrent ?? undefined,
        installmentTotal: e.installmentTotal ?? undefined,
      });
    } else if (e.kind === "debit") {
      // Débito automático / despesa de conta corrente — vai para a conta default
      entries.push({
        kind: "debit",
        description: e.description,
        amount: e.amount,
        date: dateStr,
        paid: e.paid,
        accountName: DEFAULT_ACCOUNT,
      });
    } else if (e.kind === "income") {
      entries.push({
        kind: "income",
        description: e.description,
        amount: e.amount,
        date: dateStr,
        paid: e.paid,
        accountName: DEFAULT_ACCOUNT,
      });
    } else if (e.kind === "investment") {
      entries.push({
        kind: "investment",
        description: e.description,
        amount: e.amount,
        date: dateStr,
        paid: e.paid,
        accountName: DEFAULT_ACCOUNT,
      });
    }
  }

  return {
    accountsToCreate,
    cardsToCreate: Array.from(cardsMap.values()),
    entries,
  };
}
