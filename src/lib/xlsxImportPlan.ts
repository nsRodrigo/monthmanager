/**
 * Converte ParsedEntry[] (saída do xlsxParser) em HistoricalImportPlan
 * (formato consumido por useImportHistorical).
 *
 * Estratégia de mapeamento:
 *  - Cada SECTION do tipo CONTA / CARTEIRA  → uma conta (ex: "CONTA NUBANK", "CARTEIRA")
 *  - Cada SECTION do tipo CREDITO          → um cartão (a conta é inferida pelo prefixo, ou cai numa conta default "Itaú")
 *  - RECEBIDOS                             → income, na conta default
 *  - INVESTIMENTO                          → investment, na conta default
 */
import type { ParsedEntry } from "./xlsxParser";
import type {
  AccountType,
  HistoricalImportEntry,
  HistoricalImportPlan,
} from "@/store/finance";

const BANK_KEYWORDS = [
  { re: /ITA[ÚU]/i, account: "Itaú", color: "#EC7000" },
  { re: /NUBANK|NU\s*BANK/i, account: "Nubank", color: "#8A05BE" },
  { re: /CAIXA/i, account: "Caixa", color: "#005CA9" },
  { re: /BRADESCO/i, account: "Bradesco", color: "#CC092F" },
  { re: /SANTANDER/i, account: "Santander", color: "#EC0000" },
  { re: /MERCADO\s*PAGO|MP\b/i, account: "Mercado Pago", color: "#00B1EA" },
  { re: /INTER/i, account: "Inter", color: "#FF7A00" },
  { re: /C6/i, account: "C6", color: "#000000" },
];

const CARD_KEYWORDS = [
  /UNICLASS/i,
  /BLACK/i,
  /PLATINUM/i,
  /SIGNATURE/i,
  /SAMSUNG/i,
  /VISA/i,
  /MASTERCARD/i,
  /MULTIPL/i,
  /GOLD/i,
];

function inferBank(label: string): { account: string; color: string } | null {
  for (const k of BANK_KEYWORDS) {
    if (k.re.test(label)) return { account: k.account, color: k.color };
  }
  return null;
}

function isCardLabel(label: string): boolean {
  return CARD_KEYWORDS.some((re) => re.test(label));
}

function cleanCardLabel(label: string): string {
  // Remove sufixos genéricos como " - CRÉDITO", "FATURA ", etc.
  return label
    .replace(/\s*-\s*CR[ÉE]DITO\s*$/i, "")
    .replace(/^FATURA\s+/i, "")
    .trim();
}

function pickColor(idx: number): string {
  const palette = [
    "#8b5cf6",
    "#06b6d4",
    "#f59e0b",
    "#ef4444",
    "#10b981",
    "#ec4899",
    "#6366f1",
    "#84cc16",
  ];
  return palette[idx % palette.length];
}

export type BuildPlanOptions = {
  approxDayForLegacy?: number; // dia usado quando entry não tem data exata (default 15)
};

export function buildImportPlan(
  parsed: ParsedEntry[],
  opts: BuildPlanOptions = {},
): HistoricalImportPlan {
  const approxDay = opts.approxDayForLegacy ?? 15;

  const accountsMap = new Map<string, { name: string; type: AccountType; color: string }>();
  const cardsMap = new Map<string, { name: string; accountName: string; color: string }>();
  const entries: HistoricalImportEntry[] = [];

  // Conta padrão para fallback (RECEBIDOS, INVESTIMENTO sem banco identificado)
  const DEFAULT_ACCOUNT = "Geral";
  accountsMap.set(DEFAULT_ACCOUNT.toLowerCase(), {
    name: DEFAULT_ACCOUNT,
    type: "corrente",
    color: "#8b5cf6",
  });

  let colorIdx = 0;

  for (const e of parsed) {
    // Determina data
    let dateStr = e.date;
    if (!dateStr) {
      const day = Math.min(approxDay, 28);
      dateStr = `${e.year}-${String(e.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }

    if (e.kind === "purchase") {
      // Section vira cartão
      const cardName = cleanCardLabel(e.sectionLabel);
      // Banco a partir da label
      const bank = inferBank(e.sectionLabel);
      const accountName = bank?.account ?? DEFAULT_ACCOUNT;
      const accountColor = bank?.color ?? pickColor(colorIdx++);

      if (!accountsMap.has(accountName.toLowerCase())) {
        accountsMap.set(accountName.toLowerCase(), {
          name: accountName,
          type: "corrente",
          color: accountColor,
        });
      }
      if (!cardsMap.has(cardName.toLowerCase())) {
        cardsMap.set(cardName.toLowerCase(), {
          name: cardName,
          accountName,
          color: accountColor,
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
      // Section vira conta (ou banco)
      const bank = inferBank(e.sectionLabel);
      let accountName = bank?.account;
      if (!accountName) {
        // Se a label parece ser um banco/conta (CONTA xxx, CARTEIRA), usa
        if (/^CONTA\s+/i.test(e.sectionLabel)) {
          accountName = e.sectionLabel.replace(/^CONTA\s+/i, "").trim();
        } else if (/CARTEIRA/i.test(e.sectionLabel)) {
          accountName = "Carteira";
        } else {
          accountName = DEFAULT_ACCOUNT;
        }
      }
      if (!accountsMap.has(accountName.toLowerCase())) {
        accountsMap.set(accountName.toLowerCase(), {
          name: accountName,
          type: /CARTEIRA/i.test(accountName) ? "carteira" : "corrente",
          color: bank?.color ?? pickColor(colorIdx++),
        });
      }
      entries.push({
        kind: "debit",
        description: e.description,
        amount: e.amount,
        date: dateStr,
        paid: e.paid,
        accountName,
      });
    } else if (e.kind === "income") {
      const accountName = DEFAULT_ACCOUNT;
      entries.push({
        kind: "income",
        description: e.description,
        amount: e.amount,
        date: dateStr,
        paid: e.paid,
        accountName,
      });
    } else if (e.kind === "investment") {
      const accountName = "Investimentos";
      if (!accountsMap.has(accountName.toLowerCase())) {
        accountsMap.set(accountName.toLowerCase(), {
          name: accountName,
          type: "investimento",
          color: "#10b981",
        });
      }
      entries.push({
        kind: "investment",
        description: e.description,
        amount: e.amount,
        date: dateStr,
        paid: e.paid,
        accountName,
      });
    }

    // Marca para descartar warning não usado
    void isCardLabel;
  }

  return {
    accountsToCreate: Array.from(accountsMap.values()),
    cardsToCreate: Array.from(cardsMap.values()),
    entries,
  };
}
