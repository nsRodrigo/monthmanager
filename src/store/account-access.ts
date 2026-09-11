import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { requestAccountAccess } from "@/lib/account-access.functions";
import { useAuth } from "./auth";
import { useViewingAs } from "./account-view";

export type AccessGrantStatus = "pending" | "active" | "revoked" | "rejected";

export type AccessGrant = {
  id: string;
  requesterId: string;
  ownerId: string;
  requesterEmail: string;
  ownerEmail: string;
  status: AccessGrantStatus;
  requestedAt: string;
  decidedAt: string | null;
};

function mapGrant(row: {
  id: string;
  requester_id: string;
  owner_id: string;
  requester_email: string;
  owner_email: string;
  status: string;
  requested_at: string;
  decided_at: string | null;
}): AccessGrant {
  return {
    id: row.id,
    requesterId: row.requester_id,
    ownerId: row.owner_id,
    requesterEmail: row.requester_email,
    ownerEmail: row.owner_email,
    status: row.status as AccessGrantStatus,
    requestedAt: row.requested_at,
    decidedAt: row.decided_at,
  };
}

/** Pedidos que EU enviei — contas às quais tenho (ou pedi) acesso. */
export function useOutgoingGrants() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["account-access-grants", "outgoing", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<AccessGrant[]> => {
      const { data, error } = await supabase
        .from("account_access_grants")
        .select("*")
        .eq("requester_id", user!.id)
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapGrant);
    },
  });
}

/** Pedidos que EU recebi — gente pedindo acesso à minha conta. */
export function useIncomingGrants() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["account-access-grants", "incoming", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<AccessGrant[]> => {
      const { data, error } = await supabase
        .from("account_access_grants")
        .select("*")
        .eq("owner_id", user!.id)
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapGrant);
    },
  });
}

export function useRequestAccess() {
  const qc = useQueryClient();
  const fn = useServerFn(requestAccountAccess);
  return useMutation({
    mutationFn: (ownerEmail: string) => fn({ data: { ownerEmail } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["account-access-grants"] }),
  });
}

/** Dono aprova/recusa um pedido recebido. */
export function useDecideGrant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; approve: boolean }) => {
      const { error } = await supabase
        .from("account_access_grants")
        .update({ status: vars.approve ? "active" : "rejected", decided_at: new Date().toISOString() })
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["account-access-grants"] }),
  });
}

/** Dono revoga um acesso já concedido, OU quem pediu abre mão do próprio acesso. */
export function useRevokeGrant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("account_access_grants")
        .update({ status: "revoked", decided_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["account-access-grants"] }),
  });
}

/**
 * Se a conta que se está "vendo" teve o acesso revogado enquanto o app
 * estava fechado, volta pra própria conta sozinho — chamado uma vez perto
 * da raiz (`AuthGate` em `src/routes/__root.tsx`).
 */
export function useValidateViewingAs() {
  const { data: outgoing } = useOutgoingGrants();
  const [viewingAs, setViewingAs] = useViewingAs();
  useEffect(() => {
    if (!viewingAs || !outgoing) return;
    const stillActive = outgoing.some((g) => g.ownerId === viewingAs.userId && g.status === "active");
    if (!stillActive) setViewingAs(null);
  }, [viewingAs, outgoing, setViewingAs]);
}

/** Realtime (mesmo padrão de `admin.whitelist.tsx`): reflete aprovação/revogação sem precisar recarregar. */
export function useAccountAccessRealtime() {
  const { user } = useAuth();
  const qc = useQueryClient();
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("account-access-grants")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "account_access_grants" },
        () => qc.invalidateQueries({ queryKey: ["account-access-grants"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, qc]);
}
