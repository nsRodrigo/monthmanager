import { useNavigate } from "@tanstack/react-router";
import { Settings, FileSpreadsheet, Cloud, ShieldCheck, User, LogOut, ChevronLeft, MapPin } from "lucide-react";
import { FabAction } from "@/components/FabAction";
import { useAuth } from "@/store/auth";
import { useIsAdmin } from "@/store/roles";

/**
 * Lista de ações de configuração (mesmas do antigo menu lateral, exceto a
 * lista de contas) — usada tanto no FAB próprio de Home/Meses quanto dentro
 * do "+" da tela de Lançamento (com `onBack` para o item "Voltar").
 *
 * `onManageAccounts` fica a cargo de quem chama (em vez de um estado local
 * + `ManageAccountsDialog` aqui dentro): `onNavigate` fecha o FAB, o que
 * desmontaria este componente — e o diálogo junto — antes de abrir.
 */
export function SettingsFabActions({
  onNavigate,
  onBack,
  onManageAccounts,
}: {
  onNavigate: () => void;
  onBack?: () => void;
  onManageAccounts: () => void;
}) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const isAdmin = useIsAdmin();

  return (
    <>
      {onBack && <FabAction icon={ChevronLeft} label="Voltar" tone="primary" onClick={onBack} />}
      <FabAction
        icon={Settings}
        label="Gerenciar conta"
        tone="primary"
        onClick={() => {
          onManageAccounts();
          onNavigate();
        }}
      />
      <FabAction
        icon={FileSpreadsheet}
        label="Importar planilha"
        tone="income"
        onClick={() => {
          onNavigate();
          navigate({ to: "/importar-historico" });
        }}
      />
      <FabAction
        icon={Cloud}
        label="Backup e sync"
        tone="credit"
        onClick={() => {
          onNavigate();
          navigate({ to: "/backup" });
        }}
      />
      <FabAction
        icon={MapPin}
        label="Locais e Produtos"
        tone="primary"
        onClick={() => {
          onNavigate();
          navigate({ to: "/locais-produtos" });
        }}
      />
      {isAdmin && (
        <FabAction
          icon={ShieldCheck}
          label="Whitelist e usuários"
          tone="debit"
          onClick={() => {
            onNavigate();
            navigate({ to: "/admin/whitelist" });
          }}
        />
      )}
      <FabAction
        icon={User}
        label="Perfil"
        tone="primary"
        onClick={() => {
          onNavigate();
          navigate({ to: "/perfil" });
        }}
      />
      <FabAction
        icon={LogOut}
        label="Sair"
        tone="debit"
        onClick={() => {
          onNavigate();
          signOut();
        }}
      />
    </>
  );
}
