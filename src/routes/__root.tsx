import { Link, Outlet, createRootRoute, HeadContent, Scripts, useLocation } from "@tanstack/react-router";
import { Wallet, LayoutDashboard, CalendarDays } from "lucide-react";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que você procura não existe.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
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
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Finanças — Gestão pessoal" },
      { name: "description", content: "Controle detalhado de gastos, cartões e parcelamentos." },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
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
    { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { to: "/meses", label: "Meses", icon: CalendarDays, exact: false },
    { to: "/carteira", label: "Carteira", icon: Wallet, exact: false },
  ] as const;
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-lg md:hidden">
      <div className="mx-auto flex max-w-2xl items-center justify-around px-4 py-2">
        {items.map((it) => {
          const active = it.exact ? loc.pathname === it.to : loc.pathname.startsWith(it.to);
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              className={`flex flex-col items-center gap-1 rounded-lg px-4 py-2 text-xs font-medium transition-colors ${
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
  const items = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { to: "/meses", label: "Meses", icon: CalendarDays, exact: false },
    { to: "/carteira", label: "Carteira", icon: Wallet, exact: false },
  ] as const;
  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-card/40 p-6 md:block">
      <div className="mb-10 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
          <Wallet className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="text-lg font-bold tracking-tight">Finanças</span>
      </div>
      <nav className="space-y-1">
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
      </nav>
    </aside>
  );
}

function RootComponent() {
  return (
    <div className="flex min-h-screen bg-background">
      <SideNav />
      <main className="flex-1 pb-24 md:pb-0">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
