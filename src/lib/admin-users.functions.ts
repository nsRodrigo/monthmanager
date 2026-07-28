import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "@/integrations/supabase/client-auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso negado: requer admin.");
}

export type AdminUser = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  is_admin: boolean;
};

export const listUsers = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminUser[]> => {
    await assertAdmin(context.userId);

    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (error) throw new Error(error.message);

    const ids = data.users.map((u) => u.id);
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id,role")
      .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

    const adminSet = new Set(
      (roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id),
    );

    return data.users.map((u) => ({
      id: u.id,
      email: u.email ?? null,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      is_admin: adminSet.has(u.id),
    }));
  });

export const setUserAdmin = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ userId: z.string().uuid(), isAdmin: z.boolean() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);

    if (data.userId === context.userId && !data.isAdmin) {
      throw new Error("Você não pode remover seu próprio acesso de admin.");
    }

    if (data.isAdmin) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", "admin");
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ userId: z.string().uuid(), alsoRemoveWhitelist: z.boolean().optional() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);

    if (data.userId === context.userId) {
      throw new Error("Você não pode revogar seu próprio acesso.");
    }

    // Pega email antes de deletar (caso queira tirar da whitelist)
    const { data: target } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    const email = target?.user?.email ?? null;

    // Apaga dados do app desse usuário (RLS bypass via service role)
    const tables = [
      "card_payments",
      "installments",
      "purchases",
      "debits",
      "incomes",
      "investments",
      "cards",
      "accounts",
      "user_passkeys",
      "user_roles",
      "profiles",
    ] as const;
    for (const t of tables) {
      await supabaseAdmin.from(t).delete().eq("user_id", data.userId);
    }

    if (data.alsoRemoveWhitelist && email) {
      await supabaseAdmin.from("whitelist").delete().ilike("email", email);
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
