import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "@/integrations/supabase/client-auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { notifyAdmins } from "@/server/push.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Acesso negado.");
}

export type AccessRequest = {
  id: string;
  email: string;
  status: "pending" | "approved" | "rejected";
  requested_at: string;
};

export const listPendingRequests = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccessRequest[]> => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("access_requests")
      .select("id,email,status,requested_at")
      .eq("status", "pending")
      .order("requested_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as AccessRequest[];
  });

export const approveRequest = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { data: req, error: e1 } = await supabaseAdmin
      .from("access_requests")
      .select("id,email")
      .eq("id", data.id)
      .single();
    if (e1 || !req) throw new Error(e1?.message ?? "Solicitação não encontrada.");

    await supabaseAdmin
      .from("whitelist")
      .upsert({ email: req.email.toLowerCase(), created_by: context.userId }, { onConflict: "email" });

    await supabaseAdmin
      .from("access_requests")
      .update({ status: "approved", resolved_at: new Date().toISOString(), resolved_by: context.userId })
      .eq("id", data.id);

    return { ok: true };
  });

export const rejectRequest = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { data: req, error: e1 } = await supabaseAdmin
      .from("access_requests")
      .select("id,email")
      .eq("id", data.id)
      .single();
    if (e1 || !req) throw new Error(e1?.message ?? "Solicitação não encontrada.");

    await supabaseAdmin
      .from("blacklist")
      .upsert({ email: req.email.toLowerCase(), created_by: context.userId }, { onConflict: "email" });

    await supabaseAdmin
      .from("access_requests")
      .update({ status: "rejected", resolved_at: new Date().toISOString(), resolved_by: context.userId })
      .eq("id", data.id);

    return { ok: true };
  });

// Chamada pública (sem auth) pelo cliente quando o trigger bloqueia o signup,
// para garantir que a solicitação seja registrada e que admins recebam push.
export const reportPendingSignup = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ email: z.string().email() }).parse(d))
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase();

    // Se já está liberado, não cria solicitação nem notifica.
    const { data: wl } = await supabaseAdmin
      .from("whitelist")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (wl) return { ok: true, whitelisted: true };

    // Garante a solicitação pendente de forma idempotente e falha explicitamente
    // se o registro não for salvo — sem isso o cliente podia mostrar sucesso
    // mesmo sem criar nada para o admin aprovar.
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("access_requests")
      .select("id,notified_at")
      .eq("status", "pending")
      .ilike("email", email)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);

    let requestId = existing?.id;
    if (!requestId) {
      await supabaseAdmin.from("blacklist").delete().ilike("email", email);
      const { data: created, error: insertError } = await supabaseAdmin
        .from("access_requests")
        .insert({ email })
        .select("id,notified_at")
        .single();
      if (insertError) throw new Error(insertError.message);
      requestId = created.id;
    }

    let notifiedCount = 0;
    try {
      const result = await notifyAdmins({
        title: "Nova solicitação de acesso",
        body: email,
        url: "/admin/whitelist",
      });
      notifiedCount = result.sent;
      if (notifiedCount > 0) {
        await supabaseAdmin
          .from("access_requests")
          .update({ notified_at: new Date().toISOString() })
          .eq("id", requestId);
      }
    } catch (err) {
      console.error("notifyAdmins failed", err);
    }
    return { ok: true, requestId, notifiedCount };
  });

// Notifica admins sobre solicitações pendentes que ainda não foram notificadas.
// Cobre o caso de signup via Google quando o callback OAuth não devolve o e-mail
// no hash — o trigger já registrou em access_requests via record_pending_signup,
// mas nenhuma push foi disparada.
export const flushPendingNotifications = createServerFn({ method: "POST" }).handler(async () => {
  const { data: pending } = await supabaseAdmin
    .from("access_requests")
    .select("id,email")
    .eq("status", "pending")
    .is("notified_at", null)
    .limit(50);
  if (!pending || pending.length === 0) return { ok: true, sent: 0 };
  let sent = 0;
  const deliveredIds: string[] = [];
  for (const req of pending) {
    try {
      const result = await notifyAdmins({
        title: "Nova solicitação de acesso",
        body: req.email,
        url: "/admin/whitelist",
      });
      if (result.sent > 0) {
        sent += result.sent;
        deliveredIds.push(req.id);
      }
    } catch (err) {
      console.error("notifyAdmins failed", err);
    }
  }
  if (deliveredIds.length > 0) {
    await supabaseAdmin
      .from("access_requests")
      .update({ notified_at: new Date().toISOString() })
      .in("id", deliveredIds);
  }
  return { ok: true, sent };
});
