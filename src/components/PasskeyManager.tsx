import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Fingerprint,
  ScanFace,
  Monitor,
  AlertCircle,
  AlertTriangle,
  Trash2,
  Pencil,
  Check,
  X,
  Lock,
} from "lucide-react";
import {
  isWebAuthnSupported,
  isPlatformAuthenticatorAvailable,
  isInIframe,
  getAccessToken,
  browserStartRegistration,
} from "@/lib/passkeys";
import {
  startRegistration as srvStartReg,
  finishRegistration as srvFinishReg,
  listPasskeys as srvList,
  deletePasskey as srvDelete,
  renamePasskey as srvRename,
} from "@/lib/webauthn.functions";
import { supabase } from "@/integrations/supabase/client";
import { useConfirm } from "@/store/confirm";
import { useBiometricStepUp } from "@/hooks/use-biometric-stepup";
import {
  useLockSettings,
  LOCK_TIMEOUT_PRESETS,
  type LockTimeoutOption,
} from "@/store/lock-settings";

type Passkey = {
  id: string;
  device_name: string;
  created_at: string;
  last_used_at: string | null;
};

type MethodKey = "biometric" | "faceid" | "windows-hello" | "face-android";

type Method = {
  key: MethodKey;
  label: string;
  description: string;
  icon: typeof Fingerprint;
  matches: (deviceName: string) => boolean;
  defaultName: string;
  available: boolean;
};

function detectPlatform() {
  if (typeof navigator === "undefined")
    return { isIOS: false, isMac: false, isWindows: false, isAndroid: false };
  const ua = navigator.userAgent;
  return {
    isIOS: /iPhone|iPad|iPod/.test(ua),
    isMac: /Macintosh/.test(ua),
    isWindows: /Windows/.test(ua),
    isAndroid: /Android/.test(ua),
  };
}

export function PasskeyManager() {
  const confirmDialog = useConfirm();
  const confirmBiometrics = useBiometricStepUp();
  const { option: lockOption, setOption: setLockOption } = useLockSettings();
  const startRegFn = useServerFn(srvStartReg);
  const finishRegFn = useServerFn(srvFinishReg);
  const listFn = useServerFn(srvList);
  const deleteFn = useServerFn(srvDelete);
  const renameFn = useServerFn(srvRename);

  const [hydrated, setHydrated] = useState(false);
  const [supported, setSupported] = useState(false);
  const [platformAvailable, setPlatformAvailable] = useState(false);
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<MethodKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const platform = detectPlatform();

  const methods: Method[] = [
    {
      key: "faceid",
      label: "Face ID",
      description: "Reconhecimento facial do iPhone/iPad",
      icon: ScanFace,
      matches: (n) => /face\s?id|iphone|ipad/i.test(n),
      defaultName: "Face ID",
      available: platform.isIOS && platformAvailable,
    },
    {
      key: "windows-hello",
      label: "Windows Hello",
      description: "Biometria ou PIN do Windows",
      icon: Monitor,
      matches: (n) => /windows|hello/i.test(n),
      defaultName: "Windows Hello",
      available: platform.isWindows && platformAvailable,
    },
    {
      key: "face-android",
      label: "Reconhecimento facial",
      description: "Face Unlock do Android (apenas devices compatíveis)",
      icon: ScanFace,
      matches: (n) => /face\s?unlock|rosto|android.*face|face.*android/i.test(n),
      defaultName: "Android Face Unlock",
      // Face Unlock só é exposto ao WebAuthn em devices que registraram o rosto
      // como "strong biometric" no Android Keystore (ex.: Pixel 8+, Galaxy S24+).
      // Na maioria dos Androids o sistema cai automaticamente pra digital — então
      // só mostramos o toggle quando há um forte indício de suporte.
      available:
        platform.isAndroid &&
        platformAvailable &&
        /Pixel\s?[89]|Pixel\s?1[0-9]|SM-S(2[4-9]|[3-9])/i.test(
          typeof navigator !== "undefined" ? navigator.userAgent : "",
        ),
    },
    {
      key: "biometric",
      label: platform.isAndroid ? "Digital" : "Biometria",
      description: platform.isAndroid
        ? "Impressão digital do Android"
        : platform.isMac
          ? "Touch ID do Mac"
          : "Digital ou chave de segurança",
      icon: Fingerprint,
      // Não casar com nomes de Face Unlock no Android
      matches: (n) =>
        /digital|biometr|touch|fingerprint/i.test(n) ||
        (/android/i.test(n) && !/face|rosto/i.test(n)),
      defaultName: platform.isAndroid
        ? "Android Digital"
        : platform.isMac
          ? "Touch ID"
          : "Biometria",
      available: !platform.isIOS && !platform.isWindows,
    },
  ];

  useEffect(() => {
    setHydrated(true);
    setSupported(isWebAuthnSupported());
    isPlatformAuthenticatorAvailable().then(setPlatformAvailable);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    refresh();
  }, [hydrated]);

  const refresh = async () => {
    setLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session?.access_token) {
        setPasskeys([]);
        return;
      }
      const list = await listFn({ data: { accessToken: sess.session.access_token } });
      setPasskeys(Array.isArray(list) ? (list as Passkey[]) : []);
    } catch {
      setPasskeys([]);
    } finally {
      setLoading(false);
    }
  };

  const findPasskey = (m: Method) => passkeys.find((p) => m.matches(p.device_name));

  const handleToggle = async (m: Method, currentlyOn: boolean) => {
    setError(null);
    setBusy(m.key);
    try {
      if (currentlyOn) {
        const pk = findPasskey(m);
        if (!pk) return;
        // Remover um método de biometria é sensível (é a sua própria trava
        // de acesso) — se ainda houver como confirmar com o próprio
        // dispositivo antes de apagar, exige.
        if (!(await confirmBiometrics())) {
          setError("Confirmação biométrica necessária para remover.");
          return;
        }
        const accessToken = await getAccessToken();
        await deleteFn({ data: { accessToken, id: pk.id } });
      } else {
        if (!isWebAuthnSupported()) throw new Error("Seu navegador não suporta biometria");
        const accessToken = await getAccessToken();
        const options = await startRegFn({
          data: { accessToken, deviceName: m.defaultName },
        });
        const response = await browserStartRegistration({ optionsJSON: options as any });
        await finishRegFn({ data: { accessToken, response, deviceName: m.defaultName } });
      }
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? "Erro ao atualizar método");
    } finally {
      setBusy(null);
    }
  };

  const startRename = (p: Passkey) => {
    setError(null);
    setRenamingId(p.id);
    setRenameValue(p.device_name);
  };
  const cancelRename = () => {
    setRenamingId(null);
    setRenameValue("");
  };
  const saveRename = async (id: string) => {
    const name = renameValue.trim();
    if (!name) {
      cancelRename();
      return;
    }
    try {
      const accessToken = await getAccessToken();
      await renameFn({ data: { accessToken, id, deviceName: name } });
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? "Erro ao renomear.");
    } finally {
      cancelRename();
    }
  };

  if (!hydrated || loading) {
    return <p className="text-xs text-muted-foreground">Carregando…</p>;
  }

  if (isInIframe()) {
    return (
      <div className="rounded-lg border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            A biometria não funciona dentro do preview do editor. Abra o app publicado no navegador
            (ou instale como PWA) para ativar Face ID, Windows Hello ou digital.
          </div>
        </div>
      </div>
    );
  }

  if (!supported) {
    return (
      <div className="rounded-lg border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          Seu navegador não suporta login com biometria.
        </div>
      </div>
    );
  }

  const otherPasskeys = passkeys.filter((p) => !methods.some((m) => m.matches(p.device_name)));

  return (
    <div className="space-y-3">
      {passkeys.length === 1 && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            Você tem só <strong>1 método de biometria</strong> cadastrado. Se perder o acesso a este
            dispositivo, a única forma de entrar de novo é pela senha. Considere cadastrar um
            segundo método (ex.: outro celular).
          </div>
        </div>
      )}

      <ul className="space-y-2">
        {methods
          .filter((m) => m.available || passkeys.some((p) => m.matches(p.device_name)))
          .map((m) => {
            const Icon = m.icon;
            const pk = findPasskey(m);
            const on = !!pk;
            const isBusy = busy === m.key;
            const disabled = !m.available || isBusy;
            const renaming = !!pk && renamingId === pk.id;

            return (
              <li
                key={m.key}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    on ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  {renaming ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveRename(pk!.id);
                          if (e.key === "Escape") cancelRename();
                        }}
                        className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => saveRename(pk!.id)}
                        aria-label="Salvar nome"
                        className="rounded p-1 text-success hover:bg-success/10"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelRename}
                        aria-label="Cancelar"
                        className="rounded p-1 text-muted-foreground hover:bg-secondary"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="truncate text-sm font-semibold">
                        {on ? pk!.device_name : m.label}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {!m.available
                          ? "Indisponível neste dispositivo"
                          : on && pk?.last_used_at
                            ? `Último uso: ${new Date(pk.last_used_at).toLocaleDateString("pt-BR")}`
                            : m.description}
                      </p>
                    </>
                  )}
                </div>

                {on && !renaming && (
                  <button
                    type="button"
                    onClick={() => startRename(pk!)}
                    aria-label={`Renomear ${pk!.device_name}`}
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}

                {!renaming && (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-label={`${on ? "Desativar" : "Ativar"} ${m.label}`}
                    disabled={disabled}
                    onClick={() => handleToggle(m, on)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                      on ? "bg-success" : "bg-secondary border border-border"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                        on ? "translate-x-[22px]" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                )}
              </li>
            );
          })}
      </ul>

      {/* Outros dispositivos cadastrados que não casam com nenhum método acima */}
      {otherPasskeys.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Outros dispositivos
          </p>
          <ul className="space-y-1.5">
            {otherPasskeys.map((p) => {
              const renaming = renamingId === p.id;
              return (
                <li
                  key={p.id}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card p-2.5"
                >
                  <Fingerprint className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  {renaming ? (
                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveRename(p.id);
                          if (e.key === "Escape") cancelRename();
                        }}
                        className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => saveRename(p.id)}
                        aria-label="Salvar nome"
                        className="rounded p-1 text-success hover:bg-success/10"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelRename}
                        aria-label="Cancelar"
                        className="rounded p-1 text-muted-foreground hover:bg-secondary"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{p.device_name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Cadastrado em {new Date(p.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => startRename(p)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                        aria-label={`Renomear ${p.device_name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={async () => {
                          const ok = await confirmDialog({
                            title: "Remover dispositivo",
                            description: "Remover este dispositivo?",
                            variant: "destructive",
                            confirmLabel: "Remover",
                          });
                          if (!ok) return;
                          if (!(await confirmBiometrics())) {
                            setError("Confirmação biométrica necessária para remover.");
                            return;
                          }
                          const accessToken = await getAccessToken();
                          await deleteFn({ data: { accessToken, id: p.id } });
                          await refresh();
                        }}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Remover ${p.device_name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {passkeys.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-3">
          <label className="flex items-center gap-1.5 text-xs font-semibold">
            <Lock className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            Bloquear o app após
          </label>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Tempo em segundo plano (ou inativo) antes de pedir biometria de novo.
          </p>
          <select
            value={lockOption}
            onChange={(e) => setLockOption(e.target.value as LockTimeoutOption)}
            className="mt-2 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          >
            {(Object.keys(LOCK_TIMEOUT_PRESETS) as LockTimeoutOption[]).map((key) => (
              <option key={key} value={key}>
                {LOCK_TIMEOUT_PRESETS[key].label}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
