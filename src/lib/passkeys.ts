import {
  startRegistration as browserStartRegistration,
  startAuthentication as browserStartAuthentication,
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
} from "@simplewebauthn/browser";
import {
  startRegistration as srvStartReg,
  finishRegistration as srvFinishReg,
  startAuthentication as srvStartAuth,
  finishAuthentication as srvFinishAuth,
  listPasskeys as srvList,
  deletePasskey as srvDelete,
} from "@/server/webauthn";
import { supabase } from "@/integrations/supabase/client";

export function isWebAuthnSupported() {
  return typeof window !== "undefined" && browserSupportsWebAuthn();
}

export async function isPlatformAuthenticatorAvailable() {
  if (!isWebAuthnSupported()) return false;
  try {
    return await platformAuthenticatorIsAvailable();
  } catch {
    return false;
  }
}

async function withAuthHeaders<T>(fn: () => Promise<T>): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessão não encontrada");
  // TanStack server functions automatically include cookies but not auth header.
  // We pass it via fetch interception by setting a global header on the supabase client; here we rely on a workaround:
  // simplewebauthn server functions read getRequest() headers, so we need the browser to send Authorization.
  // TanStack Start forwards request headers from the browser fetch, so we set it via a custom fetch.
  return fn();
}

// Wrap server functions to include Authorization header (TanStack passes through fetch headers)
async function callWithAuth<T>(serverFn: any, payload?: any): Promise<T> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) throw new Error("Sessão não encontrada");
  return serverFn({ data: payload, headers: { Authorization: `Bearer ${token}` } });
}

// ===== Registro de passkey (usuário já logado) =====
export async function registerPasskey(deviceName: string) {
  if (!isWebAuthnSupported()) throw new Error("Seu navegador não suporta biometria");
  const options = await callWithAuth<any>(srvStartReg, { deviceName });
  const response = await browserStartRegistration({ optionsJSON: options });
  await callWithAuth<any>(srvFinishReg, { response, deviceName });
  return { success: true };
}

// ===== Login com passkey (sem sessão prévia) =====
export async function loginWithPasskey(email: string) {
  if (!isWebAuthnSupported()) throw new Error("Seu navegador não suporta biometria");
  const options = await srvStartAuth({ data: { email } } as any);
  const response = await browserStartAuthentication({ optionsJSON: options as any });
  const result = (await srvFinishAuth({ data: { email, response } } as any)) as {
    success: boolean;
    tokenHash: string;
    email: string;
  };

  // Trocar token_hash por sessão ativa
  const { error } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: result.tokenHash,
  });
  if (error) throw error;
  return { success: true };
}

export async function listMyPasskeys() {
  return callWithAuth<Array<{ id: string; device_name: string; created_at: string; last_used_at: string | null }>>(
    srvList,
  );
}

export async function removePasskey(id: string) {
  return callWithAuth(srvDelete, { id });
}
