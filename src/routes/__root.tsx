import { Link, Outlet, createRootRoute, HeadContent, Scripts, useLocation, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOut, Wallet, FileSpreadsheet, Settings, LayoutDashboard, Building2, Smartphone, TrendingUp, User, Receipt, Cloud, ShieldCheck } from "lucide-react";
import { RealtimeSync } from "@/components/RealtimeSync";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import appCss from "../styles.css?url";
import { AuthProvider, useAuth } from "@/store/auth";
import { ThemeProvider } from "@/store/theme";
import { AccountFilterProvider } from "@/store/account-filter";
import { PanesRegistryProvider, usePanes, useMaxPanes } from "@/store/panes";
import { useAccounts, type AccountType } from "@/store/finance";
import { useProfile } from "@/store/profile";
import { useIsAdmin } from "@/store/roles";
import { ManageAccountsDialog } from "@/components/ManageAccountsDialog";
import { InstallPrompt } from "@/components/InstallPrompt";
import { NavigationLoader } from "@/components/NavigationLoader";
import { BiometricLock } from "@/components/BiometricLock";
import { ConfirmProvider } from "@/store/confirm";
import { UndoRedoBar } from "@/components/UndoRedoBar";
import { history } from "@/store/history";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

const ICON_BY_TYPE: Record<AccountType, typeof Wallet> = {
  corrente: Building2,
  digital: Smartphone,
  carteira: Wallet,
  investimento: TrendingUp,
};

const DRAWER_WIDTH = 288; // 18rem (w-72)

/**
 * Estado + gestos de arraste da gaveta mobile. Dois modos, no mesmo hook:
 * - Gaveta ABERTA: arrastar nela fecha de cara (é uma superfície pequena e
 *   dedicada — qualquer arraste ali só pode significar "fechar").
 * - Conteúdo FECHADO: o gesto é ambíguo (pode ser um toque num botão, uma
 *   rolagem vertical, ou o swipe de abrir o menu), por isso só "assume" que é
 *   swipe-de-abrir depois de confirmar movimento predominantemente horizontal
 *   pra direita além de um limiar — só a partir daí mexe no estado. Um toque
 *   parado ou uma rolagem normal nunca chegam a acionar nada aqui, então
 *   cliques/scroll no resto da tela continuam funcionando por baixo.
 */
function useSwipeDrawer(open: boolean, setOpen: (v: boolean) => void) {
  const [dragX, setDragX] = useState<number | null>(null);
  const startRef = useRef<{ x: number; y: number; t: number; base: number } | null>(null);
  const committedRef = useRef(false);

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    const base = open ? DRAWER_WIDTH : 0;
    startRef.current = { x: e.clientX, y: e.clientY, t: performance.now(), base };
    if (open) {
      committedRef.current = true;
      setDragX(base);
      e.currentTarget.setPointerCapture(e.pointerId);
    } else {
      committedRef.current = false;
    }
  };
  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const start = startRef.current;
    if (!start) return;
    const dx = e.clientX - start.x;
    if (!committedRef.current) {
      const dy = e.clientY - start.y;
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return; // ainda ambíguo — espera mais movimento
      const horizontal = Math.abs(dx) > Math.abs(dy) * 1.3;
      if (!horizontal || dx <= 0) {
        startRef.current = null; // era rolagem vertical ou arraste pra esquerda — não é o gesto de abrir
        return;
      }
      committedRef.current = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // alguns navegadores recusam capturar fora de um pointerdown — sem problema, o arraste ainda funciona.
      }
    }
    setDragX(Math.max(0, Math.min(DRAWER_WIDTH, start.base + dx)));
  };
  const onPointerUp = () => {
    const start = startRef.current;
    startRef.current = null;
    if (!start || !committedRef.current) {
      committedRef.current = false;
      setDragX(null);
      return;
    }
    committedRef.current = false;
    const pos = dragX ?? start.base;
    const dt = Math.max(1, performance.now() - start.t);
    const delta = pos - start.base;
    const velocity = delta / dt; // px/ms
    setDragX(null);
    const shouldOpen = open
      ? !(delta < -DRAWER_WIDTH * 0.22 || velocity < -0.35)
      : delta > DRAWER_WIDTH * 0.22 || velocity > 0.35;
    setOpen(shouldOpen);
  };

  const pos = dragX ?? (open ? DRAWER_WIDTH : 0);
  const dragging = dragX !== null;
  return {
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
    pos,
    dragging,
  };
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">A página que você procura não existe.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0f172a" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Gestão" },
      { name: "format-detection", content: "telephone=no" },
      { title: "Gestão Financeira" },
      { name: "description", content: "Controle detalhado de gastos, cartões e parcelamentos por conta bancária." },
      { property: "og:title", content: "Gestão Financeira" },
      { name: "twitter:title", content: "Gestão Financeira" },
      { property: "og:description", content: "Controle detalhado de gastos, cartões e parcelamentos por conta bancária." },
      { name: "twitter:description", content: "Controle detalhado de gastos, cartões e parcelamentos por conta bancária." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/18c4ff5b-0931-4d13-ae61-96e2eaf5e2b6" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/18c4ff5b-0931-4d13-ae61-96e2eaf5e2b6" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/icon-512.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/icon-512.png" },
      { rel: "apple-touch-icon", sizes: "192x192", href: "/icon-192.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/**
 * Conteúdo da navegação, compartilhado pelas duas apresentações:
 * - "rail" (desktop/tablet): fica minimizada (só ícones) e expande no
 *   hover/foco, via `group-hover`/`group-focus-within` no `<aside>` pai —
 *   por isso os rótulos ficam em opacidade 0 por padrão.
 * - "drawer" (mobile): sempre com os rótulos visíveis, sem fade.
 */
function SidebarContent({
  onNavigate,
  labelClass = "",
}: {
  onNavigate?: () => void;
  labelClass?: string;
}) {
  const loc = useLocation();
  const { signOut, user } = useAuth();
  const panes = usePanes();
  const { data: accounts = [] } = useAccounts();
  const { data: profile } = useProfile();
  const isAdmin = useIsAdmin();
  const [manageOpen, setManageOpen] = useState(false);

  const isConsolidated = loc.pathname === "/";

  const displayName = profile?.displayName || user?.email?.split("@")[0] || "Você";
  const initials = displayName
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
          <Wallet className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className={`text-lg font-bold tracking-tight whitespace-nowrap ${labelClass}`}>
          Gestão Financeira
        </span>
      </div>

      <Link
        to="/"
        onClick={onNavigate}
        className={`mb-4 flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm font-medium transition-all ${
          isConsolidated
            ? "bg-gradient-primary text-primary-foreground shadow-glow"
            : "border border-border text-foreground hover:bg-secondary"
        }`}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center">
          <LayoutDashboard className="h-4 w-4" />
        </span>
        <span className={`whitespace-nowrap ${labelClass}`}>Home</span>
      </Link>

      <p className={`mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap ${labelClass}`}>
        Contas
      </p>
      <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden">
        {accounts.length === 0 && (
          <p className={`px-2 py-3 text-xs text-muted-foreground whitespace-nowrap ${labelClass}`}>
            Nenhuma conta. Clique em <strong>Adicionar conta</strong>.
          </p>
        )}
        {accounts.map((a) => {
          const Icon = ICON_BY_TYPE[a.type] ?? Wallet;
          const active = loc.pathname.startsWith(`/contas/${a.id}`);
          return (
            <Link
              key={a.id}
              to="/contas/$contaId"
              params={{ contaId: a.id }}
              title="Ctrl/Cmd+clique abre ao lado da conta atual"
              onClick={(e) => {
                if ((e.ctrlKey || e.metaKey) && loc.pathname.startsWith("/contas/")) {
                  panes.splitIn(a.id);
                  e.preventDefault();
                  onNavigate?.();
                  return;
                }
                onNavigate?.();
              }}
              className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-all ${
                active
                  ? "bg-secondary text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              }`}
            >
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: a.color + "25", color: a.color }}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
              <span className={`truncate whitespace-nowrap ${labelClass}`}>{a.name}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setManageOpen(true)}
          className="mt-2 flex w-full items-center gap-3 rounded-lg border border-dashed border-border px-2.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center">
            <Settings className="h-3.5 w-3.5" />
          </span>
          <span className={`whitespace-nowrap ${labelClass}`}>Gerenciar Conta</span>
        </button>
      </nav>

      <div className="mt-4 space-y-1 border-t border-border pt-4">
        <Link
          to="/importar-historico"
          onClick={onNavigate}
          className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-xs font-medium transition-all ${
            loc.pathname === "/importar-historico"
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
          }`}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center">
            <FileSpreadsheet className="h-3.5 w-3.5" />
          </span>
          <span className={`whitespace-nowrap ${labelClass}`}>Importar planilha</span>
        </Link>
        <Link
          to="/irpf"
          onClick={onNavigate}
          className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-xs font-medium transition-all ${
            loc.pathname.startsWith("/irpf")
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
          }`}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center">
            <Receipt className="h-3.5 w-3.5" />
          </span>
          <span className={`whitespace-nowrap ${labelClass}`}>Imposto de Renda</span>
        </Link>
        <Link
          to="/backup"
          onClick={onNavigate}
          className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-xs font-medium transition-all ${
            loc.pathname === "/backup"
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
          }`}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center">
            <Cloud className="h-3.5 w-3.5" />
          </span>
          <span className={`whitespace-nowrap ${labelClass}`}>Backup e sync</span>
        </Link>
        {isAdmin && (
          <Link
            to="/admin/whitelist"
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-xs font-medium transition-all ${
              loc.pathname === "/admin/whitelist"
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
            }`}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center">
              <ShieldCheck className="h-3.5 w-3.5" />
            </span>
            <span className={`whitespace-nowrap ${labelClass}`}>Whitelist e usuários</span>
          </Link>
        )}
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <Link
          to="/perfil"
          onClick={onNavigate}
          className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-secondary"
          aria-label="Abrir meu perfil"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-primary text-xs font-bold text-primary-foreground">
            {profile?.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt=""
                className="h-full w-full object-cover"
                onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
              />
            ) : (
              initials || <User className="h-4 w-4" aria-hidden="true" />
            )}
          </div>
          <div className={`min-w-0 flex-1 ${labelClass}`}>
            <p className="truncate text-xs font-semibold whitespace-nowrap">{displayName}</p>
            <p className="truncate text-[10px] text-muted-foreground whitespace-nowrap">{user?.email}</p>
          </div>
        </Link>
        <button
          onClick={() => signOut()}
          className="mt-1 flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center">
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <span className={`whitespace-nowrap ${labelClass}`}>Sair</span>
        </button>
      </div>

      <ManageAccountsDialog open={manageOpen} onClose={() => setManageOpen(false)} />
    </>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useRouterState({ select: (s) => s.location });
  const [redirected, setRedirected] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { handlers: dragHandlers, pos: dragPos, dragging } = useSwipeDrawer(mobileOpen, setMobileOpen);

  const isPublic = location.pathname === "/auth" || location.pathname === "/reset-password";

  useEffect(() => {
    if (loading) return;
    if (!user && !isPublic && !redirected) {
      setRedirected(true);
      navigate({ to: "/auth" });
    }
  }, [user, loading, isPublic, navigate, redirected]);

  // Limpa o histórico de desfazer/refazer quando o usuário desloga ou troca.
  useEffect(() => {
    if (!user) history.clear();
  }, [user?.id]);

  // Fecha a gaveta mobile ao trocar de rota.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Carregando" />
      </div>
    );
  }

  if (!user && !isPublic) return null;
  if (isPublic) return <>{children}</>;

  const translatePx = dragPos - DRAWER_WIDTH;
  const overlayOpacity = dragPos / DRAWER_WIDTH;
  const transition = dragging ? "none" : "180ms ease-out";

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop/tablet: minimizada (64px, só ícones), expande no hover/foco */}
      <aside
        tabIndex={0}
        className="group sticky top-0 hidden h-screen w-16 shrink-0 flex-col self-start overflow-hidden border-r border-border bg-card/40 p-3 transition-[width] duration-200 hover:w-60 focus-within:w-60 hover:p-5 focus-within:p-5 md:flex"
      >
        <SidebarContent labelClass="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity" />
      </aside>

      {/* Mobile: gaveta cheia, aberta por toque no ícone, arraste da borda, ou arrastando a própria gaveta */}
      <div
        className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm md:hidden"
        style={{
          opacity: overlayOpacity,
          transition: `opacity ${transition}`,
          pointerEvents: mobileOpen || dragging ? "auto" : "none",
        }}
        onClick={() => setMobileOpen(false)}
        aria-hidden={!mobileOpen && !dragging}
      />
      <aside
        className="fixed inset-y-0 left-0 z-50 flex w-72 touch-none flex-col border-r border-border bg-card p-5 md:hidden"
        style={{
          transform: `translateX(${translatePx}px)`,
          transition: `transform ${transition}`,
          pointerEvents: mobileOpen || dragging ? "auto" : "none",
        }}
        aria-hidden={!mobileOpen && !dragging}
        {...dragHandlers}
      >
        <SidebarContent onNavigate={() => setMobileOpen(false)} />
      </aside>
      <div
        className="flex min-w-0 flex-1 flex-col"
        style={{ touchAction: "pan-y" }}
        {...(!mobileOpen ? dragHandlers : {})}
      >
        <a href="#main-content" className="skip-link">
          Pular para o conteúdo
        </a>
        <main id="main-content" className="min-w-0 overflow-x-clip" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * Faixa fixa no rodapé com as contas "em segundo plano" — que já tiveram
 * painel aberto nesta sessão mas não estão visíveis agora. Fora de
 * /contas/*, clicar num chip abre só aquela conta (não reabre as outras
 * juntas). Já dentro de /contas/*, clicar divide a tela — adiciona aquela
 * conta ao lado da(s) que já está(ão) visível(is), respeitando o limite de
 * painéis do tamanho de tela atual.
 */
function PanesDock() {
  const { panes, activeIds, splitIn } = usePanes();
  const maxPanes = useMaxPanes();
  const location = useRouterState({ select: (s) => s.location });
  const { data: accounts = [] } = useAccounts();
  const navigate = useNavigate();

  const backgrounded = panes.filter((p) => !activeIds.includes(p.contaId));
  if (backgrounded.length === 0) return null;

  const onContasRoute = location.pathname.startsWith("/contas/");
  const canSplit = activeIds.length < maxPanes;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div className="pointer-events-auto flex max-w-full items-center gap-2 overflow-x-auto rounded-full border border-border bg-card/95 px-3 py-2 shadow-elevated backdrop-blur-md">
        <span className="shrink-0 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {onContasRoute ? "Abrir ao lado" : "Painéis abertos"}
        </span>
        {backgrounded.map((p) => {
          const a = accounts.find((x) => x.id === p.contaId);
          if (!a) return null;
          const disabled = onContasRoute && !canSplit;
          return (
            <button
              key={p.contaId}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (onContasRoute) {
                  splitIn(p.contaId);
                } else {
                  navigate({ to: "/contas/$contaId", params: { contaId: p.contaId } });
                }
              }}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-xs font-semibold transition-colors ${
                disabled ? "cursor-not-allowed opacity-40" : "hover:border-primary"
              }`}
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: a.color }} aria-hidden="true" />
              <span className="max-w-[8rem] truncate">{a.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RootComponent() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <AccountFilterProvider>
          <PanesRegistryProvider>
            <ConfirmProvider>
              <NavigationLoader />
              <RealtimeSync />
              <BiometricLock>
                <AuthGate>
                  <Outlet />
                </AuthGate>
              </BiometricLock>
              <UndoRedoBar />
              <PanesDock />
              <InstallPrompt />
            </ConfirmProvider>
          </PanesRegistryProvider>
          </AccountFilterProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
