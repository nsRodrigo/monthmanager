import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "@/integrations/supabase/client-auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { notifyAdmins } from "./push.server";

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

    // Se já está na blacklist, não notifica nem cria
    const { data: bl } = await supabaseAdmin
      .from("blacklist")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (bl) return { ok: true, blacklisted: true };

    // Garante a solicitação (idempotente — índice único em pending)
    await supabaseAdmin.from("access_requests").insert({ email }).select().maybeSingle();

    try {
      await notifyAdmins({
        title: "Nova solicitação de acesso",
        body: email,
        url: "/admin/whitelist",
      });
    } catch (err) {
      console.error("notifyAdmins failed", err);
    }
    return { ok: true };
  });
