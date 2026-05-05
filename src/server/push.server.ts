import webpush from "web-push";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Public key (VAPID). Pode ser exposta no client.
export const VAPID_PUBLIC_KEY =
  "BMKPIjyDWhEIU1Nndkq6PNuULhAQ7N94qdd79lfou_nLOhHG6T3TcF5h_STkNbDY2MvJXmiA1JvIyvcabIGw1ag";

let configured = false;
function ensureConfigured() {
  if (configured) return;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
  if (!priv) throw new Error("VAPID_PRIVATE_KEY não configurada.");
  webpush.setVapidDetails(subject, VAPID_PUBLIC_KEY, priv);
  configured = true;
}

export async function notifyAdmins(payload: { title: string; body: string; url?: string }) {
  ensureConfigured();
  const { data: admins } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");
  const ids = (admins ?? []).map((a) => a.user_id);
  if (!ids.length) return { sent: 0 };

  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id,endpoint,p256dh,auth")
    .in("user_id", ids);

  let sent = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
      );
      sent++;
    } catch (err: any) {
      // 404/410 = inscrição expirou → remove
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await supabaseAdmin.from("push_subscriptions").delete().eq("id", s.id);
      } else {
        console.error("push error", err?.statusCode, err?.body);
      }
    }
  }
  return { sent };
}
