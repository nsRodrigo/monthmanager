import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Bell,
  Cloud,
  CreditCard,
  FileSpreadsheet,
  Info,
  LayoutDashboard,
  Lock,
  MapPin,
  ShieldCheck,
  Sliders,
  User,
  Wallet,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
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

const iconTile =
  "mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground";

/**
 * Busca global — Ctrl/Cmd+K (ou o ícone de lupa no cabeçalho). Vai para
 * qualquer tela ou conta digitando parte do nome.
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
    <CommandDialog open={open} onOpenChange={searchPalette.setOpen}>
      <DialogTitle className="sr-only">Buscar</DialogTitle>
      <DialogDescription className="sr-only">Vá para uma tela ou conta digitando o nome.</DialogDescription>
      <CommandInput placeholder="Buscar tela ou conta…" />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>
        {accounts.length > 0 && (
          <CommandGroup heading="Contas">
            {accounts.map((a) => (
              <CommandItem
                key={a.id}
                value={`conta ${a.name}`}
                keywords={[a.type]}
                onSelect={() =>
                  go(() => {
                    panes.openSingle(a.id, { resetView: true });
                    navigate({ to: "/contas/$contaId", params: { contaId: a.id } });
                  })
                }
              >
                <span
                  className="mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: a.color + "33", color: a.color }}
                >
                  <Wallet className="h-3.5 w-3.5" />
                </span>
                {a.name}
                <span className="ml-auto text-xs text-muted-foreground capitalize">{a.type}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandGroup heading="Telas">
          {PAGES.map((p) => (
            <CommandItem
              key={p.to}
              value={p.label}
              keywords={p.keywords ? p.keywords.split(" ") : undefined}
              onSelect={() => go(() => navigate({ to: p.to }))}
            >
              <span className={iconTile}>
                <p.icon className="h-3.5 w-3.5" />
              </span>
              {p.label}
            </CommandItem>
          ))}
          {isAdmin && (
            <CommandItem
              value="Administração whitelist usuários"
              onSelect={() => go(() => navigate({ to: "/admin/whitelist" }))}
            >
              <span className={iconTile}>
                <ShieldCheck className="h-3.5 w-3.5" />
              </span>
              Administração
            </CommandItem>
          )}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
