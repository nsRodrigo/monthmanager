import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/store/auth";
import { isWebAuthnSupported, isInIframe, browserStartAuthentication } from "@/lib/passkeys";
import {
  startAuthentication as srvStartAuth,
  finishAuthentication as srvFinishAuth,
  listPasskeys as srvList,
} from "@/lib/webauthn.functions";
import { supabase } from "@/integrations/supabase/client";

/**
 * Confirmação extra com biometria antes de uma ação sensível (excluir conta,
 * remover passkey, restaurar backup) — reusa o mesmo par start/finish
 * authentication já usado no login e no `BiometricLock`.
 *
 * Sem passkey cadastrado (ou ambiente sem suporte a WebAuthn, ex.: preview
 * do editor) a biometria aqui é um reforço OPCIONAL, não um requisito novo:
 * a função resolve `true` direto, sem travar quem nunca ativou biometria.
 *
 * Chame DEPOIS do `useConfirm()` de intenção já ter sido aceito — este hook
 * não substitui o "tem certeza?", só adiciona uma prova extra de posse do
 * dispositivo antes de executar.
 */
export function useBiometricStepUp() {
  const { user } = useAuth();
  const startAuthFn = useServerFn(srvStartAuth);
  const finishAuthFn = useServerFn(srvFinishAuth);
  const listFn = useServerFn(srvList);

  return async (): Promise<boolean> => {
    if (!user?.email) return true;
    if (isInIframe() || !isWebAuthnSupported()) return true;
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) return true;
      const list = (await listFn({ data: { accessToken: token } })) as Array<unknown>;
      if (!Array.isArray(list) || list.length === 0) return true;

      const options = await startAuthFn({ data: { email: user.email } });
      const response = await browserStartAuthentication({ optionsJSON: options as any });
      const result = (await finishAuthFn({ data: { email: user.email, response } })) as {
        success: boolean;
      };
      return !!result.success;
    } catch {
      // Prompt nativo cancelado ou falha na verificação — trata como "não confirmado".
      return false;
    }
  };
}
