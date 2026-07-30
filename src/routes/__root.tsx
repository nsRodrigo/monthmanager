import { Link, Outlet, createRootRoute, HeadContent, Scripts, useLocation, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOut, Wallet, FileSpreadsheet, Settings, LayoutDashboard, Building2, Smartphone, TrendingUp, User, Receipt, Cloud, ShieldCheck, Plus } from "lucide-react";
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
import { ManageAccountsDialog } from "@/components/ManageAccountsDialog";
import { InstallPrompt } from "@/components/InstallPrompt";
import { NavigationLoader } from "@/components/NavigationLoader";
import { BiometricLock } from "@/components/BiometricLock";
import { ConfirmProvider } from "@/store/confirm";
import { UndoRedoBar } from "@/components/UndoRedoBar";
import { FabAction } from "@/components/FabAction";
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
 * Menu de navegação flutuante — substitui o antigo menu lateral em todos os
 * tamanhos de tela. Fica no canto inferior esquerdo (a tela de meses já usa
 * o canto inferior direito para o FAB de "adicionar lançamento").
 */
function FloatingMenu() {
  const loc = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { data: accounts = [] } = useAccounts();
  const { data: profile } = useProfile();
  const isAdmin = useIsAdmin();
  const [open, setOpen] = useState(false);
  const [showAccounts, setShowAccounts] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
    setShowAccounts(false);
  }, [loc.pathname]);

  const close = () => {
    setOpen(false);
    setShowAccounts(false);
  };

  const go = (to: string) => {
    close();
    navigate({ to });
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <div className="fixed bottom-5 left-4 z-50 flex flex-col items-start gap-2.5 md:bottom-6 md:left-6">
        {open && showAccounts && (
          <div className="mb-1 max-h-[60vh] w-64 overflow-y-auto rounded-2xl border border-border bg-card p-2 shadow-elevated">
            <Link
              to="/"
              onClick={close}
              className={`flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium ${
                loc.pathname === "/" ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              }`}
            >
              <LayoutDashboard className="h-4 w-4" /> Home
            </Link>
            <p className="mb-1 px-2 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Contas
            </p>
            {accounts.length === 0 && (
              <p className="px-2 py-2 text-xs text-muted-foreground">Nenhuma conta ainda.</p>
            )}
            {accounts.map((a) => {
              const Icon = ICON_BY_TYPE[a.type] ?? Wallet;
              return (
                <Link
                  key={a.id}
                  to="/contas/$contaId"
                  params={{ contaId: a.id }}
                  onClick={close}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
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
              onClick={() => {
                setManageOpen(true);
                close();
              }}
              className="mt-1 flex w-full items-center gap-2 rounded-lg border border-dashed border-border px-2 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <Settings className="h-3.5 w-3.5" /> Gerenciar contas
            </button>
          </div>
        )}

        {open && !showAccounts && (
          <div className="flex flex-col items-start gap-2.5">
            <FabAction icon={LogOut} label="Sair" tone="debit" onClick={() => signOut()} />
            <FabAction icon={User} label="Meu perfil" tone="income" onClick={() => go("/perfil")} />
            {isAdmin && (
              <FabAction
                icon={ShieldCheck}
                label="Whitelist e usuários"
                tone="primary"
                onClick={() => go("/admin/whitelist")}
              />
            )}
            <FabAction icon={Cloud} label="Backup e sync" tone="primary" onClick={() => go("/backup")} />
            <FabAction icon={Receipt} label="Imposto de Renda" tone="primary" onClick={() => go("/irpf")} />
            <FabAction
              icon={FileSpreadsheet}
              label="Importar planilha"
              tone="primary"
              onClick={() => go("/importar-historico")}
            />
            <FabAction
              icon={Wallet}
              label="Trocar de conta"
              tone="income"
              onClick={() => setShowAccounts(true)}
            />
          </div>
        )}

        <button
          type="button"
          onClick={() => (showAccounts ? close() : setOpen((v) => !v))}
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
          className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-primary text-xs font-bold text-primary-foreground shadow-glow transition-transform duration-200 hover:opacity-90 ${
            open ? "rotate-45" : ""
          }`}
        >
          {open ? (
            <Plus className="h-6 w-6" />
          ) : profile?.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt=""
              className="h-full w-full object-cover"
              onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
            />
          ) : (
            <Plus className="h-6 w-6" />
          )}
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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Carregando" />
      </div>
    );
  }

  if (!user && !isPublic) return null;
  if (isPublic) return <>{children}</>;

  return (
    <div className="min-h-screen bg-background">
      <a href="#main-content" className="skip-link">
        Pular para o conteúdo
      </a>
      <main id="main-content" className="min-w-0 overflow-x-clip" tabIndex={-1}>
        {children}
      </main>
      <FloatingMenu />
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
