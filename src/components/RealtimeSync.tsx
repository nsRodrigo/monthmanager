import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/store/auth";

const TABLE_TO_KEYS: Record<string, string[]> = {
  accounts: ["accounts"],
  cards: ["cards"],
  purchases: ["purchases"],
  installments: ["installments"],
  debits: ["debits"],
  incomes: ["incomes"],
  investments: ["investments"],
  card_payments: ["card_payments"],
};

/**
 * Subscribes to Postgres changes on the user's financial tables and
 * invalidates the corresponding React Query caches so changes from
 * other devices show up automatically.
 */
export function RealtimeSync() {
  const qc = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase.channel(`finance-sync-${user.id}`);
    for (const table of Object.keys(TABLE_TO_KEYS)) {
      channel.on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table, filter: `user_id=eq.${user.id}` },
        () => {
          for (const key of TABLE_TO_KEYS[table]) {
            qc.invalidateQueries({ queryKey: [key] });
          }
        },
      );
    }
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, qc]);

  return null;
}
