import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { saveAs } from "file-saver";

export const BACKUP_VERSION = 1;
export const BACKUP_TABLES = [
  "accounts",
  "cards",
  "purchases",
  "installments",
  "debits",
  "incomes",
  "investments",
  "card_payments",
] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];

export type BackupPayload = {
  version: number;
  exportedAt: string;
  userId: string;
  data: Record<BackupTable, any[]>;
};

export type BackupFormat = "json" | "zip" | "xlsx" | "csv";

export const TABLE_LABELS: Record<BackupTable, string> = {
  accounts: "Contas",
  cards: "Cartões",
  purchases: "Compras",
  installments: "Parcelas",
  debits: "Débitos",
  incomes: "Recebimentos",
  investments: "Investimentos",
  card_payments: "Pagamentos de fatura",
};

export async function collectBackup(): Promise<BackupPayload> {
  const { data: u } = await supabase.auth.getUser();
  const userId = u.user?.id;
  if (!userId) throw new Error("Sessão expirada.");
  const data = {} as Record<BackupTable, any[]>;
  for (const t of BACKUP_TABLES) {
    const { data: rows, error } = await supabase.from(t).select("*");
    if (error) throw new Error(`Falha ao ler ${t}: ${error.message}`);
    data[t] = rows ?? [];
  }
  return { version: BACKUP_VERSION, exportedAt: new Date().toISOString(), userId, data };
}

function rowsToCsv(rows: any[]): string {
  if (!rows.length) return "";
  const cols = Array.from(
    rows.reduce<Set<string>>((acc, r) => {
      Object.keys(r ?? {}).forEach((k) => acc.add(k));
      return acc;
    }, new Set()),
  );
  const esc = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [cols.join(";"), ...rows.map((r) => cols.map((c) => esc(r[c])).join(";"))].join("\n");
}

function buildXlsx(payload: BackupPayload): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  for (const t of BACKUP_TABLES) {
    const rows = payload.data[t] ?? [];
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
    XLSX.utils.book_append_sheet(wb, ws, TABLE_LABELS[t].slice(0, 31));
  }
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

function timestamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

export async function exportBackup(formats: BackupFormat[], payload?: BackupPayload): Promise<void> {
  if (formats.length === 0) throw new Error("Selecione ao menos um formato de backup.");
  const data = payload ?? (await collectBackup());
  const ts = timestamp();
  const base = `backup-financeiro-${ts}`;

  for (const fmt of formats) {
    if (fmt === "json") {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      saveAs(blob, `${base}.json`);
    } else if (fmt === "csv") {
      const zip = new JSZip();
      for (const t of BACKUP_TABLES) {
        zip.file(`${t}.csv`, rowsToCsv(data.data[t] ?? []));
      }
      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, `${base}-csv.zip`);
    } else if (fmt === "xlsx") {
      const buf = buildXlsx(data);
      saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${base}.xlsx`);
    } else if (fmt === "zip") {
      const zip = new JSZip();
      zip.file(`${base}.json`, JSON.stringify(data, null, 2));
      zip.file(`${base}.xlsx`, buildXlsx(data) as any);
      for (const t of BACKUP_TABLES) {
        zip.file(`csv/${t}.csv`, rowsToCsv(data.data[t] ?? []));
      }
      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, `${base}.zip`);
    }
  }
}

export async function readBackupFile(file: File): Promise<BackupPayload> {
  const name = file.name.toLowerCase();
  let text: string;
  if (name.endsWith(".zip")) {
    const zip = await JSZip.loadAsync(file);
    const entry = Object.values(zip.files).find((f) => !f.dir && f.name.toLowerCase().endsWith(".json"));
    if (!entry) throw new Error("ZIP sem arquivo JSON de backup.");
    text = await entry.async("string");
  } else if (name.endsWith(".json")) {
    text = await file.text();
  } else {
    throw new Error("Apenas arquivos .json ou .zip são aceitos para restauração.");
  }
  const parsed = JSON.parse(text);
  if (!parsed?.data || typeof parsed.data !== "object") throw new Error("Arquivo inválido.");
  return parsed as BackupPayload;
}

/** Apaga e reinsere as tabelas selecionadas com o conteúdo do payload. */
export async function restoreBackup(
  payload: BackupPayload,
  selectedTables: BackupTable[],
  opts: { wipeBeforeInsert: boolean } = { wipeBeforeInsert: true },
): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const userId = u.user?.id;
  if (!userId) throw new Error("Sessão expirada.");
  const { error } = await supabase.rpc("restore_finance_backup", {
    _payload: payload as any,
    _selected: selectedTables as string[],
    _wipe_before_insert: opts.wipeBeforeInsert,
  });
  if (error) throw new Error(`Falha ao restaurar backup: ${error.message}`);
}

// ============== Snapshots ==============
export type Snapshot = {
  id: string;
  kind: "auto" | "manual";
  label: string;
  yearMonth: string | null;
  createdAt: string;
};

export async function listSnapshots(): Promise<Snapshot[]> {
  const { data, error } = await supabase
    .from("app_snapshots")
    .select("id, kind, label, year_month, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    kind: r.kind,
    label: r.label,
    yearMonth: r.year_month,
    createdAt: r.created_at,
  }));
}

export async function createSnapshot(label: string, kind: "manual" | "auto" = "manual"): Promise<void> {
  const payload = await collectBackup();
  const { data: u } = await supabase.auth.getUser();
  const userId = u.user?.id;
  if (!userId) throw new Error("Sessão expirada.");
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const { error } = await supabase.from("app_snapshots").insert({
    user_id: userId,
    kind,
    label: label || (kind === "auto" ? `Snapshot automático ${ym}` : `Snapshot ${ym}`),
    year_month: ym,
    data: payload as any,
  });
  if (error) throw error;
}

export async function loadSnapshot(id: string): Promise<BackupPayload> {
  const { data, error } = await supabase.from("app_snapshots").select("data").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Snapshot não encontrado.");
  return data.data as BackupPayload;
}

export async function deleteSnapshot(id: string): Promise<void> {
  const { error } = await supabase.from("app_snapshots").delete().eq("id", id);
  if (error) throw error;
}

/** Garante que existe um snapshot automático para o mês atual. */
export async function ensureMonthlyAutoSnapshot(): Promise<void> {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const { data, error } = await supabase
    .from("app_snapshots")
    .select("id")
    .eq("kind", "auto")
    .eq("year_month", ym)
    .limit(1);
  if (error) return;
  if (data && data.length > 0) return;
  try {
    await createSnapshot(`Snapshot automático ${ym}`, "auto");
  } catch (_) {
    // silencioso
  }
}
