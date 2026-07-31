import { Menu } from "lucide-react";
import { useMobileMenu } from "@/store/mobile-menu";

/**
 * Ícone de menu (☰) — mesmo estilo em toda tela, sempre à direita do
 * seletor/título de cada página. Só existe no mobile (a partir de md o
 * menu já é a barra lateral fixa, sempre visível).
 */
export function MobileMenuButton() {
  const { openMobileMenu } = useMobileMenu();
  return (
    <button
      type="button"
      onClick={openMobileMenu}
      aria-label="Abrir menu"
      title="Abrir menu"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground md:hidden"
    >
      <Menu className="h-[1.1rem] w-[1.1rem]" />
    </button>
  );
}
