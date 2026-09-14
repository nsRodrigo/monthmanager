import type { ComponentType } from "react";
import {
  Settings,
  FileSpreadsheet,
  Cloud,
  ShieldCheck,
  User,
  LogOut,
  MapPin,
  Calculator,
  Wallet,
  CreditCard,
  ShoppingBag,
  ArrowDownRight,
  TrendingUp,
  Download,
  Bell,
  Info,
  Lock,
  SlidersHorizontal,
  Plus,
  Grid2x2,
  Zap,
  Star,
  Menu,
  MoreHorizontal,
  LayoutDashboard,
  LayoutGrid,
  Layers,
  Grid3x3,
  Wrench,
  Shapes,
  Folder,
} from "lucide-react";
import type { Tone } from "@/components/FabAction";

export type IconComponent = ComponentType<{ className?: string }>;

/** As 12 telas que podem ter um menu flutuante próprio. Sobre/Privacidade só
 * ganham shell (e portanto FAB) quando há usuário logado — deslogadas elas
 * continuam públicas, sem sidebar/FAB (ver AuthGate em src/routes/__root.tsx). */
export type ScreenId =
  | "inicio"
  | "meses"
  | "lancamento"
  | "perfil"
  | "backup"
  | "importar"
  | "locais"
  | "meios"
  | "notificacoes"
  | "whitelist"
  | "sobre"
  | "privacidade";

export type ActionId =
  | "novo_cartao"
  | "nova_compra"
  | "novo_debito"
  | "novo_investimento"
  | "novo_recebimento"
  | "calculadora"
  | "gerenciar_conta"
  | "importar_planilha"
  | "backup_sync"
  | "locais_produtos"
  | "meios_pagamento"
  | "whitelist"
  | "perfil"
  | "sair"
  | "notificacoes"
  | "sobre"
  | "privacidade";

/**
 * Como a ação é executada quando resolvida no FAB de verdade:
 * - "navigate": vai pra uma rota fixa (`to`).
 * - "local": só faz sentido na tela de Lançamento (abre um dos diálogos de
 *   criar já existentes ali) — a tela hospedeira precisa fornecer o handler
 *   via `localActions`; em qualquer outra tela cai num fallback (ver
 *   ConfigurableFab.tsx).
 * - "calculator" / "manage-account": abrem `FloatingCalculator`/
 *   `ManageAccountsDialog` — cada host mantém sua própria instância.
 * - "signout": `useAuth().signOut()`.
 */
export type ActionKind = "navigate" | "local" | "calculator" | "manage-account" | "signout";

export type CatalogEntry = {
  id: ActionId;
  label: string;
  icon: IconComponent;
  tone: Tone;
  kind: ActionKind;
  to?: string;
  adminOnly?: boolean;
  /** Tela que essa ação leva — usada só pra não oferecer "ir pra tela em que já estou". */
  screenRef?: ScreenId;
};

export const CATALOG: CatalogEntry[] = [
  { id: "novo_cartao", label: "Novo cartão", icon: CreditCard, tone: "credit", kind: "local" },
  { id: "nova_compra", label: "Nova compra", icon: ShoppingBag, tone: "credit", kind: "local" },
  { id: "novo_debito", label: "Novo débito", icon: ArrowDownRight, tone: "debit", kind: "local" },
  { id: "novo_investimento", label: "Novo investimento", icon: TrendingUp, tone: "primary", kind: "local" },
  { id: "novo_recebimento", label: "Novo recebimento", icon: Download, tone: "income", kind: "local" },
  { id: "calculadora", label: "Calculadora", icon: Calculator, tone: "credit", kind: "calculator" },
  { id: "gerenciar_conta", label: "Gerenciar conta", icon: Settings, tone: "primary", kind: "manage-account" },
  {
    id: "importar_planilha",
    label: "Importar planilha",
    icon: FileSpreadsheet,
    tone: "income",
    kind: "navigate",
    to: "/importar-historico",
    screenRef: "importar",
  },
  {
    id: "backup_sync",
    label: "Backup e sync",
    icon: Cloud,
    tone: "credit",
    kind: "navigate",
    to: "/backup",
    screenRef: "backup",
  },
  {
    id: "locais_produtos",
    label: "Locais e Produtos",
    icon: MapPin,
    tone: "primary",
    kind: "navigate",
    to: "/locais-produtos",
    screenRef: "locais",
  },
  {
    id: "meios_pagamento",
    label: "Meios de Pagamento",
    icon: Wallet,
    tone: "debit",
    kind: "navigate",
    to: "/meios-pagamento",
    screenRef: "meios",
  },
  {
    id: "whitelist",
    label: "Whitelist e usuários",
    icon: ShieldCheck,
    tone: "debit",
    kind: "navigate",
    to: "/admin/whitelist",
    adminOnly: true,
    screenRef: "whitelist",
  },
  { id: "perfil", label: "Perfil", icon: User, tone: "primary", kind: "navigate", to: "/perfil", screenRef: "perfil" },
  { id: "sair", label: "Sair", icon: LogOut, tone: "debit", kind: "signout" },
  {
    id: "notificacoes",
    label: "Notificações",
    icon: Bell,
    tone: "primary",
    kind: "navigate",
    to: "/notificacoes",
    screenRef: "notificacoes",
  },
  { id: "sobre", label: "Sobre o app", icon: Info, tone: "primary", kind: "navigate", to: "/sobre", screenRef: "sobre" },
  {
    id: "privacidade",
    label: "Privacidade",
    icon: Lock,
    tone: "primary",
    kind: "navigate",
    to: "/privacidade",
    screenRef: "privacidade",
  },
];

export const CATALOG_BY_ID: Record<ActionId, CatalogEntry> = Object.fromEntries(
  CATALOG.map((c) => [c.id, c]),
) as Record<ActionId, CatalogEntry>;

export const MAIN_ICONS: { name: string; icon: IconComponent }[] = [
  { name: "tune", icon: SlidersHorizontal },
  { name: "settings", icon: Settings },
  { name: "add", icon: Plus },
  { name: "apps", icon: Grid2x2 },
  { name: "bolt", icon: Zap },
  { name: "star", icon: Star },
  { name: "menu", icon: Menu },
  { name: "more", icon: MoreHorizontal },
  { name: "dashboard", icon: LayoutDashboard },
  { name: "grid", icon: LayoutGrid },
  { name: "layers", icon: Layers },
  { name: "grid2", icon: Grid3x3 },
  { name: "wrench", icon: Wrench },
  { name: "shapes", icon: Shapes },
];

export const FOLDER_ICONS: { name: string; icon: IconComponent }[] = [
  { name: "folder", icon: Folder },
  { name: "settings", icon: Settings },
  { name: "apps", icon: Grid2x2 },
  { name: "more", icon: MoreHorizontal },
  { name: "layers", icon: Layers },
  { name: "star", icon: Star },
];

export const ICON_BY_NAME: Record<string, IconComponent> = Object.fromEntries(
  [...MAIN_ICONS, ...FOLDER_ICONS].map((i) => [i.name, i.icon]),
);

export type ScreenSection = "Telas principais" | "Telas de configuração";

export type ScreenDef = {
  id: ScreenId;
  label: string;
  hint: string;
  section: ScreenSection;
  adminOnly?: boolean;
};

export const SCREENS: ScreenDef[] = [
  { id: "inicio", label: "Início", hint: "Tela principal, com o resumo do mês.", section: "Telas principais" },
  { id: "meses", label: "Meses", hint: "Lista de meses de uma conta.", section: "Telas principais" },
  {
    id: "lancamento",
    label: "Lançamento",
    hint: "Extrato de um mês: compras, débitos, cartões...",
    section: "Telas principais",
  },
  { id: "perfil", label: "Perfil", hint: "Seus dados e contas com acesso liberado.", section: "Telas de configuração" },
  {
    id: "backup",
    label: "Backup e Sincronização",
    hint: "Exportar e restaurar backup dos dados.",
    section: "Telas de configuração",
  },
  {
    id: "importar",
    label: "Importar Planilha",
    hint: "Importação de histórico via XLSX.",
    section: "Telas de configuração",
  },
  {
    id: "locais",
    label: "Locais e Produtos",
    hint: "Catálogo de locais e produtos salvos.",
    section: "Telas de configuração",
  },
  {
    id: "meios",
    label: "Meios de Pagamento",
    hint: "Cartões e formas de pagamento cadastradas.",
    section: "Telas de configuração",
  },
  {
    id: "notificacoes",
    label: "Central de Notificações",
    hint: "Histórico de notificações recebidas.",
    section: "Telas de configuração",
  },
  {
    id: "whitelist",
    label: "Whitelist e Usuários",
    hint: "Administração de usuários (admin).",
    section: "Telas de configuração",
    adminOnly: true,
  },
  {
    id: "sobre",
    label: "Sobre o App",
    hint: "Versão e informações do app (só logado tem FAB aqui).",
    section: "Telas de configuração",
  },
  {
    id: "privacidade",
    label: "Privacidade",
    hint: "Política de privacidade (só logado tem FAB aqui).",
    section: "Telas de configuração",
  },
];

export const SCREEN_SECTIONS: ScreenSection[] = ["Telas principais", "Telas de configuração"];

export type FabFolder = { label: string; icon: string; actionIds: ActionId[] };
export type FabConfigValue = { icon: string; actions: string[]; folders: Record<string, FabFolder> };

/**
 * Início/Meses = a lista atual de `SettingsFabActions` (hoje hard-coded).
 * Lançamento = a lista atual do FAB "+", com "Configurações" virando uma
 * pasta de verdade — reproduz o comportamento de hoje (2 camadas) sem o
 * usuário precisar recriar nada. As outras 7 telas nascem vazias (sem FAB,
 * igual hoje) até alguém customizar de propósito.
 */
export const DEFAULTS: Record<ScreenId, FabConfigValue> = {
  inicio: {
    icon: "tune",
    actions: [
      "gerenciar_conta",
      "importar_planilha",
      "backup_sync",
      "locais_produtos",
      "meios_pagamento",
      "calculadora",
      "whitelist",
      "perfil",
      "sair",
    ],
    folders: {},
  },
  meses: {
    icon: "tune",
    actions: [
      "gerenciar_conta",
      "importar_planilha",
      "backup_sync",
      "locais_produtos",
      "meios_pagamento",
      "calculadora",
      "whitelist",
      "perfil",
      "sair",
    ],
    folders: {},
  },
  lancamento: {
    icon: "add",
    actions: ["novo_cartao", "nova_compra", "novo_debito", "novo_investimento", "novo_recebimento", "calculadora", "folder:config"],
    folders: {
      config: {
        label: "Configurações",
        icon: "settings",
        actionIds: ["gerenciar_conta", "importar_planilha", "backup_sync", "locais_produtos", "meios_pagamento", "whitelist", "perfil", "sair"],
      },
    },
  },
  perfil: { icon: "apps", actions: [], folders: {} },
  backup: { icon: "apps", actions: [], folders: {} },
  importar: { icon: "apps", actions: [], folders: {} },
  locais: { icon: "apps", actions: [], folders: {} },
  meios: { icon: "apps", actions: [], folders: {} },
  notificacoes: { icon: "apps", actions: [], folders: {} },
  whitelist: { icon: "apps", actions: [], folders: {} },
  sobre: { icon: "apps", actions: [], folders: {} },
  privacidade: { icon: "apps", actions: [], folders: {} },
};

/** Mapeia o pathname atual pra uma tela configurável, ou `null` se não houver
 * FAB configurável ali (telas públicas, rotas desconhecidas). Lançamento é
 * tratado à parte por quem chama — mantém o próprio FAB local. */
export function screenIdForPathname(pathname: string): ScreenId | null {
  if (pathname === "/") return "inicio";
  if (/^\/contas\/[^/]+$/.test(pathname)) return "meses";
  if (/^\/contas\/[^/]+\/[^/]+\/[^/]+$/.test(pathname)) return "lancamento";
  if (pathname === "/perfil") return "perfil";
  if (pathname === "/backup") return "backup";
  if (pathname === "/importar-historico") return "importar";
  if (pathname === "/locais-produtos") return "locais";
  if (pathname === "/meios-pagamento") return "meios";
  if (pathname === "/notificacoes") return "notificacoes";
  if (pathname === "/admin/whitelist") return "whitelist";
  if (pathname === "/sobre") return "sobre";
  if (pathname === "/privacidade") return "privacidade";
  return null;
}
