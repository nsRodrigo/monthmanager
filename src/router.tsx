import { createRouter, useRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { navLoading, nextPaint } from "./store/nav-loading";

function DefaultErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-destructive"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          An unexpected error occurred. Please try again.
        </p>
        {import.meta.env.DEV && error.message && (
          <pre className="mt-4 max-h-40 overflow-auto rounded-md bg-muted p-3 text-left font-mono text-xs text-destructive">
            {error.message}
          </pre>
        )}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const getRouter = () => {
  const router = createRouter({
    routeTree,
    context: {},
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: DefaultErrorComponent,
    // Crossfade nativo (document.startViewTransition) entre navegações —
    // sem lib nova, cai pro comportamento normal em browsers sem suporte
    // (Firefox). Timing/easing customizados em styles.css.
    defaultViewTransition: true,
  });

  // `router.load` é o ponto de estrangulamento REAL de qualquer troca de
  // tela — não `router.navigate`. `navigate()` só muda a URL/histórico; é a
  // mudança no histórico que dispara `load()` por baixo (via
  // `history.subscribe`, ver node_modules/@tanstack/react-router/.../
  // Transitioner.js), e é ESSA chamada que resolve as rotas e reflete no
  // React. Envolver só `navigate` deixava passar batido o botão/gesto de
  // "voltar" do navegador (popstate) e forward, que disparam `load()`
  // direto, sem passar por `navigate()`. Envolvendo `load` em vez disso,
  // cobre TUDO com um só ponto: cliques em `<Link>`, `useNavigate()`,
  // voltar/avançar do navegador, e `router.invalidate()`.
  //
  // `getRouter()` roda tanto no cliente quanto no servidor (SSR no Cloudflare
  // Worker) — `requestAnimationFrame` (usado em `nextPaint`) não existe no
  // servidor, então esse embrulho só pode ser aplicado no cliente; no
  // servidor, `router.load` fica exatamente como o TanStack Router criou.
  if (typeof window !== "undefined") {
    const originalLoad = router.load;
    router.load = (async (opts: Parameters<typeof originalLoad>[0]) => {
      navLoading.begin();
      await nextPaint();
      try {
        return await originalLoad(opts);
      } finally {
        await nextPaint();
        navLoading.end();
      }
    }) as typeof router.load;
  }

  return router;
};
