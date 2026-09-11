import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";

/**
 * Notificações são sempre da conta autenticada de verdade (nunca da conta
 * "vista" via `useActiveUserId`) — é a caixa de entrada da própria pessoa,
 * não um dado financeiro delegável.
 */
export type AppNotification = {
  id: string;
  title: string;
  body: string;
  url: string | null;
  kind: string;
  relatedId: string | null;
  read: boolean;
  createdAt: string;
};

function mapNotification(row: {
  id: string;
  title: string;
  body: string;
  url: string | null;
  kind: string;
  related_id: string | null;
  read: boolean;
  created_at: string;
}): AppNotification {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    url: row.url,
    kind: row.kind,
    relatedId: row.related_id,
    read: row.read,
    createdAt: row.created_at,
  };
}

export function useNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<AppNotification[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []).map(mapNotification);
    },
  });
}

export function useUnreadNotificationsCount(): number {
  const { data = [] } = useNotifications();
  return data.filter((n) => !n.read).length;
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkAllNotificationsRead() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

/** Realtime — chegam sozinhas sem precisar recarregar (mesmo padrão de `account-access.ts`). */
export function useNotificationsRealtime() {
  const { user } = useAuth();
  const qc = useQueryClient();
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["notifications"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, qc]);
}
