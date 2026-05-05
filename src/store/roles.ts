import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";

export type AppRole = "admin" | "user";

export function useMyRoles() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["roles", user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<AppRole[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as AppRole);
    },
  });
}

export function useIsAdmin() {
  const { data } = useMyRoles();
  return (data ?? []).includes("admin");
}

export type WhitelistEntry = { id: string; email: string; created_at: string };

export function useWhitelist() {
  return useQuery({
    queryKey: ["whitelist"],
    queryFn: async (): Promise<WhitelistEntry[]> => {
      const { data, error } = await supabase
        .from("whitelist")
        .select("id,email,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAddToWhitelist() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase
        .from("whitelist")
        .insert({ email: email.trim().toLowerCase(), created_by: user?.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["whitelist"] }),
  });
}

export function useRemoveFromWhitelist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("whitelist").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["whitelist"] }),
  });
}
