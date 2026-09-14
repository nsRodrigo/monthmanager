import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { FabMenuContent, type ResolvedFabEntry } from "./FabMenuContent";
import { ManageAccountsDialog } from "./ManageAccountsDialog";
import { FloatingCalculator } from "./FloatingCalculator";
import { useFabConfig } from "@/store/fab-config";
import { useAuth } from "@/store/auth";
import { useIsAdmin } from "@/store/roles";
import { CATALOG_BY_ID, ICON_BY_NAME, type ActionId, type ScreenId } from "@/lib/fab-catalog";

/**
 * FAB "tudo incluso" pras 9 telas simples (todas exceto Lançamento, que
 * mantém o próprio FAB local por causa dos diálogos de criar — ver
 * contas.$contaId_.$ano.$mes.tsx). Montado uma única vez em `AuthGate`
 * (src/routes/__root.tsx), com `screenId` derivado do pathname atual.
 */
export function ConfigurableFab({ screenId }: { screenId: ScreenId }) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const isAdmin = useIsAdmin();
  const { data: cfg } = useFabConfig(screenId);
  const [open, setOpen] = useState(false);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);

  if (!cfg) return null;

  function resolveAction(id: string): ResolvedFabEntry | null {
    if (id.startsWith("folder:")) {
      const fid = id.slice(7);
      const folder = cfg!.folders[fid];
      if (!folder) return null;
      const Icon = ICON_BY_NAME[folder.icon] ?? ICON_BY_NAME.folder;
      return { kind: "folder", id: fid, label: folder.label, icon: Icon, onOpen: () => setActiveFolder(fid) };
    }
    const entry = CATALOG_BY_ID[id as ActionId];
    if (!entry) return null;
    if (entry.adminOnly && !isAdmin) return null;

    const close = () => setOpen(false);
    let onClick: () => void;
    switch (entry.kind) {
      case "navigate":
        onClick = () => {
          close();
          navigate({ to: entry.to! });
        };
        break;
      case "signout":
        onClick = () => {
          close();
          signOut();
        };
        break;
      case "calculator":
        onClick = () => {
          close();
          setCalcOpen(true);
        };
        break;
      case "manage-account":
        onClick = () => {
          close();
          setManageOpen(true);
        };
        break;
      default:
        // "local" — só faz sentido de verdade na tela de Lançamento (abre um
        // diálogo de criar que só existe ali). Fora dela, não há onde abrir
        // esse diálogo, então manda pra Início com um aviso.
        onClick = () => {
          close();
          toast.info("Abra uma conta e um mês primeiro.");
          navigate({ to: "/" });
        };
    }
    return { kind: "action", id: entry.id, label: entry.label, icon: entry.icon, tone: entry.tone, onClick };
  }

  const currentIds = activeFolder ? cfg.folders[activeFolder]?.actionIds ?? [] : cfg.actions;
  const entries = currentIds.map(resolveAction).filter((e): e is ResolvedFabEntry => !!e);

  if (!activeFolder && entries.length === 0) return null;

  const MainIcon = ICON_BY_NAME[cfg.icon] ?? ICON_BY_NAME.apps;

  return (
    <div className="md:hidden">
      <FabMenuContent
        mainIcon={MainIcon}
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setActiveFolder(null);
        }}
        entries={entries}
        isSubLevel={!!activeFolder}
        onBack={() => setActiveFolder(null)}
      />
      <ManageAccountsDialog open={manageOpen} onClose={() => setManageOpen(false)} />
      <FloatingCalculator open={calcOpen} onClose={() => setCalcOpen(false)} />
    </div>
  );
}
