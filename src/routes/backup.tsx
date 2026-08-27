import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  BACKUP_TABLES,
  TABLE_LABELS,
  type BackupFormat,
  type BackupPayload,
  type BackupTable,
  type Snapshot,
  collectBackup,
  createSnapshot,
  deleteSnapshot,
  ensureMonthlyAutoSnapshot,
  exportBackup,
  listSnapshots,
  loadSnapshot,
  readBackupFile,
  restoreBackup,
} from "@/lib/backup";
import {
  connectGoogleDrive,
  disconnectGoogleDrive,
  getGoogleDriveStatus,
  uploadBackupToGoogleDrive,
} from "@/lib/google-drive.functions";
import { supabase } from "@/integrations/supabase/client";
import { useConfirm } from "@/store/confirm";
import { useBiometricStepUp } from "@/hooks/use-biometric-stepup";
import {
  Check,
  ChevronLeft,
  Cloud,
  Download,
  HardDriveDownload,
  History,
  Link2,
  Loader2,
  RefreshCw,
  Trash2,
  Unlink,
  Upload,
} from "lucide-react";

export const Route = createFileRoute("/backup")({
  component: BackupPage,
});

const FORMAT_OPTIONS: { value: BackupFormat; label: string; hint: string }[] = [
  { value: "json", label: "JSON", hint: "Formato principal restaurável e editável" },
  { value: "zip", label: "ZIP", hint: "Pacote com JSON + XLSX + CSVs" },
  { value: "xlsx", label: "Excel (.xlsx)", hint: "Abas separadas por entidade" },
  { value: "csv", label: "CSV (;)", hint: "Um arquivo por entidade, em ZIP" },
];

const FREQ_OPTIONS = [
  { value: "off", label: "Manual apenas" },
  { value: "daily", label: "Diário" },
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensal" },
] as const;
type Freq = (typeof FREQ_OPTIONS)[number]["value"];

const SETTINGS_KEY = "backup-settings-v1";
type Settings = { formats: BackupFormat[]; frequency: Freq; lastAutoAt: string | null };

function loadSettings(): Settings {
  if (typeof window === "undefined")
    return { formats: ["json"], frequency: "off", lastAutoAt: null };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { formats: ["json"], frequency: "off", lastAutoAt: null, ...JSON.parse(raw) };
  } catch {}
  return { formats: ["json"], frequency: "off", lastAutoAt: null };
}
function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {}
}

function shouldRunAuto(freq: Freq, last: string | null): boolean {
  if (freq === "off") return false;
  if (!last) return true;
  const diff = Date.now() - new Date(last).getTime();
  if (freq === "daily") return diff > 24 * 3600 * 1000;
  if (freq === "weekly") return diff > 7 * 24 * 3600 * 1000;
  if (freq === "monthly") return diff > 30 * 24 * 3600 * 1000;
  return false;
}

function BackupPage() {
  const confirmDialog = useConfirm();
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[] | null>(null);
  const [restoreOpen, setRestoreOpen] = useState<{ payload: BackupPayload; source: string } | null>(
    null,
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const autoRanRef = useRef(false);

  useEffect(() => saveSettings(settings), [settings]);

  // Snapshot mensal automático ao abrir + auto-backup local conforme frequência
  useEffect(() => {
    if (autoRanRef.current) return;
    autoRanRef.current = true;
    void ensureMonthlyAutoSnapshot().then(() => refreshSnapshots());
    if (shouldRunAuto(settings.frequency, settings.lastAutoAt)) {
      void runExport(settings.formats, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshSnapshots() {
    try {
      const list = await listSnapshots();
      setSnapshots(list);
    } catch (e: any) {
      setError(e.message ?? "Falha ao listar snapshots.");
    }
  }
  useEffect(() => {
    void refreshSnapshots();
  }, []);

  async function runExport(formats: BackupFormat[], silent = false) {
    setError(null);
    setInfo(null);
    if (formats.length === 0) {
      setError("Selecione ao menos um formato de backup.");
      return;
    }
    setBusy("export");
    try {
      await exportBackup(formats);
      setSettings((s) => ({ ...s, lastAutoAt: new Date().toISOString() }));
      if (!silent) setInfo("Backup gerado com sucesso.");
    } catch (e: any) {
      setError(e.message ?? "Falha ao gerar backup.");
    } finally {
      setBusy(null);
    }
  }

  async function onCreateSnapshot() {
    setError(null);
    setInfo(null);
    setBusy("snapshot");
    try {
      await createSnapshot("");
      await refreshSnapshots();
      setInfo("Snapshot criado.");
    } catch (e: any) {
      setError(e.message ?? "Falha ao criar snapshot.");
    } finally {
      setBusy(null);
    }
  }

  async function onDeleteSnapshot(id: string) {
    const ok = await confirmDialog({
      title: "Excluir snapshot",
      description: "Excluir este snapshot? Esta ação não pode ser desfeita.",
      variant: "destructive",
      confirmLabel: "Excluir",
    });
    if (!ok) return;
    setBusy(`del-${id}`);
    try {
      await deleteSnapshot(id);
      await refreshSnapshots();
    } catch (e: any) {
      setError(e.message ?? "Falha ao excluir.");
    } finally {
      setBusy(null);
    }
  }

  async function onOpenSnapshotForRestore(s: Snapshot) {
    setBusy(`load-${s.id}`);
    try {
      const payload = await loadSnapshot(s.id);
      setRestoreOpen({
        payload,
        source: `Snapshot ${new Date(s.createdAt).toLocaleString("pt-BR")}`,
      });
    } catch (e: any) {
      setError(e.message ?? "Falha ao carregar snapshot.");
    } finally {
      setBusy(null);
    }
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBusy("file");
    try {
      const payload = await readBackupFile(f);
      setRestoreOpen({ payload, source: `Arquivo ${f.name}` });
    } catch (e: any) {
      setError(e.message ?? "Arquivo inválido.");
    } finally {
      setBusy(null);
    }
  }

  function toggleFormat(f: BackupFormat) {
    setSettings((s) => ({
      ...s,
      formats: s.formats.includes(f) ? s.formats.filter((x) => x !== f) : [...s.formats, f],
    }));
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 md:py-12">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Home
        </Link>
      </div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Backup e Sincronização</h1>
        <p className="text-sm text-muted-foreground">
          Exporte, restaure e mantenha versões dos seus dados financeiros.
        </p>
      </header>
      <div className="space-y-6 pb-20">
        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {info && (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400">
            {info}
          </div>
        )}

        <section className="rounded-xl border border-border bg-card/40 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Cloud className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Sincronização multi-device</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Seus dados ficam salvos na nuvem associados ao seu login. Alterações feitas em qualquer
            dispositivo aparecem nos demais em segundos. Sem internet, o app continua funcionando
            com cache local e sincroniza assim que reconectar.
          </p>
        </section>

        <section className="rounded-xl border border-border bg-card/40 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Download className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Backup manual</h2>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">Selecione os formatos desejados:</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {FORMAT_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-background p-3 text-sm hover:border-primary/60"
              >
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={settings.formats.includes(opt.value)}
                  onChange={() => toggleFormat(opt.value)}
                />
                <span>
                  <span className="font-medium">{opt.label}</span>
                  <span className="block text-[11px] text-muted-foreground">{opt.hint}</span>
                </span>
              </label>
            ))}
          </div>
          <button
            onClick={() => runExport(settings.formats)}
            disabled={busy === "export"}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy === "export" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Gerar backup
          </button>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Os arquivos são baixados no dispositivo. No iPhone/iPad, escolha &quot;Salvar em
            Arquivos&quot; (iCloud Drive); no Android use o Drive ou pasta local.
          </p>
        </section>

        <GoogleDriveSection />

        <section className="rounded-xl border border-border bg-card/40 p-4">
          <div className="mb-3 flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Backup automático (neste dispositivo)</h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {FREQ_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background p-3 text-sm hover:border-primary/60"
              >
                <input
                  type="radio"
                  name="freq"
                  checked={settings.frequency === opt.value}
                  onChange={() => setSettings((s) => ({ ...s, frequency: opt.value }))}
                />
                {opt.label}
              </label>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Quando ativo, gera o download nos formatos selecionados ao abrir o app. Último:{" "}
            {settings.lastAutoAt ? new Date(settings.lastAutoAt).toLocaleString("pt-BR") : "nunca"}.
          </p>
        </section>

        <section className="rounded-xl border border-border bg-card/40 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Restaurar de arquivo</h2>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".json,.zip"
            onChange={onPickFile}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy === "file"}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:border-primary disabled:opacity-60"
          >
            {busy === "file" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <HardDriveDownload className="h-4 w-4" />
            )}
            Escolher arquivo (.json ou .zip)
          </button>
        </section>

        <section className="rounded-xl border border-border bg-card/40 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Snapshots (rollback)</h2>
            </div>
            <button
              onClick={onCreateSnapshot}
              disabled={busy === "snapshot"}
              className="inline-flex items-center gap-2 rounded-lg bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/25 disabled:opacity-60"
            >
              {busy === "snapshot" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Cloud className="h-3.5 w-3.5" />
              )}
              Criar agora
            </button>
          </div>
          <p className="mb-3 text-[11px] text-muted-foreground">
            Um snapshot mensal automático é gerado ao abrir o app. Os snapshots ficam guardados na
            sua conta na nuvem.
          </p>
          {!snapshots && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {snapshots && snapshots.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhum snapshot ainda.</p>
          )}
          {snapshots && snapshots.length > 0 && (
            <ul className="space-y-2">
              {snapshots.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{s.label}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(s.createdAt).toLocaleString("pt-BR")} ·{" "}
                      {s.kind === "auto" ? "automático" : "manual"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => onOpenSnapshotForRestore(s)}
                      disabled={busy === `load-${s.id}`}
                      className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                    >
                      {busy === `load-${s.id}` ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        "Restaurar"
                      )}
                    </button>
                    <button
                      onClick={() => onDeleteSnapshot(s.id)}
                      disabled={busy === `del-${s.id}`}
                      className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-destructive disabled:opacity-60"
                      aria-label="Excluir snapshot"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {restoreOpen && (
          <RestoreDialog
            payload={restoreOpen.payload}
            source={restoreOpen.source}
            onClose={() => setRestoreOpen(null)}
            onDone={() => {
              setRestoreOpen(null);
              setInfo("Restauração concluída. Recarregando dados...");
              setTimeout(() => window.location.reload(), 800);
            }}
          />
        )}
      </div>
    </div>
  );
}

const GDRIVE_REDIRECT_FLAG = "gdrive_connecting";

function GoogleDriveSection() {
  const statusFn = useServerFn(getGoogleDriveStatus);
  const connectFn = useServerFn(connectGoogleDrive);
  const disconnectFn = useServerFn(disconnectGoogleDrive);
  const uploadFn = useServerFn(uploadBackupToGoogleDrive);

  const [status, setStatus] = useState<{
    connected: boolean;
    connectedAt: string | null;
    lastSyncedAt: string | null;
  } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const finishingRef = useRef(false);

  async function refreshStatus() {
    try {
      setStatus(await statusFn());
    } catch (e: any) {
      setError(e.message ?? "Falha ao consultar status do Google Drive.");
    }
  }

  useEffect(() => {
    void refreshStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Completa a conexão depois do redirect do OAuth: se a URL tem o flag e a
  // sessão atual já veio com um refresh token do Google (escopo drive.file),
  // manda pro servidor guardar e limpa a URL.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get(GDRIVE_REDIRECT_FLAG) !== "1" || finishingRef.current) return;
    finishingRef.current = true;

    void (async () => {
      setBusy("connect");
      setError(null);
      const { data } = await supabase.auth.getSession();
      const refreshToken = data.session?.provider_refresh_token;
      url.searchParams.delete(GDRIVE_REDIRECT_FLAG);
      window.history.replaceState({}, "", url.toString());
      if (!refreshToken) {
        setError(
          "O Google não devolveu permissão de acesso ao Drive. Tente conectar de novo — na tela de consentimento, aceite o acesso aos arquivos do app.",
        );
        setBusy(null);
        return;
      }
      try {
        await connectFn({ data: { refreshToken } });
        setInfo("Google Drive conectado.");
        await refreshStatus();
      } catch (e: any) {
        setError(e.message ?? "Falha ao salvar a conexão com o Google Drive.");
      } finally {
        setBusy(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onConnect() {
    setError(null);
    setInfo(null);
    const redirectTo = new URL(window.location.href);
    redirectTo.search = "";
    redirectTo.searchParams.set(GDRIVE_REDIRECT_FLAG, "1");
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes: "https://www.googleapis.com/auth/drive.file",
        queryParams: { access_type: "offline", prompt: "consent" },
        redirectTo: redirectTo.toString(),
      },
    });
    if (err) setError(err.message ?? "Erro ao conectar com o Google.");
  }

  async function onDisconnect() {
    setError(null);
    setInfo(null);
    setBusy("disconnect");
    try {
      await disconnectFn();
      setInfo("Google Drive desconectado.");
      await refreshStatus();
    } catch (e: any) {
      setError(e.message ?? "Falha ao desconectar.");
    } finally {
      setBusy(null);
    }
  }

  async function onSyncNow() {
    setError(null);
    setInfo(null);
    setBusy("sync");
    try {
      const payload = await collectBackup();
      const d = new Date();
      const p = (n: number) => String(n).padStart(2, "0");
      const fileName = `backup-financeiro-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
      await uploadFn({ data: { fileName, payloadJson: JSON.stringify(payload, null, 2) } });
      setInfo("Backup enviado para o Google Drive.");
      await refreshStatus();
    } catch (e: any) {
      setError(e.message ?? "Falha ao enviar backup para o Google Drive.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Cloud className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Google Drive</h2>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </div>
      )}
      {info && (
        <div className="mb-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400">
          {info}
        </div>
      )}

      {!status ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : status.connected ? (
        <>
          <p className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Check className="h-3.5 w-3.5 text-success" /> Conectado
            {status.lastSyncedAt && (
              <> · último envio {new Date(status.lastSyncedAt).toLocaleString("pt-BR")}</>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onSyncNow}
              disabled={busy === "sync"}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {busy === "sync" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Cloud className="h-4 w-4" />
              )}
              Enviar backup agora
            </button>
            <button
              onClick={onDisconnect}
              disabled={busy === "disconnect"}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-muted-foreground hover:border-destructive/50 hover:text-destructive disabled:opacity-60"
            >
              {busy === "disconnect" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Unlink className="h-4 w-4" />
              )}
              Desconectar
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mb-3 text-xs text-muted-foreground">
            Envie uma cópia do backup pra uma pasta própria do app no seu Google Drive — sobrevive a
            reinstalar o app ou trocar de aparelho.
          </p>
          <button
            onClick={onConnect}
            disabled={busy === "connect"}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy === "connect" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            Conectar Google Drive
          </button>
        </>
      )}
    </section>
  );
}

function RestoreDialog({
  payload,
  source,
  onClose,
  onDone,
}: {
  payload: BackupPayload;
  source: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const counts = useMemo(() => {
    const out = {} as Record<BackupTable, number>;
    for (const t of BACKUP_TABLES) out[t] = (payload.data[t] ?? []).length;
    return out;
  }, [payload]);
  const [selected, setSelected] = useState<BackupTable[]>([...BACKUP_TABLES]);
  const [confirmText, setConfirmText] = useState("");
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const confirmBiometrics = useBiometricStepUp();

  function toggle(t: BackupTable) {
    setSelected((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));
  }

  async function run() {
    setErr(null);
    if (confirmText.trim().toUpperCase() !== "RESTAURAR") {
      setErr('Digite "RESTAURAR" para confirmar.');
      return;
    }
    if (selected.length === 0) {
      setErr("Selecione ao menos uma entidade.");
      return;
    }
    setRunning(true);
    try {
      // Restaurar apaga e substitui dados existentes — se houver biometria
      // cadastrada, exige confirmação extra além do texto "RESTAURAR".
      if (!(await confirmBiometrics())) {
        setErr("Confirmação biométrica necessária para restaurar.");
        return;
      }
      await restoreBackup(payload, selected, { wipeBeforeInsert: true });
      onDone();
    } catch (e: any) {
      setErr(e.message ?? "Falha ao restaurar.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-lg">
        <h3 className="text-lg font-bold">Restaurar dados</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Origem: {source}
          {payload.exportedAt && (
            <> · gerado em {new Date(payload.exportedAt).toLocaleString("pt-BR")}</>
          )}
        </p>

        <p className="mt-4 text-sm font-semibold">Restaurar quais entidades?</p>
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {BACKUP_TABLES.map((t) => (
            <label
              key={t}
              className="flex items-center gap-2 rounded-md border border-border bg-background p-2 text-sm"
            >
              <input type="checkbox" checked={selected.includes(t)} onChange={() => toggle(t)} />
              <span className="flex-1">{TABLE_LABELS[t]}</span>
              <span className="text-xs text-muted-foreground">{counts[t]}</span>
            </label>
          ))}
        </div>

        <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          ⚠️ As entidades selecionadas serão <strong>substituídas</strong> pelo conteúdo do backup.
          Os dados atuais dessas tabelas serão apagados.
        </div>

        <label className="mt-3 block text-xs">
          Digite <strong>RESTAURAR</strong> para confirmar:
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>

        {err && <p className="mt-2 text-xs text-destructive">{err}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={running}
            className="rounded-md border border-border px-3 py-2 text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={run}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-60"
          >
            {running && <Loader2 className="h-4 w-4 animate-spin" />}
            Restaurar
          </button>
        </div>
      </div>
    </div>
  );
}
