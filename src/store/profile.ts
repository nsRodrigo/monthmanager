import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";

export type Profile = {
  id: string;
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<Profile | null> => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, display_name, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        userId: data.user_id,
        displayName: data.display_name,
        avatarUrl: data.avatar_url,
      };
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { displayName?: string | null; avatarUrl?: string | null }) => {
      if (!user) throw new Error("Não autenticado");
      const payload: { user_id: string; display_name?: string | null; avatar_url?: string | null } = {
        user_id: user.id,
      };
      if (input.displayName !== undefined) payload.display_name = input.displayName;
      if (input.avatarUrl !== undefined) payload.avatar_url = input.avatarUrl;
      const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
  });
}
