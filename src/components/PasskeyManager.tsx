import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Fingerprint, ScanFace, Monitor, AlertCircle, Trash2 } from "lucide-react";
import {
  isWebAuthnSupported,
  isPlatformAuthenticatorAvailable,
  getAccessToken,
  browserStartRegistration,
} from "@/lib/passkeys";
import {
  startRegistration as srvStartReg,
  finishRegistration as srvFinishReg,
  listPasskeys as srvList,
  deletePasskey as srvDelete,
} from "@/server/webauthn";
import { supabase } from "@/integrations/supabase/client";

type Passkey = {
  id: string;
  device_name: string;
  created_at: string;
  last_used_at: string | null;
};

type MethodKey = "biometric" | "faceid" | "windows-hello";

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
  const startRegFn = useServerFn(srvStartReg);
  const finishRegFn = useServerFn(srvFinishReg);
  const listFn = useServerFn(srvList);
  const deleteFn = useServerFn(srvDelete);

  const [hydrated, setHydrated] = useState(false);
  const [supported, setSupported] = useState(false);
  const [platformAvailable, setPlatformAvailable] = useState(false);
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<MethodKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const platform = detectPlatform();

  const methods: Method[] = [
    {
      key: "faceid",
      label: "Face ID",
      description: "Reconhecimento facial do iPhone/iPad",
      icon: ScanFace,
      matches: (n) => /face\s?id|iphone|ipad/i.test(n),
      defaultName: platform.isIOS ? "Face ID" : "Face ID",
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
      key: "biometric",
      label: "Biometria",
      description: platform.isAndroid
        ? "Digital ou face do Android"
        : platform.isMac
          ? "Touch ID do Mac"
          : "Digital ou chave de segurança",
      icon: Fingerprint,
      matches: (n) => /digital|biometr|touch|android|fingerprint/i.test(n),
      defaultName: platform.isAndroid
        ? "Android"
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

  if (!hydrated || loading) {
    return <p className="text-xs text-muted-foreground">Carregando…</p>;
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

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {methods.map((m) => {
          const Icon = m.icon;
          const pk = findPasskey(m);
          const on = !!pk;
          const isBusy = busy === m.key;
          const disabled = !m.available || isBusy;

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
                <p className="truncate text-sm font-semibold">{m.label}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {!m.available
                    ? "Indisponível neste dispositivo"
                    : on && pk?.last_used_at
                      ? `Último uso: ${new Date(pk.last_used_at).toLocaleDateString("pt-BR")}`
                      : m.description}
                </p>
              </div>

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
            </li>
          );
        })}
      </ul>

      {/* Outros dispositivos cadastrados que não casam com nenhum método acima */}
      {passkeys.filter((p) => !methods.some((m) => m.matches(p.device_name))).length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Outros dispositivos
          </p>
          <ul className="space-y-1.5">
            {passkeys
              .filter((p) => !methods.some((m) => m.matches(p.device_name)))
              .map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card p-2.5"
                >
                  <Fingerprint className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{p.device_name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Cadastrado em {new Date(p.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      if (!confirm("Remover este dispositivo?")) return;
                      const accessToken = await getAccessToken();
                      await deleteFn({ data: { accessToken, id: p.id } });
                      await refresh();
                    }}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Remover ${p.device_name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
          </ul>
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
