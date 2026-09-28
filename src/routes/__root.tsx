import {
  Link,
  type LinkProps,
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
  FileSpreadsheet,
  Plus,
  Menu,
  Home as HomeIcon,
  User,
  Cloud,
  ShieldCheck,
  MapPin,
  Calculator,
  Wallet,
  Bell,
  Receipt,
} from "lucide-react";
import { RealtimeSync } from "@/components/RealtimeSync";
import { Logo } from "@/components/Logo";
import { FitLabel } from "@/components/FitLabel";
import { AppLoader } from "@/components/AppLoader";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { formatCompactCurrency } from "@/lib/format";

import appCss from "../styles.css?url";
import { AuthProvider, useAuth } from "@/store/auth";
import { ThemeProvider } from "@/store/theme";
import { AccountFilterProvider } from "@/store/account-filter";
import { PanesRegistryProvider, usePanes } from "@/store/panes";
import { LockSettingsProvider } from "@/store/lock-settings";
import {
  useAccounts,
  useCards,
  usePurchases,
  useInstallments,
  useDebits,
  useIncomes,
  useInvestments,
  computeAccountBalanceUntilNow,
  normalizeZero,
  getEffectiveCurrentMonth,
} from "@/store/finance";
import { useProfile } from "@/store/profile";
import { useIsAdmin } from "@/store/roles";
import { ManageAccountsDialog } from "@/components/ManageAccountsDialog";
import { FloatingCalculator } from "@/components/FloatingCalculator";
import { InstallPrompt } from "@/components/InstallPrompt";
import { NavigationLoader } from "@/components/NavigationLoader";
import { BiometricLock } from "@/components/BiometricLock";
import { ConfirmProvider } from "@/store/confirm";
import { UndoRedoBar } from "@/components/UndoRedoBar";
import { history } from "@/store/history";
import { AccountSwitcher } from "@/components/AccountSwitcher";
import { CommandPalette } from "@/components/CommandPalette";
import { AdminViewingBanner } from "@/components/AdminViewingBanner";
import { ConfigurableFab } from "@/components/ConfigurableFab";
import { screenIdForPathname } from "@/lib/fab-catalog";
import { useAccountAccessRealtime, useValidateViewingAs } from "@/store/account-access";
import { useUnreadNotificationsCount, useNotificationsRealtime } from "@/store/notifications";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

function NotFoundComponent() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-gradient-band px-4">
      <div className="animate-splash-icon-in">
        <Logo size="lg" />
      </div>
      <div className="animate-splash-text-in max-w-md text-center">
        <h1 className="text-7xl font-extrabold tracking-tight text-white">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-white">Página não encontrada</h2>
        <p className="mt-2 text-sm text-white/75">A página que você procura não existe.</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-primary hover:opacity-90"
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
      { name: "google-site-verification", content: "EB3trm0Ix_rSERYttcd2qfOkdCJEWUQVH2PV1sJbYFQ" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0a0f0e" },
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
        href: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=Geist:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&display=swap",
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
 * Item de navegação — mesma aparência em qualquer lugar (sidebar larga,
 * trilho de ícones, gaveta mobile). `labelClass` esconde o rótulo no trilho.
 */
function navItemClass(active: boolean, rail: boolean) {
  return `relative flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium transition-colors ${
    rail ? "md:justify-center xl:justify-start" : ""
  } ${
    active
      ? "bg-muted text-foreground [&_svg]:text-primary"
      : "text-muted-foreground hover:bg-card hover:text-foreground"
  }`;
}

function NavGroup({
  label,
  rail,
  labelClass,
}: {
  label: string;
  rail: boolean;
  labelClass: string;
}) {
  return (
    <>
      {rail && <div className="mx-2 my-3 h-px bg-border xl:hidden" aria-hidden="true" />}
      <p
        className={`px-2.5 pt-4 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.09em] whitespace-nowrap text-muted-foreground ${labelClass} ${
          rail ? "hidden xl:block" : ""
        }`}
      >
        {label}
      </p>
    </>
  );
}

/**
 * Conteúdo da navegação, compartilhado pelas apresentações — sidebar larga
 * (xl), trilho de ícones (md–xl, `rail`) e gaveta mobile (aberta pelo "Mais"
 * da barra inferior). O trilho esconde só os rótulos (`labelClass`).
 */
function SidebarContent({
  onNavigate,
  labelClass = "",
  rail = false,
}: {
  onNavigate?: () => void;
  labelClass?: string;
  rail?: boolean;
}) {
  const loc = useLocation();
  const { signOut, user } = useAuth();
  const panes = usePanes();
  const { data: accounts = [] } = useAccounts();
  const { data: cards = [] } = useCards();
  const { data: purchases = [] } = usePurchases();
  const { data: installments = [] } = useInstallments();
  const { data: debits = [] } = useDebits();
  const { data: incomes = [] } = useIncomes();
  const { data: investments = [] } = useInvestments();
  const { data: profile } = useProfile();
  const isAdmin = useIsAdmin();
  const unreadCount = useUnreadNotificationsCount();
  const [manageOpen, setManageOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);

  const isConsolidated = loc.pathname === "/";

  const displayName = profile?.displayName || user?.email?.split("@")[0] || "Você";
  const initials = displayName
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Saldo atual de cada conta, no fim do item — vê o dinheiro sem abrir a conta.
  const balances = useMemo(() => {
    const today = new Date();
    const map = new Map<string, number>();
    for (const a of accounts) {
      map.set(
        a.id,
        normalizeZero(
          computeAccountBalanceUntilNow(
            a,
            cards,
            purchases,
            installments,
            debits,
            incomes,
            investments,
            today,
          ),
        ),
      );
    }
    return map;
  }, [accounts, cards, purchases, installments, debits, incomes, investments]);

  const link = (to: LinkProps["to"], label: string, Icon: typeof Bell, extra?: React.ReactNode) => (
    <Link
      to={to}
      onClick={onNavigate}
      title={label}
      className={navItemClass(loc.pathname === to, rail)}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
      <span className={`flex-1 truncate whitespace-nowrap ${labelClass}`}>{label}</span>
      {extra}
    </Link>
  );

  return (
    <>
      <div
        className={`mb-3 flex items-center gap-2.5 px-1 ${rail ? "md:justify-center xl:justify-start" : ""}`}
      >
        <Logo size="sm" />
        <span
          className={`font-display text-lg font-semibold tracking-tight whitespace-nowrap ${labelClass}`}
        >
          Gestão
        </span>
      </div>

      <Link to="/" onClick={onNavigate} title="Home" className={navItemClass(isConsolidated, rail)}>
        <HomeIcon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
        <span className={`flex-1 whitespace-nowrap ${labelClass}`}>Home</span>
      </Link>

      <NavGroup label="Contas" rail={rail} labelClass={labelClass} />
      <nav className="space-y-0.5 overflow-x-hidden">
        {accounts.length === 0 && (
          <p className={`px-2 py-3 text-xs text-muted-foreground whitespace-nowrap ${labelClass}`}>
            Nenhuma conta. Clique em <strong>Gerenciar contas</strong>.
          </p>
        )}
        {accounts.map((a) => {
          const active =
            loc.pathname.startsWith("/contas/") && panes.panes.some((p) => p.contaId === a.id);
          const bal = balances.get(a.id) ?? 0;
          return (
            <Link
              key={a.id}
              to="/contas/$contaId"
              params={{ contaId: a.id }}
              title={`${a.name} — Ctrl/Cmd+clique abre ao lado da conta atual`}
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
              className={navItemClass(active, rail)}
            >
              <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: a.color }}
                  aria-hidden="true"
                />
              </span>
              <span className={`flex-1 truncate whitespace-nowrap ${labelClass}`}>{a.name}</span>
              <span
                className={`text-xs font-normal tabular-nums ${
                  bal < 0 ? "text-destructive" : "text-muted-foreground"
                } ${labelClass}`}
              >
                {formatCompactCurrency(bal)}
              </span>
            </Link>
          );
        })}
        <button
          onClick={() => setManageOpen(true)}
          title="Gerenciar contas"
          className={navItemClass(false, rail)}
        >
          <Plus className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
          <span className={`whitespace-nowrap ${labelClass}`}>Gerenciar contas</span>
        </button>
      </nav>

      <NavGroup label="Ferramentas" rail={rail} labelClass={labelClass} />
      <div className="space-y-0.5">
        {link(
          "/notificacoes",
          "Notificações",
          Bell,
          unreadCount > 0 ? (
            <span
              className={`rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground whitespace-nowrap ${labelClass}`}
            >
              {unreadCount}
            </span>
          ) : null,
        )}
        {link("/importar-historico", "Importar planilha", FileSpreadsheet)}
        {link("/backup", "Backup e sync", Cloud)}
        {link("/locais-produtos", "Locais e produtos", MapPin)}
        {link("/meios-pagamento", "Meios de pagamento", Wallet)}
        <button
          type="button"
          onClick={() => setCalcOpen(true)}
          title="Calculadora"
          className={navItemClass(false, rail)}
        >
          <Calculator className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
          <span className={`whitespace-nowrap ${labelClass}`}>Calculadora</span>
        </button>
        {isAdmin && link("/admin/whitelist", "Administração", ShieldCheck)}
      </div>

      <div className="mt-auto space-y-0.5 border-t border-border pt-3">
        <div className={rail ? "hidden xl:block" : ""}>
          <AccountSwitcher variant="dropdown" />
        </div>
        {rail && (
          <Link
            to="/perfil"
            title="Meu perfil"
            className="flex items-center justify-center rounded-xl py-2 hover:bg-card xl:hidden"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-secondary text-[11px] font-bold text-primary">
              {initials || <User className="h-4 w-4" aria-hidden="true" />}
            </span>
          </Link>
        )}
        <button onClick={() => signOut()} title="Sair" className={navItemClass(false, rail)}>
          <LogOut className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
          <span className={`whitespace-nowrap ${labelClass}`}>Sair</span>
        </button>
      </div>

      <ManageAccountsDialog open={manageOpen} onClose={() => setManageOpen(false)} />
      <FloatingCalculator open={calcOpen} onClose={() => setCalcOpen(false)} />
    </>
  );
}

/**
 * Navegação inferior — só mobile (o desktop tem a sidebar). Home, Contas,
 * Lançamentos (mês vigente) e "Mais" (página própria com a lista de atalhos
 * — ver `src/routes/mais.tsx`). Notificações agora mora no cabeçalho (ver
 * `HeaderActions`). Os FABs e os painéis descontam a altura dela via
 * `--bnav-h` (styles.css).
 */
function BottomNav() {
  const loc = useLocation();
  const navigate = useNavigate();
  const panes = usePanes();
  const { data: accounts = [] } = useAccounts();

  // Última conta aberta (ou a primeira) — os atalhos "Contas"/"Lançamentos"
  // levam direto a ela.
  const lastId = panes.panes[0]?.contaId ?? accounts[0]?.id;
  const onAccounts = loc.pathname.startsWith("/contas/");
  const onLancamentos = screenIdForPathname(loc.pathname) === "lancamento";
  const onHome = loc.pathname === "/";
  const onMais = loc.pathname === "/mais";
  const { year: curYear, month: curMonth } = getEffectiveCurrentMonth();

  const item = (active: boolean) =>
    `relative flex w-16 flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[10.5px] font-medium transition-colors ${
      active ? "text-primary" : "text-muted-foreground"
    }`;

  return (
    <nav
      aria-label="Navegação"
      className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border bg-background/90 px-2 pt-2 backdrop-blur md:hidden"
      style={{ paddingBottom: "calc(8px + env(safe-area-inset-bottom, 0px))" }}
    >
      <Link to="/" className={item(onHome)} aria-current={onHome ? "page" : undefined}>
        <HomeIcon className="h-5 w-5" aria-hidden="true" />
        <FitLabel text="Home" />
      </Link>
      {lastId ? (
        <Link
          to="/contas/$contaId"
          params={{ contaId: lastId }}
          onClick={() => panes.openSingle(lastId)}
          className={item(onAccounts)}
          aria-current={onAccounts ? "page" : undefined}
        >
          <Wallet className="h-5 w-5" aria-hidden="true" />
          <FitLabel text="Contas" />
        </Link>
      ) : (
        <button type="button" onClick={() => navigate({ to: "/mais" })} className={item(false)}>
          <Wallet className="h-5 w-5" aria-hidden="true" />
          <FitLabel text="Contas" />
        </button>
      )}
      {/* Espaço reservado pro FAB central (botão "+" flutuante, ver
          ConfigurableFab/FabMenuContent) — ele mesmo é posicionado fixo,
          só sobrepõe visualmente esse vão. */}
      <div className="w-14 shrink-0" aria-hidden="true" />
      {lastId ? (
        <Link
          to="/contas/$contaId/$ano/$mes"
          params={{ contaId: lastId, ano: String(curYear), mes: String(curMonth) }}
          className={item(onLancamentos)}
          aria-current={onLancamentos ? "page" : undefined}
        >
          <Receipt className="h-5 w-5" aria-hidden="true" />
          <FitLabel text="Lançamentos" />
        </Link>
      ) : (
        <button type="button" onClick={() => navigate({ to: "/mais" })} className={item(false)}>
          <Receipt className="h-5 w-5" aria-hidden="true" />
          <FitLabel text="Lançamentos" />
        </button>
      )}
      <Link to="/mais" className={item(onMais)} aria-current={onMais ? "page" : undefined}>
        <Menu className="h-5 w-5" aria-hidden="true" />
        <FitLabel text="Mais" />
      </Link>
    </nav>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useRouterState({ select: (s) => s.location });
  const [redirected, setRedirected] = useState(false);
  useAccountAccessRealtime();
  useValidateViewingAs();
  useNotificationsRealtime();

  // /auth e /reset-password nunca têm shell. /privacidade e /sobre servem
  // também pra visitante deslogado, então só ficam "públicas" (sem
  // sidebar/FAB) enquanto não há usuário logado — logado, passam a
  // renderizar dentro do layout normal, como qualquer outra tela.
  const alwaysPublic = location.pathname === "/auth" || location.pathname === "/reset-password";
  const conditionallyPublic =
    location.pathname === "/privacidade" || location.pathname === "/sobre";
  const isPublic = alwaysPublic || (conditionallyPublic && !user);
  const fabScreenId = screenIdForPathname(location.pathname);
  // Quando um painel de mês está aberto em modo embedded, o FAB local
  // da LancamentosPage já está ativo (via portal). Suprimir o
  // ConfigurableFab do root para não sobrepor os dois.
  const { panes } = usePanes();
  const anyMonthPaneOpen = panes.some((p) => p.view.type === "month");

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

  // Telas fora de /contas/* rolam a própria janela (não um painel interno) —
  // sem isso, navegar pela sidebar podia cair no meio de uma tela que a
  // anterior tinha deixado rolada, em vez de começar do topo.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
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
    <div className="flex min-h-dvh bg-background">
      {/* Desktop/tablet: sempre expandida (240px), sem recolher. No mobile a
          navegação vive nos botões flutuantes de cada tela (☰ na Home/Meses,
          "Configurações" dentro do "+" no Lançamento) em vez de uma gaveta. */}
      <aside className="sticky top-0 hidden h-screen shrink-0 flex-col self-start overflow-y-auto overflow-x-hidden border-r border-border bg-background p-3 md:flex md:w-[72px] xl:w-64 xl:p-4">
        <SidebarContent rail labelClass="hidden xl:inline" />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <a href="#main-content" className="skip-link">
          Pular para o conteúdo
        </a>
        <AdminViewingBanner />
        <main
          id="main-content"
          className="min-w-0 overflow-x-clip pb-[var(--bnav-h)] md:pb-0"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
      <BottomNav />
      <CommandPalette />
      {/* Menu flutuante configurável — montado uma única vez aqui (igual
          AdminViewingBanner), pra não precisar editar rota por rota. A tela
          de Lançamento fica de fora (screenId null-ish "lancamento"):
          mantém o próprio FAB local, porque as ações de criar dependem de
          estado só dela. `key` força reiniciar aberto/fechado ao trocar de
          tela. */}
      {fabScreenId && fabScreenId !== "lancamento" && !anyMonthPaneOpen && (
        <ConfigurableFab key={fabScreenId} screenId={fabScreenId} />
      )}
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
