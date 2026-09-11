import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Menu, Bell } from "lucide-react";
import { SettingsFabActions } from "@/components/SettingsFabActions";
import { ManageAccountsDialog } from "@/components/ManageAccountsDialog";
import { FloatingCalculator } from "@/components/FloatingCalculator";
import { useUnreadNotificationsCount } from "@/store/notifications";

/**
 * Botões flutuantes do mobile — Home e Meses. O de baixo (engrenagem) reúne
 * as opções que no desktop ficam na barra lateral (exceto lista de contas,
 * que já aparece na Home); o de cima (sino) abre a central de notificações
 * direto, com o contador de não lidas sempre visível. A partir de md a
 * barra lateral fixa já mostra tudo isso, então nenhum dos dois aparece.
 */
export function AccountSettingsFab() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const unreadCount = useUnreadNotificationsCount();

  return (
    <div className="md:hidden">
      {open && (
        <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden="true" />
      )}
      <button
        type="button"
        onClick={() => navigate({ to: "/notificacoes" })}
        aria-label={unreadCount > 0 ? `Notificações, ${unreadCount} não lidas` : "Notificações"}
        className="fixed top-4 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-elevated"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      <div className="fixed bottom-10 right-4 z-40 flex flex-col items-end gap-3">
        {open && (
          <div className="flex flex-col items-end gap-2.5">
            <SettingsFabActions
              onNavigate={() => setOpen(false)}
              onManageAccounts={() => setManageOpen(true)}
              onOpenCalculator={() => setCalcOpen(true)}
            />
          </div>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Fechar menu de configurações" : "Abrir menu de configurações"}
          aria-expanded={open}
          className={`flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-elevated transition-transform duration-200 ${
            open ? "rotate-45" : ""
          }`}
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>
      <ManageAccountsDialog open={manageOpen} onClose={() => setManageOpen(false)} />
      <FloatingCalculator open={calcOpen} onClose={() => setCalcOpen(false)} />
    </div>
  );
}
