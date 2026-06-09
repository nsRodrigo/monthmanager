import { Link, Outlet, createRootRoute, HeadContent, Scripts, useLocation, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOut, Upload, Wallet, FileSpreadsheet, Settings, LayoutDashboard, Building2, Smartphone, TrendingUp, X, User, Receipt, Cloud, ChevronRight } from "lucide-react";
import { RealtimeSync } from "@/components/RealtimeSync";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import appCss from "../styles.css?url";
import { AuthProvider, useAuth } from "@/store/auth";
import { ThemeProvider } from "@/store/theme";
import { AccountFilterProvider } from "@/store/account-filter";
import { useAccounts, type AccountType } from "@/store/finance";
import { useProfile } from "@/store/profile";
import { useIsAdmin } from "@/store/roles";
import { ShieldCheck } from "lucide-react";
import { ManageAccountsDialog } from "@/components/ManageAccountsDialog";
import { ProfileDialog } from "@/components/ProfileDialog";
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

function SwipeEdge({
  onOpen,
  hidden,
  onDrag,
  onDragEnd,
}: {
  onOpen: () => void;
  hidden: boolean;
  onDrag: (dx: number) => void;
  onDragEnd: (dx: number) => void;
}) {
  const stateRef = useState<{ x: number | null; y: number | null; active: boolean }>({
    x: null,
    y: null,
    active: false,
  })[0];

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    stateRef.x = t.clientX;
    stateRef.y = t.clientY;
    stateRef.active = false;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (stateRef.x == null || stateRef.y == null) return;
    const t = e.touches[0];
    const dx = t.clientX - stateRef.x;
    const dy = Math.abs(t.clientY - stateRef.y);
    if (!stateRef.active && dx > 8 && dy < 40) {
      stateRef.active = true;
    }
    if (stateRef.active) {
      onDrag(Math.max(0, Math.min(dx, DRAWER_WIDTH)));
    }
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (stateRef.x != null) {
      const t = e.changedTouches[0];
      const dx = t ? t.clientX - stateRef.x : 0;
      if (stateRef.active) {
        onDragEnd(Math.max(0, Math.min(dx, DRAWER_WIDTH)));
      } else {
        onDragEnd(0);
      }
    }
    stateRef.x = null;
    stateRef.y = null;
    stateRef.active = false;
  };

  if (hidden) return null;
  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      className="fixed inset-y-0 left-0 z-40 w-6 md:hidden"
      aria-hidden="true"
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label="Abrir menu"
        className="pointer-events-auto absolute top-1/2 left-0 -translate-y-1/2 flex items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
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

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const loc = useLocation();
  const { signOut, user } = useAuth();
  const { data: accounts = [] } = useAccounts();
  const { data: profile } = useProfile();
  const isAdmin = useIsAdmin();
  const [manageOpen, setManageOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

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
      <div className="mb-6 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
          <Wallet className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="text-lg font-bold tracking-tight">Gestão Financeira</span>
      </div>

      <Link
        to="/"
        onClick={onNavigate}
        className={`mb-4 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
          isConsolidated
            ? "bg-gradient-primary text-primary-foreground shadow-glow"
            : "border border-border text-foreground hover:bg-secondary"
        }`}
      >
        <LayoutDashboard className="h-4 w-4" />
        Home
      </Link>

      <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Contas
      </p>
      <nav className="flex-1 space-y-1 overflow-y-auto">
        {accounts.length === 0 && (
          <p className="px-2 py-3 text-xs text-muted-foreground">
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
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
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
              <span className="truncate">{a.name}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setManageOpen(true)}
          className="mt-2 flex w-full items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <Settings className="h-3.5 w-3.5" /> Gerenciar Conta
        </button>
      </nav>

      <div className="mt-4 space-y-1 border-t border-border pt-4">
        <Link
          to="/importar-historico"
          onClick={onNavigate}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
            loc.pathname === "/importar-historico"
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
          }`}
        >
          <FileSpreadsheet className="h-3.5 w-3.5" /> Importar planilha
        </Link>
        <Link
          to="/importar"
          onClick={onNavigate}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
            loc.pathname === "/importar"
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
          }`}
        >
          <Upload className="h-3.5 w-3.5" /> Importar CSV
        </Link>
        <Link
          to="/irpf"
          onClick={onNavigate}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
            loc.pathname.startsWith("/irpf")
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
          }`}
        >
          <Receipt className="h-3.5 w-3.5" /> Imposto de Renda
        </Link>
        <Link
          to="/backup"
          onClick={onNavigate}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
            loc.pathname === "/backup"
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
          }`}
        >
          <Cloud className="h-3.5 w-3.5" /> Backup e sync
        </Link>
        {isAdmin && (
          <Link
            to="/admin/whitelist"
            onClick={onNavigate}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
              loc.pathname === "/admin/whitelist"
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" /> Whitelist
          </Link>
        )}
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <button
          onClick={() => setProfileOpen(true)}
          className="flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-secondary"
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
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">{displayName}</p>
            <p className="truncate text-[10px] text-muted-foreground">{user?.email}</p>
          </div>
        </button>
        <button
          onClick={() => signOut()}
          className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" /> Sair
        </button>
      </div>

      <ManageAccountsDialog open={manageOpen} onClose={() => setManageOpen(false)} />
      <ProfileDialog open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useRouterState({ select: (s) => s.location });
  const [redirected, setRedirected] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dragX, setDragX] = useState(0);

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

  // close mobile drawer on route change
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

  // Drag offset (0..DRAWER_WIDTH) for the swipe-to-open drawer animation.
  const dragging = dragX > 0 && !mobileOpen;
  const translatePx = mobileOpen ? 0 : dragX - DRAWER_WIDTH;
  const overlayOpacity = mobileOpen ? 1 : dragX / DRAWER_WIDTH;

  const handleDragEnd = (dx: number) => {
    if (dx > DRAWER_WIDTH / 3) {
      setMobileOpen(true);
    }
    setDragX(0);
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col self-start overflow-y-auto border-r border-border bg-card/40 p-5 md:flex">
        <SidebarContent />
      </aside>

      {/* Mobile drawer (always mounted so drag can animate it in) */}
      {(mobileOpen || dragging) && (
        <div
          className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm md:hidden"
          style={{ opacity: overlayOpacity, transition: dragging ? "none" : "opacity 300ms ease-out" }}
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-card p-5 md:hidden"
        style={{
          transform: `translateX(${translatePx}px)`,
          transition: dragging ? "none" : "transform 300ms ease-out",
          visibility: mobileOpen || dragging ? "visible" : "hidden",
        }}
        aria-hidden={!mobileOpen && !dragging}
      >
        <SidebarContent onNavigate={() => setMobileOpen(false)} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Swipe-from-left edge / tap-to-open menu (mobile) */}
        <SwipeEdge
          onOpen={() => setMobileOpen(true)}
          hidden={mobileOpen}
          onDrag={setDragX}
          onDragEnd={handleDragEnd}
        />


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

function RootComponent() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <AccountFilterProvider>
            <ConfirmProvider>
              <NavigationLoader />
              <RealtimeSync />
              <BiometricLock>
                <AuthGate>
                  <Outlet />
                </AuthGate>
              </BiometricLock>
              <UndoRedoBar />
              <InstallPrompt />
            </ConfirmProvider>
          </AccountFilterProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
