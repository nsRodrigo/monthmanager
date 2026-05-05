import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "@/integrations/supabase/client-auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { VAPID_PUBLIC_KEY } from "./push.server";

export const getVapidPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { key: VAPID_PUBLIC_KEY };
});

export const saveSubscription = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        endpoint: z.string().url(),
        keys: z.object({ p256dh: z.string(), auth: z.string() }),
        userAgent: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { error } = await supabaseAdmin.from("push_subscriptions").upsert(
      {
        user_id: context.userId,
        endpoint: data.endpoint,
        p256dh: data.keys.p256dh,
        auth: data.keys.auth,
        user_agent: data.userAgent ?? null,
      },
      { onConflict: "endpoint" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
