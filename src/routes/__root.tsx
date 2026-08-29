import {
  Link,
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
  useLocation,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import {
  LogOut,
  Wallet,
  FileSpreadsheet,
  Settings,
  LayoutDashboard,
  Building2,
  Smartphone,
  TrendingUp,
  User,
  Cloud,
  ShieldCheck,
} from "lucide-react";
import { RealtimeSync } from "@/components/RealtimeSync";
import { Logo } from "@/components/Logo";
import { AppLoader } from "@/components/AppLoader";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import appCss from "../styles.css?url";
import { AuthProvider, useAuth } from "@/store/auth";
import { ThemeProvider } from "@/store/theme";
import { AccountFilterProvider } from "@/store/account-filter";
import { PanesRegistryProvider, usePanes } from "@/store/panes";
import { LockSettingsProvider } from "@/store/lock-settings";
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

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">A página que você procura não existe.</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
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
      {
        name: "description",
        content: "Controle detalhado de gastos, cartões e parcelamentos por conta bancária.",
      },
      { property: "og:title", content: "Gestão Financeira" },
      { name: "twitter:title", content: "Gestão Financeira" },
      {
        property: "og:description",
        content: "Controle detalhado de gastos, cartões e parcelamentos por conta bancária.",
      },
      {
        name: "twitter:description",
        content: "Controle detalhado de gastos, cartões e parcelamentos por conta bancária.",
      },
      {
        property: "og:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/18c4ff5b-0931-4d13-ae61-96e2eaf5e2b6",
      },
      {
        name: "twitter:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/18c4ff5b-0931-4d13-ae61-96e2eaf5e2b6",
      },
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
 * Conteúdo da navegação, compartilhado pelas duas apresentações — desktop
 * (sidebar fixa, sempre expandida) e mobile (gaveta) — ambas sempre com os
 * rótulos visíveis.
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
        <Logo size="sm" />
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

      <p
        className={`mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap ${labelClass}`}
      >
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
          const active =
            loc.pathname.startsWith("/contas/") && panes.panes.some((p) => p.contaId === a.id);
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
                // Chama openSingle direto (não só via navegação): se a conta
                // clicada já é a "principal" da URL atual mas há outras
                // divididas ao lado, o router não dispara nada (mesma URL) —
                // sem isso, as outras ficariam presas na tela.
                panes.openSingle(a.id);
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
            <p className="truncate text-[10px] text-muted-foreground whitespace-nowrap">
              {user?.email}
            </p>
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
          aria-label="Carregando"
        />
      </div>
    );
  }

  if (!user && !isPublic) return null;
  if (isPublic) return <>{children}</>;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop/tablet: sempre expandida (240px), sem recolher. No mobile a
          navegação vive nos botões flutuantes de cada tela (☰ na Home/Meses,
          "Configurações" dentro do "+" no Lançamento) em vez de uma gaveta. */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col self-start overflow-hidden border-r border-border bg-card/40 p-5 md:flex">
        <SidebarContent />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
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
    <>
      <AppLoader />
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <AccountFilterProvider>
              <PanesRegistryProvider>
                <ConfirmProvider>
                  <NavigationLoader />
                  <RealtimeSync />
                  <LockSettingsProvider>
                    <BiometricLock>
                      <AuthGate>
                        <Outlet />
                      </AuthGate>
                    </BiometricLock>
                  </LockSettingsProvider>
                  <UndoRedoBar />
                  <InstallPrompt />
                </ConfirmProvider>
              </PanesRegistryProvider>
            </AccountFilterProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </>
  );
}
