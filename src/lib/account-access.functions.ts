import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "@/integrations/supabase/client-auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { notifyUsers } from "@/server/push.server";

/**
 * Pede acesso de leitura+escrita completo à conta de `ownerEmail`. Usada
 * tanto pelo botão da tela Whitelist (admin já sabe o e-mail) quanto pelo
 * formulário "Pedir acesso a outra conta" de qualquer usuário — sem
 * checagem de admin, é o mesmo mecanismo pros dois casos.
 */
export const requestAccountAccess = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((d) => z.object({ ownerEmail: z.string().email() }).parse(d))
  .handler(async ({ context, data }) => {
    const email = data.ownerEmail.toLowerCase().trim();
    const requesterEmail = (context.claims.email as string | undefined)?.toLowerCase() ?? "";

    const { data: usersPage, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (error) throw new Error(error.message);

    const owner = usersPage.users.find((u) => u.email?.toLowerCase() === email);
    if (!owner) throw new Error("Não encontramos nenhuma conta com esse e-mail.");
    if (owner.id === context.userId) {
      throw new Error("Você não pode pedir acesso à sua própria conta.");
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("account_access_grants")
      .select("id,status")
      .eq("requester_id", context.userId)
      .eq("owner_id", owner.id)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);

    if (existing?.status === "active") throw new Error("Você já tem acesso a essa conta.");
    if (existing?.status === "pending") throw new Error("Já existe um pedido pendente para essa conta.");

    if (existing) {
      const { error: updateError } = await supabaseAdmin
        .from("account_access_grants")
        .update({ status: "pending", requested_at: new Date().toISOString(), decided_at: null })
        .eq("id", existing.id);
      if (updateError) throw new Error(updateError.message);
    } else {
      const { error: insertError } = await supabaseAdmin.from("account_access_grants").insert({
        requester_id: context.userId,
        owner_id: owner.id,
        requester_email: requesterEmail,
        owner_email: email,
      });
      if (insertError) throw new Error(insertError.message);
    }

    try {
      await notifyUsers([owner.id], {
        title: "Pedido de acesso à sua conta",
        body: `${requesterEmail || "Alguém"} pediu acesso de leitura e escrita à sua conta no Gestão Financeira.`,
        url: "/perfil",
      });
    } catch (err) {
      console.error("notifyUsers failed", err);
    }

    return { ok: true };
  });
