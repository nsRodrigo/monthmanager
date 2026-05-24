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
 *
 * IMPORTANT: Realtime also echoes back changes originated by this same
 * client. If we invalidate immediately we race with in-flight optimistic
 * mutations (toggle paid, delete, insert recorrente) — which causes items
 * to briefly disappear ("some após marcar pago") or to appear duplicated
 * (refetch traz item que delete otimista ainda removeu). To avoid this:
 *   1) Coalesce bursts of events per table (debounce ~400ms)
 *   2) Wait for in-flight mutations to settle before invalidating
 *   3) Only refetch active queries
 */
export function RealtimeSync() {
  const qc = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    const pendingTables = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const flush = async () => {
      timer = null;
      const tables = Array.from(pendingTables);
      pendingTables.clear();
      if (tables.length === 0) return;

      // Wait until no mutations are in flight (cap 5s) to avoid clobbering
      // optimistic state with stale Realtime echoes of our own writes.
      const deadline = Date.now() + 5000;
      while (qc.isMutating() > 0 && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 120));
      }
      if (cancelled) return;

      const keys = new Set<string>();
      for (const t of tables) for (const k of TABLE_TO_KEYS[t] ?? []) keys.add(k);
      for (const key of keys) {
        qc.invalidateQueries({ queryKey: [key], refetchType: "active" });
      }
    };

    const schedule = (table: string) => {
      pendingTables.add(table);
      if (timer) return;
      timer = setTimeout(() => {
        void flush();
      }, 400);
    };

    const channel = supabase.channel(`finance-sync-${user.id}`);
    for (const table of Object.keys(TABLE_TO_KEYS)) {
      channel.on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table, filter: `user_id=eq.${user.id}` },
        () => schedule(table),
      );
    }
    channel.subscribe();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [user?.id, qc]);

  return null;
}
