import { useNavigate } from "@tanstack/react-router";
import { Settings, FileSpreadsheet, Cloud, ShieldCheck, User, LogOut, ChevronLeft, MapPin, Calculator, Wallet } from "lucide-react";
import { FabAction } from "@/components/FabAction";
import { useAuth } from "@/store/auth";
import { useIsAdmin } from "@/store/roles";

/**
 * Lista de ações de configuração (mesmas do antigo menu lateral, exceto a
 * lista de contas) — usada tanto no FAB próprio de Home/Meses quanto dentro
 * do "+" da tela de Lançamento (com `onBack` para o item "Voltar").
 *
 * `onManageAccounts`/`onOpenCalculator` ficam a cargo de quem chama (em vez
 * de estado local + diálogo aqui dentro): `onNavigate` fecha o FAB, o que
 * desmontaria este componente — e o diálogo junto — antes de abrir.
 */
export function SettingsFabActions({
  onNavigate,
  onBack,
  onManageAccounts,
  onOpenCalculator,
}: {
  onNavigate: () => void;
  onBack?: () => void;
  onManageAccounts: () => void;
  onOpenCalculator: () => void;
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
      <FabAction
        icon={Wallet}
        label="Meios de Pagamento"
        tone="debit"
        onClick={() => {
          onNavigate();
          navigate({ to: "/meios-pagamento" });
        }}
      />
      <FabAction
        icon={Calculator}
        label="Calculadora"
        tone="credit"
        onClick={() => {
          onOpenCalculator();
          onNavigate();
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
