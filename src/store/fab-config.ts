import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";
import { DEFAULTS, type FabConfigValue, type FabFolder, type ScreenId } from "@/lib/fab-catalog";

/**
 * Config do menu flutuante de uma tela — sempre do usuário REAL autenticado
 * (`useAuth().user.id`), nunca de `useActiveUserId()`/conta delegada: é
 * preferência pessoal de UI, mesmo padrão de `useProfile` (`src/store/profile.ts`).
 * Sem linha no banco = usa o default hard-coded daquela tela (comportamento
 * de hoje, intocado até a pessoa customizar).
 */
export function useFabConfig(screenId: ScreenId) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["fab-config", user?.id, screenId],
    enabled: !!user,
    queryFn: async (): Promise<FabConfigValue> => {
      const { data, error } = await supabase
        .from("fab_menu_configs")
        .select("icon, config")
        .eq("user_id", user!.id)
        .eq("screen_id", screenId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return DEFAULTS[screenId];
      const config = (data.config ?? {}) as { actions?: string[]; folders?: Record<string, FabFolder> };
      return {
        icon: data.icon,
        actions: config.actions ?? [],
        folders: config.folders ?? {},
      };
    },
  });
}

export function useSaveFabConfig() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { screenId: ScreenId; value: FabConfigValue }) => {
      const { error } = await supabase.from("fab_menu_configs").upsert(
        {
          user_id: user!.id,
          screen_id: args.screenId,
          icon: args.value.icon,
          config: { actions: args.value.actions, folders: args.value.folders },
        },
        { onConflict: "user_id,screen_id" },
      );
      if (error) throw error;
    },
    onSuccess: (_d, args) => qc.invalidateQueries({ queryKey: ["fab-config", user?.id, args.screenId] }),
  });
}
