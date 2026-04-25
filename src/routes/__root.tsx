import { Link, Outlet, createRootRoute, HeadContent, Scripts, useLocation, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, CreditCard, ArrowDownRight, ArrowUpRight, LogOut, Building2, Upload, CalendarDays, Settings, Wallet, FileSpreadsheet } from "lucide-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import appCss from "../styles.css?url";
import { AuthProvider, useAuth } from "@/store/auth";
import { AccountFilterProvider } from "@/store/account-filter";
import { AccountSwitcher } from "@/components/AccountSwitcher";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

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
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Finanças — Gestão pessoal" },
      { name: "description", content: "Controle detalhado de gastos, cartões e parcelamentos." },
      { property: "og:title", content: "Finanças — Gestão pessoal" },
      { name: "twitter:title", content: "Finanças — Gestão pessoal" },
      { property: "og:description", content: "Controle detalhado de gastos, cartões e parcelamentos." },
      { name: "twitter:description", content: "Controle detalhado de gastos, cartões e parcelamentos." },
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

function BottomNav() {
  const loc = useLocation();
  const items = [
    { to: "/", label: "Início", icon: LayoutDashboard, exact: true },
    { to: "/credito", label: "Crédito", icon: CreditCard, exact: false },
    { to: "/debito", label: "Débito", icon: ArrowDownRight, exact: false },
    { to: "/recebimentos", label: "Receber", icon: ArrowUpRight, exact: false },
    { to: "/meses", label: "Meses", icon: CalendarDays, exact: false },
  ] as const;
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-lg md:hidden">
      <div className="mx-auto flex max-w-2xl items-center justify-around px-1 py-2">
        {items.map((it) => {
          const active = it.exact ? loc.pathname === it.to : loc.pathname.startsWith(it.to);
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              className={`flex flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[10px] font-medium transition-colors ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function SideNav() {
  const loc = useLocation();
  const { signOut, user } = useAuth();
  const items = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { to: "/credito", label: "Crédito", icon: CreditCard, exact: false },
    { to: "/debito", label: "Débito + Investimentos", icon: ArrowDownRight, exact: false },
    { to: "/recebimentos", label: "Recebimentos", icon: ArrowUpRight, exact: false },
    { to: "/meses", label: "Visão mensal", icon: CalendarDays, exact: false },
    { to: "/contas", label: "Contas", icon: Building2, exact: false },
  ] as const;
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card/40 p-6 md:flex">
      <div className="mb-8 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
          <Wallet className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="text-lg font-bold tracking-tight">Finanças</span>
      </div>
      <div className="mb-6">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Conta ativa</p>
        <AccountSwitcher />
      </div>
      <nav className="flex-1 space-y-1">
        {items.map((it) => {
          const active = it.exact ? loc.pathname === it.to : loc.pathname.startsWith(it.to);
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                active
                  ? "bg-secondary text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {it.label}
            </Link>
          );
        })}
        <div className="my-2 border-t border-border" />
        <Link
          to="/importar"
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
            loc.pathname.startsWith("/importar")
              ? "bg-secondary text-foreground shadow-sm"
              : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
          }`}
        >
          <Upload className="h-4 w-4" />
          Importar CSV
        </Link>
      </nav>
      <div className="mt-6 border-t border-border pt-4">
        <p className="mb-2 truncate text-xs text-muted-foreground">{user?.email}</p>
        <button
          onClick={() => signOut()}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </div>
    </aside>
  );
}

function SettingsMenu() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
        aria-label="Configurações"
      >
        <Settings className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 top-11 z-50 w-56 overflow-hidden rounded-xl border border-border bg-card shadow-elevated">
            <p className="border-b border-border px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Configurações
            </p>
            <Link
              to="/importar"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-secondary"
            >
              <Upload className="h-4 w-4" /> Importar CSV
            </Link>
            <Link
              to="/importar-historico"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-secondary"
            >
              <FileSpreadsheet className="h-4 w-4" /> Importar planilha histórica
            </Link>
            <Link
              to="/contas"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-secondary"
            >
              <Building2 className="h-4 w-4" /> Gerenciar contas
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useRouterState({ select: (s) => s.location });
  const [redirected, setRedirected] = useState(false);

  useEffect(() => {
    if (loading) return;
    const path = location.pathname;
    if (!user && path !== "/auth" && !redirected) {
      setRedirected(true);
      navigate({ to: "/auth" });
    }
  }, [user, loading, location.pathname, navigate, redirected]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user && location.pathname !== "/auth") return null;

  if (location.pathname === "/auth") {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <SideNav />
      <div className="flex-1 pb-24 md:pb-0">
        <div className="flex items-center gap-3 border-b border-border bg-card/40 px-5 py-3 md:hidden">
          <div className="flex-1 min-w-0">
            <AccountSwitcher compact />
          </div>
          <SettingsMenu />
        </div>
        <div className="hidden md:flex justify-end px-6 pt-4">
          <SettingsMenu />
        </div>
        <main>{children}</main>
      </div>
      <BottomNav />
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
