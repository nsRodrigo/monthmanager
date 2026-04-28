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

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessão não encontrada. Faça login novamente.");
  return token;
}

// ===== Registro de passkey (usuário logado) =====
export async function registerPasskey(deviceName: string) {
  if (!isWebAuthnSupported()) throw new Error("Seu navegador não suporta biometria");
  const accessToken = await getToken();
  const options = await srvStartReg({ data: { accessToken, deviceName } });
  const response = await browserStartRegistration({ optionsJSON: options as any });
  await srvFinishReg({ data: { accessToken, response, deviceName } });
  return { success: true };
}

// ===== Login com passkey =====
export async function loginWithPasskey(email: string) {
  if (!isWebAuthnSupported()) throw new Error("Seu navegador não suporta biometria");
  const options = await srvStartAuth({ data: { email } });
  const response = await browserStartAuthentication({ optionsJSON: options as any });
  const result = (await srvFinishAuth({ data: { email, response } })) as {
    success: boolean;
    tokenHash: string;
    email: string;
  };

  const { error } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: result.tokenHash,
  });
  if (error) throw error;
  return { success: true };
}

export async function listMyPasskeys() {
  const accessToken = await getToken();
  return srvList({ data: { accessToken } });
}

export async function removePasskey(id: string) {
  const accessToken = await getToken();
  return srvDelete({ data: { accessToken, id } });
}
