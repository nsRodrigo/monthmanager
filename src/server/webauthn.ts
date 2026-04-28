import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import type { Database } from "@/integrations/supabase/types";

const RP_NAME = "Gestão Financeira";

function getRpId(origin: string) {
  try {
    return new URL(origin).hostname;
  } catch {
    return "localhost";
  }
}

function getOrigin() {
  const req = getRequest();
  const origin = req?.headers.get("origin") || req?.headers.get("referer");
  if (!origin) throw new Error("Origin não encontrado");
  return new URL(origin).origin;
}

function adminClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

async function userIdFromToken(accessToken: string): Promise<string> {
  const supa = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!
  );
  const { data, error } = await supa.auth.getClaims(accessToken);
  if (error || !data?.claims?.sub) throw new Error("Token inválido");
  return data.claims.sub;
}

// ============================================================
// REGISTRATION
// ============================================================

export const startRegistration = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string; deviceName?: string }) => d)
  .handler(async ({ data }) => {
    const userId = await userIdFromToken(data.accessToken);
    const origin = getOrigin();
    const rpId = getRpId(origin);
    const admin = adminClient();

    const { data: userData } = await admin.auth.admin.getUserById(userId);
    const email = userData?.user?.email ?? "user";

    const { data: existing } = await admin
      .from("user_passkeys")
      .select("credential_id, transports")
      .eq("user_id", userId);

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: rpId,
      userID: new TextEncoder().encode(userId),
      userName: email,
      userDisplayName: email,
      attestationType: "none",
      excludeCredentials: (existing ?? []).map((c) => ({
        id: c.credential_id,
        transports: (c.transports as AuthenticatorTransport[] | null) ?? undefined,
      })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
    });

    await admin.from("webauthn_challenges").insert({
      challenge: options.challenge,
      user_id: userId,
      type: "registration",
    });

    return options;
  });

export const finishRegistration = createServerFn({ method: "POST" })
  .inputValidator((d: {
    accessToken: string;
    response: RegistrationResponseJSON;
    deviceName: string;
  }) => d)
  .handler(async ({ data }) => {
    const userId = await userIdFromToken(data.accessToken);
    const origin = getOrigin();
    const rpId = getRpId(origin);
    const admin = adminClient();

    const { data: challengeRow } = await admin
      .from("webauthn_challenges")
      .select("challenge, expires_at")
      .eq("user_id", userId)
      .eq("type", "registration")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!challengeRow) throw new Error("Desafio expirado. Tente novamente.");

    const verification = await verifyRegistrationResponse({
      response: data.response,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: origin,
      expectedRPID: rpId,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new Error("Falha na verificação biométrica");
    }

    const { credential } = verification.registrationInfo;

    await admin.from("user_passkeys").insert({
      user_id: userId,
      credential_id: credential.id,
      public_key: Buffer.from(credential.publicKey).toString("base64"),
      counter: credential.counter,
      transports: credential.transports ?? null,
      device_name: data.deviceName || "Dispositivo",
    });

    await admin
      .from("webauthn_challenges")
      .delete()
      .eq("user_id", userId)
      .eq("type", "registration");

    return { success: true };
  });

// ============================================================
// AUTHENTICATION
// ============================================================

export const startAuthentication = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string }) => d)
  .handler(async ({ data }) => {
    const origin = getOrigin();
    const rpId = getRpId(origin);
    const admin = adminClient();

    const { data: usersList } = await admin.auth.admin.listUsers();
    const user = usersList?.users.find(
      (u) => u.email?.toLowerCase() === data.email.toLowerCase()
    );

    if (!user) {
      const options = await generateAuthenticationOptions({
        rpID: rpId,
        userVerification: "preferred",
        allowCredentials: [],
      });
      await admin.from("webauthn_challenges").insert({
        challenge: options.challenge,
        email: data.email.toLowerCase(),
        type: "authentication",
      });
      return options;
    }

    const { data: passkeys } = await admin
      .from("user_passkeys")
      .select("credential_id, transports")
      .eq("user_id", user.id);

    if (!passkeys || passkeys.length === 0) {
      throw new Error("Nenhuma biometria cadastrada para este e-mail");
    }

    const options = await generateAuthenticationOptions({
      rpID: rpId,
      userVerification: "preferred",
      allowCredentials: passkeys.map((p) => ({
        id: p.credential_id,
        transports: (p.transports as AuthenticatorTransport[] | null) ?? undefined,
      })),
    });

    await admin.from("webauthn_challenges").insert({
      challenge: options.challenge,
      email: data.email.toLowerCase(),
      user_id: user.id,
      type: "authentication",
    });

    return options;
  });

export const finishAuthentication = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; response: AuthenticationResponseJSON }) => d)
  .handler(async ({ data }) => {
    const origin = getOrigin();
    const rpId = getRpId(origin);
    const admin = adminClient();

    const email = data.email.toLowerCase();

    const { data: challengeRow } = await admin
      .from("webauthn_challenges")
      .select("challenge, user_id")
      .eq("email", email)
      .eq("type", "authentication")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!challengeRow || !challengeRow.user_id) {
      throw new Error("Desafio inválido ou expirado");
    }

    const credentialId = data.response.id;

    const { data: passkey } = await admin
      .from("user_passkeys")
      .select("*")
      .eq("user_id", challengeRow.user_id)
      .eq("credential_id", credentialId)
      .single();

    if (!passkey) throw new Error("Credencial não encontrada");

    const verification = await verifyAuthenticationResponse({
      response: data.response,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: origin,
      expectedRPID: rpId,
      credential: {
        id: passkey.credential_id,
        publicKey: new Uint8Array(Buffer.from(passkey.public_key, "base64")),
        counter: Number(passkey.counter),
        transports: (passkey.transports as AuthenticatorTransport[] | null) ?? undefined,
      },
    });

    if (!verification.verified) throw new Error("Falha na verificação biométrica");

    await admin
      .from("user_passkeys")
      .update({
        counter: verification.authenticationInfo.newCounter,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", passkey.id);

    await admin
      .from("webauthn_challenges")
      .delete()
      .eq("email", email)
      .eq("type", "authentication");

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

    if (linkErr || !linkData?.properties) {
      throw new Error("Erro ao gerar sessão");
    }

    return {
      success: true,
      tokenHash: linkData.properties.hashed_token,
      email,
    };
  });

// ============================================================
// LIST / DELETE
// ============================================================

export const listPasskeys = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string }) => d)
  .handler(async ({ data }) => {
    const userId = await userIdFromToken(data.accessToken);
    const admin = adminClient();
    const { data: rows } = await admin
      .from("user_passkeys")
      .select("id, device_name, created_at, last_used_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    return rows ?? [];
  });

export const deletePasskey = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string; id: string }) => d)
  .handler(async ({ data }) => {
    const userId = await userIdFromToken(data.accessToken);
    const admin = adminClient();
    await admin
      .from("user_passkeys")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    return { success: true };
  });
