import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "@/integrations/supabase/client-auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { refreshGoogleAccessToken, revokeGoogleToken, uploadJsonToDrive } from "@/server/google-drive.server";

export const getGoogleDriveStatus = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("google_drive_tokens")
      .select("connected_at, last_synced_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      connected: !!data,
      connectedAt: data?.connected_at ?? null,
      lastSyncedAt: data?.last_synced_at ?? null,
    };
  });

export const connectGoogleDrive = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((data) => z.object({ refreshToken: z.string().min(10) }).parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await supabaseAdmin
      .from("google_drive_tokens")
      .upsert(
        { user_id: context.userId, refresh_token: data.refreshToken, connected_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const disconnectGoogleDrive = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin
      .from("google_drive_tokens")
      .select("refresh_token")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (data?.refresh_token) await revokeGoogleToken(data.refresh_token);
    const { error } = await supabaseAdmin.from("google_drive_tokens").delete().eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const uploadBackupToGoogleDrive = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((data) => z.object({ fileName: z.string().min(1), payloadJson: z.string().min(2) }).parse(data))
  .handler(async ({ context, data }) => {
    const { data: row, error: readError } = await supabaseAdmin
      .from("google_drive_tokens")
      .select("refresh_token")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!row) throw new Error("Google Drive não está conectado.");

    const accessToken = await refreshGoogleAccessToken(row.refresh_token);
    await uploadJsonToDrive(accessToken, data.fileName, data.payloadJson);

    const { error: updateError } = await supabaseAdmin
      .from("google_drive_tokens")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("user_id", context.userId);
    if (updateError) throw new Error(updateError.message);

    return { ok: true };
  });
