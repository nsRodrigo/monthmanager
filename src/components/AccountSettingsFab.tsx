import { useState } from "react";
import { Menu } from "lucide-react";
import { SettingsFabActions } from "@/components/SettingsFabActions";

/**
 * Botão flutuante de configurações — Home e Meses no mobile. Reúne as opções
 * que hoje só existiam no menu lateral (exceto a lista de contas, que já
 * aparece na Home). Só existe no mobile: a partir de md a barra lateral fixa
 * já mostra tudo isso.
 */
export function AccountSettingsFab() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      {open && (
        <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden="true" />
      )}
      <div className="fixed bottom-10 right-4 z-40 flex flex-col items-end gap-3">
        {open && (
          <div className="flex flex-col items-end gap-2.5">
            <SettingsFabActions onNavigate={() => setOpen(false)} />
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
    </div>
  );
}
