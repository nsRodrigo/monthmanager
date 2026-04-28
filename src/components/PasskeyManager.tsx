import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Fingerprint, Trash2, Plus, Check, AlertCircle } from "lucide-react";
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
  const [busy, setBusy] = useState(false);
  const [deviceName, setDeviceName] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  const guessDeviceName = () => {
    if (typeof navigator === "undefined") return "Dispositivo";
    const ua = navigator.userAgent;
    if (/iPhone/.test(ua)) return "iPhone";
    if (/iPad/.test(ua)) return "iPad";
    if (/Android/.test(ua)) return "Android";
    if (/Mac/.test(ua)) return "Mac";
    if (/Windows/.test(ua)) return "Windows";
    return "Dispositivo";
  };

  const handleAdd = async () => {
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      if (!isWebAuthnSupported()) throw new Error("Seu navegador não suporta biometria");
      const accessToken = await getAccessToken();
      const name = deviceName.trim() || guessDeviceName();
      const options = await startRegFn({ data: { accessToken, deviceName: name } });
      const response = await browserStartRegistration({ optionsJSON: options as any });
      await finishRegFn({ data: { accessToken, response, deviceName: name } });
      setSuccess("Biometria cadastrada!");
      setShowForm(false);
      setDeviceName("");
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? "Erro ao cadastrar biometria");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm("Remover esta biometria?")) return;
    setBusy(true);
    try {
      const accessToken = await getAccessToken();
      await deleteFn({ data: { accessToken, id } });
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? "Erro ao remover");
    } finally {
      setBusy(false);
    }
  };

  if (!hydrated) {
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
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Login com biometria</p>
          <p className="text-[11px] text-muted-foreground">
            {platformAvailable
              ? "Use digital, Face ID ou Windows Hello para entrar."
              : "Use uma chave de segurança ou seu celular."}
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </button>
        )}
      </div>

      {showForm && (
        <div className="space-y-2 rounded-lg border border-border bg-card p-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-muted-foreground">
              Nome do dispositivo
            </span>
            <input
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder={guessDeviceName()}
              maxLength={40}
              className="w-full rounded-lg border border-input bg-input px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={busy}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-primary py-2 text-xs font-semibold text-primary-foreground shadow-glow disabled:opacity-50"
            >
              <Fingerprint className="h-4 w-4" />
              {busy ? "Aguarde…" : "Cadastrar biometria"}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setError(null);
              }}
              className="rounded-lg border border-border px-3 text-xs text-muted-foreground hover:bg-secondary"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </p>
      )}
      {success && (
        <p
          role="status"
          className="flex items-center gap-1.5 rounded-lg bg-success/10 p-2 text-xs text-success"
        >
          <Check className="h-3.5 w-3.5" /> {success}
        </p>
      )}

      {loading ? (
        <p className="text-xs text-muted-foreground">Carregando…</p>
      ) : passkeys.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum dispositivo cadastrado.</p>
      ) : (
        <ul className="space-y-1.5">
          {passkeys.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-2 rounded-lg border border-border bg-card p-2.5"
            >
              <Fingerprint className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{p.device_name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {p.last_used_at
                    ? `Último uso: ${new Date(p.last_used_at).toLocaleDateString("pt-BR")}`
                    : `Cadastrado em ${new Date(p.created_at).toLocaleDateString("pt-BR")}`}
                </p>
              </div>
              <button
                onClick={() => handleRemove(p.id)}
                disabled={busy}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                aria-label={`Remover ${p.device_name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
