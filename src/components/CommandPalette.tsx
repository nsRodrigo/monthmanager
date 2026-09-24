import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Command as CommandPrimitive } from "cmdk";
import {
  Bell,
  Cloud,
  CreditCard,
  FileSpreadsheet,
  Info,
  LayoutDashboard,
  Lock,
  MapPin,
  Search,
  ShieldCheck,
  Sliders,
  User,
  Wallet,
} from "lucide-react";
import { searchPalette, useSearchOpen } from "@/store/search";
import { useAccounts } from "@/store/finance";
import { usePanes } from "@/store/panes";
import { useIsAdmin } from "@/store/roles";

type Page = {
  label: string;
  to:
    | "/"
    | "/notificacoes"
    | "/importar-historico"
    | "/backup"
    | "/locais-produtos"
    | "/meios-pagamento"
    | "/perfil"
    | "/personalizar-menu"
    | "/sobre"
    | "/privacidade";
  icon: typeof Bell;
  keywords?: string;
};

const PAGES: Page[] = [
  { label: "Home", to: "/", icon: LayoutDashboard, keywords: "inicio painel consolidado" },
  { label: "Notificações", to: "/notificacoes", icon: Bell, keywords: "avisos alertas vencimentos" },
  { label: "Importar planilha", to: "/importar-historico", icon: FileSpreadsheet, keywords: "xlsx excel histórico" },
  { label: "Backup e sync", to: "/backup", icon: Cloud, keywords: "exportar restaurar drive snapshot" },
  { label: "Locais e produtos", to: "/locais-produtos", icon: MapPin, keywords: "descrição catálogo" },
  { label: "Meios de pagamento", to: "/meios-pagamento", icon: CreditCard, keywords: "pix boleto cartões" },
  { label: "Meu perfil", to: "/perfil", icon: User, keywords: "tema senha foto conta" },
  { label: "Atalhos rápidos", to: "/personalizar-menu", icon: Sliders, keywords: "menu flutuante fab" },
  { label: "Sobre o app", to: "/sobre", icon: Info },
  { label: "Privacidade", to: "/privacidade", icon: Lock },
];

/** Linha da lista: ícone, nome e a etiqueta do tipo ("conta" / "tela") à direita. */
const itemCls =
  "flex w-full cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-sm text-muted-foreground outline-none data-[selected=true]:bg-secondary data-[selected=true]:text-foreground";

/**
 * Busca global — Ctrl/Cmd+K (ou o ícone de lupa no cabeçalho). Layout do
 * protótipo: painel no alto da tela, campo com "Esc", lista simples com o tipo
 * de cada resultado à direita. No celular ocupa a tela toda.
 */
export function CommandPalette() {
  const open = useSearchOpen();
  const navigate = useNavigate();
  const panes = usePanes();
  const { data: accounts = [] } = useAccounts();
  const isAdmin = useIsAdmin();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchPalette.toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (fn: () => void) => {
    searchPalette.close();
    fn();
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={searchPalette.setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[rgba(2,5,4,0.66)] backdrop-blur-[4px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed top-[8vh] left-1/2 z-50 w-[min(560px,calc(100%-32px))] -translate-x-1/2 overflow-hidden rounded-[18px] border border-border bg-card shadow-[0_30px_80px_rgba(0,0,0,0.6)] outline-none max-sm:top-0 max-sm:h-dvh max-sm:w-full max-sm:rounded-none max-sm:border-0"
        >
          <DialogPrimitive.Title className="sr-only">Buscar</DialogPrimitive.Title>
          <CommandPrimitive className="flex h-full flex-col">
            <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5 text-muted-foreground">
              <Search className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
              <CommandPrimitive.Input
                autoFocus
                placeholder="Buscar tela ou ação…"
                className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
              />
              <kbd className="rounded-[5px] border border-border px-1.5 py-px text-[11px] font-medium text-muted-foreground">
                Esc
              </kbd>
            </div>
            <CommandPrimitive.List className="max-h-[340px] overflow-auto p-2 max-sm:max-h-none max-sm:flex-1">
              <CommandPrimitive.Empty className="p-6 text-center text-sm text-muted-foreground">
                Nada encontrado.
              </CommandPrimitive.Empty>

              {PAGES.map((p) => (
                <CommandPrimitive.Item
                  key={p.to}
                  value={p.label}
                  keywords={p.keywords ? p.keywords.split(" ") : undefined}
                  onSelect={() => go(() => navigate({ to: p.to }))}
                  className={itemCls}
                >
                  <p.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                  {p.label}
                  <small className="ml-auto text-xs text-muted-foreground">tela</small>
                </CommandPrimitive.Item>
              ))}
              {isAdmin && (
                <CommandPrimitive.Item
                  value="Administração whitelist usuários"
                  onSelect={() => go(() => navigate({ to: "/admin/whitelist" }))}
                  className={itemCls}
                >
                  <ShieldCheck className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                  Administração
                  <small className="ml-auto text-xs text-muted-foreground">tela</small>
                </CommandPrimitive.Item>
              )}
              {accounts.map((a) => (
                <CommandPrimitive.Item
                  key={a.id}
                  value={`conta ${a.name}`}
                  keywords={[a.type]}
                  onSelect={() =>
                    go(() => {
                      panes.openSingle(a.id, { resetView: true });
                      navigate({ to: "/contas/$contaId", params: { contaId: a.id } });
                    })
                  }
                  className={itemCls}
                >
                  <Wallet className="h-[18px] w-[18px] shrink-0" style={{ color: a.color }} aria-hidden="true" />
                  Conta {a.name}
                  <small className="ml-auto text-xs text-muted-foreground">conta</small>
                </CommandPrimitive.Item>
              ))}
            </CommandPrimitive.List>
          </CommandPrimitive>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
