import webpush from "web-push";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Public key (VAPID). Pode ser exposta no client.
export const VAPID_PUBLIC_KEY =
  "BLMTt8gfhIwowJGrkaJJjxEBRqZFUSaALl9P7J6xPcGsNCMClCDkOTrn1fn7YtGvaRtSBZhj0sutqLO0bBp_Tcg";

let configured = false;
function ensureConfigured() {
  if (configured) return;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const rawSubject = process.env.VAPID_SUBJECT?.trim() || "mailto:admin@example.com";
  const subject = rawSubject.includes(":") ? rawSubject : `mailto:${rawSubject}`;
  if (!priv) throw new Error("VAPID_PRIVATE_KEY não configurada.");
  webpush.setVapidDetails(subject, VAPID_PUBLIC_KEY, priv);
  configured = true;
}

export type NotifyPayload = {
  title: string;
  body: string;
  url?: string;
  /** Tipo de notificação — dá pra tela de notificações mostrar uma ação
   * específica (ex.: "access_request" ganha botões Permitir/Recusar). */
  kind?: string;
  /** Id da linha relacionada (ex.: o grant, o pedido) — usado pela ação acima. */
  relatedId?: string;
};

export async function notifyAdmins(payload: NotifyPayload) {
  const { data: admins } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");
  const ids = (admins ?? []).map((a) => a.user_id);
  if (!ids.length) return { sent: 0, pushSent: 0 };
  return notifyUsers(ids, payload);
}

/**
 * Notifica um conjunto de usuários — SEMPRE grava uma linha durável em
 * `notifications` (aparece na central de notificações independente de
 * push), e tenta push como um adicional "melhor esforço" pra quem já tem
 * inscrição ativa. `sent` conta quem recebeu a notificação durável (== todo
 * `userIds`); `pushSent` conta só quem recebeu o push de verdade.
 */
export async function notifyUsers(userIds: string[], payload: NotifyPayload) {
  if (!userIds.length) return { sent: 0, pushSent: 0 };

  const rows = userIds.map((userId) => ({
    user_id: userId,
    title: payload.title,
    body: payload.body,
    url: payload.url ?? null,
    kind: payload.kind ?? "generic",
    related_id: payload.relatedId ?? null,
  }));
  const { error: insertError } = await supabaseAdmin.from("notifications").insert(rows);
  if (insertError) console.error("insert notifications failed", insertError);

  let pushSent = 0;
  try {
    ensureConfigured();
    const { data: subs } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id,endpoint,p256dh,auth")
      .in("user_id", userIds);

    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: payload.title, body: payload.body, url: payload.url }),
        );
        pushSent++;
      } catch (err: any) {
        // 404/410 = inscrição expirou → remove
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await supabaseAdmin.from("push_subscriptions").delete().eq("id", s.id);
        } else {
          console.error("push error", err?.statusCode, err?.body);
        }
      }
    }
  } catch (err) {
    // VAPID não configurada, etc. — a notificação durável já foi gravada acima.
    console.error("push send skipped", err);
  }

  return { sent: userIds.length, pushSent };
}
