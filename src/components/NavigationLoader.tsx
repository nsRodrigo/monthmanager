import { useNavLoading } from "@/store/nav-loading";
import { Loader2 } from "lucide-react";

/**
 * Overlay sutil que aparece durante uma troca de tela — fundo fosco com
 * spinner centralizado até a tela nova renderizar.
 *
 * Usa `useNavLoading` (ligado em `router.load`, ver src/router.tsx e
 * `withNavLoading` em src/store/nav-loading.ts) em vez do estado nativo do
 * router (`isLoading`/`isTransitioning`): rotas sem `loader` "terminam" a
 * navegação quase instantaneamente aos olhos do router, mesmo quando o
 * primeiro render da tela nova ainda trava a thread por um bom tempo (ex.:
 * recalcular todo o histórico financeiro de uma conta) — esse travamento
 * ficava fora da janela que o router expõe.
 *
 * Aparece IMEDIATAMENTE (sem debounce) de propósito: o app usa transição
 * visual nativa do navegador entre rotas (`defaultViewTransition` em
 * src/router.tsx), que tira uma "foto" da tela atual e congela nela até a
 * tela nova estar pronta — um debounce aqui (como os ~150ms que este
 * componente já teve) fazia esse overlay não existir ainda no instante em
 * que a foto era tirada, então ele nunca chegava a aparecer.
 */
export function NavigationLoader() {
  const isLoading = useNavLoading();

  if (!isLoading) return null;
  return (
    <div
      className="pointer-events-auto fixed inset-0 z-[200] flex items-center justify-center bg-background/60 backdrop-blur-sm"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-card/90 shadow-lg ring-1 ring-border">
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
      </div>
    </div>
  );
}
