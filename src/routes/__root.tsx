import { Link, Outlet, createRootRoute, HeadContent, Scripts, useLocation, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOut, Upload, Settings, Wallet, FileSpreadsheet, Plus, LayoutDashboard, Building2, Smartphone, TrendingUp, Menu, X } from "lucide-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import appCss from "../styles.css?url";
import { AuthProvider, useAuth } from "@/store/auth";
import { AccountFilterProvider } from "@/store/account-filter";
import { useAccounts, type AccountType } from "@/store/finance";
import { ManageAccountsDialog } from "@/components/ManageAccountsDialog";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

const ICON_BY_TYPE: Record<AccountType, typeof Wallet> = {
  corrente: Building2,
  digital: Smartphone,
  carteira: Wallet,
  investimento: TrendingUp,
};

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
  const [manageOpen, setManageOpen] = useState(false);

  const isConsolidated = loc.pathname === "/";

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
          <Plus className="h-3.5 w-3.5" /> Adicionar conta
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
        <button
          onClick={() => setManageOpen(true)}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
        >
          <Settings className="h-3.5 w-3.5" /> Configurações
        </button>
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <p className="mb-2 truncate text-xs text-muted-foreground">{user?.email}</p>
        <button
          onClick={() => signOut()}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <LogOut className="h-3.5 w-3.5" /> Sair
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

  const isPublic = location.pathname === "/auth" || location.pathname === "/reset-password";

  useEffect(() => {
    if (loading) return;
    if (!user && !isPublic && !redirected) {
      setRedirected(true);
      navigate({ to: "/auth" });
    }
  }, [user, loading, isPublic, navigate, redirected]);

  // close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user && !isPublic) return null;
  if (isPublic) return <>{children}</>;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-72 shrink-0 flex-col border-r border-border bg-card/40 p-5 md:flex">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-card p-5 md:hidden">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center gap-3 border-b border-border bg-card/40 px-4 py-3 md:hidden">
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-secondary"
            aria-label="Abrir menu"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary">
              <Wallet className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-sm font-bold tracking-tight">Gestão Financeira</span>
          </div>
        </header>

        <main className="min-w-0 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}

function RootComponent() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AccountFilterProvider>
          <AuthGate>
            <Outlet />
          </AuthGate>
        </AccountFilterProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
