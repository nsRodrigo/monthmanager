import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Cloud,
  MapPin,
  Wallet,
  Sliders,
  ShieldCheck,
  Palette,
  LogOut,
  Settings,
  Calculator as CalculatorIcon,
  Info,
  Lock,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { HeaderBand } from "@/components/HeaderBand";
import { useAuth } from "@/store/auth";
import { useIsAdmin } from "@/store/roles";
import { ManageAccountsDialog } from "@/components/ManageAccountsDialog";
import { openFloatingCalculator } from "@/store/floating-calculator";

export const Route = createFileRoute("/mais")({
  head: () => ({ meta: [{ title: "Mais — Finanças" }] }),
  component: MaisPage,
});

/**
 * Página "Mais" da navegação inferior — lista enxuta de atalhos (igual ao
 * protótipo). Home/Contas/Lançamentos já têm botão próprio na barra; o resto
 * mora aqui. Página de verdade (não modal/gaveta) pra caber no padrão das
 * outras abas da barra inferior.
 */
function MaisPage() {
  const { signOut } = useAuth();
  const isAdmin = useIsAdmin();
  const [manageOpen, setManageOpen] = useState(false);

  const rowClass =
    "flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left text-[15px] font-medium hover:bg-secondary";
  const row = (to: string, label: string, Icon: LucideIcon) => (
    <Link to={to} className={rowClass}>
      <Icon className="h-[18px] w-[18px] shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="flex-1 truncate">{label}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
  const actionRow = (label: string, Icon: LucideIcon, onClick: () => void) => (
    <button type="button" onClick={onClick} className={rowClass}>
      <Icon className="h-[18px] w-[18px] shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="flex-1 truncate">{label}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );

  return (
    <div>
      <div className="sticky top-0 z-10 bg-background">
        <HeaderBand title="Mais" />
      </div>
      <div className="mx-auto max-w-2xl px-4 pt-4 pb-24 sm:px-6">
        <div className="space-y-0.5">
          {row("/backup", "Backup e sync", Cloud)}
          {actionRow("Gerenciar conta", Settings, () => setManageOpen(true))}
          {row("/locais-produtos", "Locais e produtos", MapPin)}
          {row("/meios-pagamento", "Meios de pagamento", Wallet)}
          {actionRow("Calculadora", CalculatorIcon, () => openFloatingCalculator())}
          {row("/aparencia", "Aparência", Palette)}
          {row("/personalizar-menu", "Atalhos rápidos", Sliders)}
          {isAdmin && row("/admin/whitelist", "Administração", ShieldCheck)}
          {row("/sobre", "Sobre o app", Info)}
          {row("/privacidade", "Privacidade", Lock)}
          <button
            type="button"
            onClick={() => signOut()}
            className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left text-[15px] font-medium hover:bg-secondary"
          >
            <LogOut
              className="h-[18px] w-[18px] shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span className="flex-1 truncate">Sair</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
        </div>
      </div>
      <ManageAccountsDialog open={manageOpen} onClose={() => setManageOpen(false)} />
    </div>
  );
}
