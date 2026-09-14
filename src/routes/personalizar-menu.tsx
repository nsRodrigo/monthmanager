import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Plus,
  X,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Folder as FolderIcon,
} from "lucide-react";
import { HeaderBand } from "@/components/HeaderBand";
import { Modal, Field, inputClass, Select } from "@/components/Modal";
import { FabMenuContent, type ResolvedFabEntry } from "@/components/FabMenuContent";
import { toneBg, toneText } from "@/components/FabAction";
import { useFabConfig, useSaveFabConfig } from "@/store/fab-config";
import { useIsAdmin } from "@/store/roles";
import {
  CATALOG,
  CATALOG_BY_ID,
  MAIN_ICONS,
  FOLDER_ICONS,
  ICON_BY_NAME,
  SCREENS,
  SCREEN_SECTIONS,
  DEFAULTS,
  type ScreenId,
  type FabConfigValue,
  type ActionId,
} from "@/lib/fab-catalog";

export const Route = createFileRoute("/personalizar-menu")({
  head: () => ({ meta: [{ title: "Personalizar menu flutuante — Finanças" }] }),
  component: PersonalizarMenuPage,
});

function newFolderId() {
  return "f_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function PersonalizarMenuPage() {
  const navigate = useNavigate();
  const goBack = () => navigate({ to: "/perfil" });
  const isAdmin = useIsAdmin();

  const [currentScreen, setCurrentScreen] = useState<ScreenId>("inicio");
  const { data: cfg } = useFabConfig(currentScreen);
  const saveMut = useSaveFabConfig();

  const [draft, setDraft] = useState<FabConfigValue | null>(null);
  const loadedScreenRef = useRef<ScreenId | null>(null);
  useEffect(() => {
    if (cfg && loadedScreenRef.current !== currentScreen) {
      setDraft(cfg);
      loadedScreenRef.current = currentScreen;
    }
  }, [cfg, currentScreen]);

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addTarget, setAddTarget] = useState<string | null>(null); // folderId, ou null = nível principal
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFolder, setPreviewFolder] = useState<string | null>(null);

  function updateDraft(mutator: (d: FabConfigValue) => void) {
    setDraft((prev) => {
      if (!prev) return prev;
      const next: FabConfigValue = structuredClone(prev);
      mutator(next);
      return next;
    });
  }

  const screens = SCREENS.filter((s) => !s.adminOnly || isAdmin);
  const screen = SCREENS.find((s) => s.id === currentScreen)!;

  const usedIds = useMemo(() => {
    const ids = new Set<string>();
    if (!draft) return ids;
    draft.actions.filter((r) => !r.startsWith("folder:")).forEach((r) => ids.add(r));
    Object.values(draft.folders).forEach((f) => f.actionIds.forEach((id) => ids.add(id)));
    return ids;
  }, [draft]);

  const poolItems = useMemo(() => {
    if (!draft) return [];
    return CATALOG.filter(
      (c) => !usedIds.has(c.id) && (!c.adminOnly || isAdmin) && c.screenRef !== currentScreen,
    );
  }, [draft, usedIds, isAdmin, currentScreen]);

  function switchScreen(id: ScreenId) {
    setCurrentScreen(id);
    setPreviewOpen(false);
    setPreviewFolder(null);
    setAddModalOpen(false);
  }

  function openAddModal(folderId: string | null) {
    setAddTarget(folderId);
    setAddModalOpen(true);
  }

  function addItem(id: string) {
    if (addTarget) {
      updateDraft((d) => {
        d.folders[addTarget].actionIds.push(id as ActionId);
      });
    } else {
      updateDraft((d) => {
        d.actions.push(id);
      });
    }
  }

  function removeTopLevel(ref: string) {
    updateDraft((d) => {
      d.actions = d.actions.filter((x) => x !== ref);
      if (ref.startsWith("folder:")) delete d.folders[ref.slice(7)];
    });
  }

  function removeFromFolder(folderId: string, id: string) {
    updateDraft((d) => {
      d.folders[folderId].actionIds = d.folders[folderId].actionIds.filter((x) => x !== id);
    });
  }

  function moveTopLevel(index: number, dir: -1 | 1) {
    updateDraft((d) => {
      const j = index + dir;
      if (j < 0 || j >= d.actions.length) return;
      [d.actions[index], d.actions[j]] = [d.actions[j], d.actions[index]];
    });
  }

  function moveInFolder(folderId: string, index: number, dir: -1 | 1) {
    updateDraft((d) => {
      const arr = d.folders[folderId].actionIds;
      const j = index + dir;
      if (j < 0 || j >= arr.length) return;
      [arr[index], arr[j]] = [arr[j], arr[index]];
    });
  }

  function createFolder() {
    const fid = newFolderId();
    updateDraft((d) => {
      d.folders[fid] = { label: "Nova pasta", icon: "folder", actionIds: [] };
      d.actions.push("folder:" + fid);
    });
    setExpandedFolders((s) => new Set(s).add(fid));
  }

  function toggleFolder(fid: string) {
    setExpandedFolders((s) => {
      const next = new Set(s);
      if (next.has(fid)) next.delete(fid);
      else next.add(fid);
      return next;
    });
  }

  function handleSave() {
    if (!draft) return;
    saveMut.mutate(
      { screenId: currentScreen, value: draft },
      {
        onSuccess: () => toast.success("Menu flutuante salvo."),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao salvar."),
      },
    );
  }

  function handleReset() {
    setDraft(structuredClone(DEFAULTS[currentScreen]));
  }

  // ── Prévia ao vivo: usa o FabMenuContent de verdade, com o estado ainda
  // não salvo. Ações não executam de verdade (navegar/sair fariam sentido
  // real só depois de salvo) — só pastas respondem, pra mostrar o drill-down.
  function resolvePreviewEntry(id: string): ResolvedFabEntry | null {
    if (id.startsWith("folder:")) {
      const fid = id.slice(7);
      const folder = draft?.folders[fid];
      if (!folder) return null;
      const Icon = ICON_BY_NAME[folder.icon] ?? ICON_BY_NAME.folder;
      return { kind: "folder", id: fid, label: folder.label, icon: Icon, onOpen: () => setPreviewFolder(fid) };
    }
    const entry = CATALOG_BY_ID[id as ActionId];
    if (!entry) return null;
    if (entry.adminOnly && !isAdmin) return null;
    return { kind: "action", id: entry.id, label: entry.label, icon: entry.icon, tone: entry.tone, onClick: () => {} };
  }

  const previewIds = draft ? (previewFolder ? draft.folders[previewFolder]?.actionIds ?? [] : draft.actions) : [];
  const previewEntries = previewIds.map(resolvePreviewEntry).filter((e): e is ResolvedFabEntry => !!e);
  const PreviewMainIcon = draft ? ICON_BY_NAME[draft.icon] ?? ICON_BY_NAME.apps : ICON_BY_NAME.apps;

  return (
    <div>
      <div className="sticky top-0 z-10">
        <HeaderBand compact title="Personalizar menu flutuante" subtitle="Escolha o ícone e os atalhos de cada tela." onBack={goBack} />
      </div>

      <div className="mx-auto max-w-6xl px-5 pb-16 pt-6">
        <p className="mb-5 text-xs text-muted-foreground">
          Vale só no celular — no computador a barra lateral já mostra tudo. Uma tela sem nenhum atalho fica sem botão flutuante.
        </p>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-[200px_1fr_280px]">
          {/* Seletor de tela — abas no desktop, combobox no mobile */}
          <nav className="hidden rounded-2xl border border-border bg-card p-2 md:block">
            {SCREEN_SECTIONS.map((section) => {
              const items = screens.filter((s) => s.section === section);
              if (!items.length) return null;
              return (
                <div key={section}>
                  <p className="px-2 pt-2.5 pb-1 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                    {section}
                  </p>
                  {items.map((s) => {
                    const active = s.id === currentScreen;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => switchScreen(s.id)}
                        className={`block w-full rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition-colors ${
                          active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"
                        }`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </nav>
          <Select
            className={`${inputClass} md:hidden`}
            value={currentScreen}
            onChange={(e) => switchScreen(e.target.value as ScreenId)}
          >
            {SCREEN_SECTIONS.map((section) => {
              const items = screens.filter((s) => s.section === section);
              if (!items.length) return null;
              return (
                <optgroup key={section} label={section}>
                  {items.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </Select>

          {/* Painel de edição */}
          {!draft ? (
            <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              Carregando…
            </div>
          ) : (
            <div className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-5">
              <div>
                <h2 className="text-base font-bold">{screen.label}</h2>
                <p className="text-xs text-muted-foreground">{screen.hint}</p>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Ícone do botão principal
                </p>
                <div className="hidden flex-wrap gap-2 md:flex">
                  {MAIN_ICONS.map(({ name, icon: Icon }) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => updateDraft((d) => { d.icon = name; })}
                      className={`flex h-10 w-10 items-center justify-center rounded-lg border-2 transition-colors ${
                        draft.icon === name
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3 md:hidden">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-primary bg-primary/10 text-primary">
                    <PreviewMainIcon className="h-4 w-4" />
                  </span>
                  <Select className={inputClass} value={draft.icon} onChange={(e) => updateDraft((d) => { d.icon = e.target.value; })}>
                    {MAIN_ICONS.map(({ name }) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              {/* Desktop: Disponíveis + No menu lado a lado */}
              <div className="hidden gap-4 md:grid md:grid-cols-2">
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Disponíveis</p>
                  <PoolBox items={poolItems} onAdd={(id) => addItem(id)} />
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      No menu (ordem de cima pra baixo)
                    </p>
                    <button
                      type="button"
                      onClick={createFolder}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10.5px] font-bold text-muted-foreground hover:border-primary hover:text-primary"
                    >
                      <Plus className="h-3 w-3" /> Pasta
                    </button>
                  </div>
                  <SelectedList
                    draft={draft}
                    expandedFolders={expandedFolders}
                    onToggleFolder={toggleFolder}
                    onMoveTop={moveTopLevel}
                    onRemoveTop={removeTopLevel}
                    onMoveInFolder={moveInFolder}
                    onRemoveFromFolder={removeFromFolder}
                    onRenameFolder={(fid, label) => updateDraft((d) => { d.folders[fid].label = label; })}
                    onFolderIcon={(fid, icon) => updateDraft((d) => { d.folders[fid].icon = icon; })}
                    onOpenFolderAdd={(fid) => openAddModal(fid)}
                  />
                </div>
              </div>

              {/* Mobile: só "No menu" + botão que abre modal */}
              <div className="md:hidden">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    No menu (ordem de cima pra baixo)
                  </p>
                  <button
                    type="button"
                    onClick={createFolder}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10.5px] font-bold text-muted-foreground hover:border-primary hover:text-primary"
                  >
                    <Plus className="h-3 w-3" /> Pasta
                  </button>
                </div>
                <SelectedList
                  draft={draft}
                  expandedFolders={expandedFolders}
                  onToggleFolder={toggleFolder}
                  onMoveTop={moveTopLevel}
                  onRemoveTop={removeTopLevel}
                  onMoveInFolder={moveInFolder}
                  onRemoveFromFolder={removeFromFolder}
                  onRenameFolder={(fid, label) => updateDraft((d) => { d.folders[fid].label = label; })}
                  onFolderIcon={(fid, icon) => updateDraft((d) => { d.folders[fid].icon = icon; })}
                  onOpenFolderAdd={(fid) => openAddModal(fid)}
                />
                <button
                  type="button"
                  onClick={() => openAddModal(null)}
                  className="mt-2 w-full rounded-lg border-2 border-dashed border-border py-2 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary"
                >
                  + Adicionar atalho
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary"
                >
                  Restaurar padrão
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saveMut.isPending}
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {saveMut.isPending ? "Salvando…" : "Salvar"}
                </button>
              </div>
            </div>
          )}

          {/* Prévia — desktop só, moldura de celular com o componente real */}
          <div className="hidden flex-col items-center gap-2 md:flex">
            <div className="relative h-[420px] w-[220px] overflow-hidden rounded-[28px] border-[6px] border-card bg-background shadow-elevated">
              <div className="flex h-9 items-center bg-gradient-band px-3 text-[11px] font-bold text-white">
                {screen.label}
              </div>
              <div className="space-y-2 p-3">
                <div className="h-3 w-2/3 rounded bg-secondary" />
                <div className="h-12 rounded-lg bg-secondary" />
                <div className="h-12 rounded-lg bg-secondary" />
              </div>
              {draft && (previewOpen ? previewEntries.length > 0 || previewFolder : previewEntries.length > 0) && (
                <FabMenuContent
                  mainIcon={PreviewMainIcon}
                  open={previewOpen}
                  onOpenChange={(v) => {
                    setPreviewOpen(v);
                    if (!v) setPreviewFolder(null);
                  }}
                  entries={previewEntries}
                  isSubLevel={!!previewFolder}
                  onBack={() => setPreviewFolder(null)}
                  positionClassName="absolute bottom-3 right-3 z-40 flex flex-col items-end gap-2"
                  backdropClassName="absolute inset-0 z-30"
                />
              )}
              {draft && previewEntries.length === 0 && !previewFolder && (
                <p className="absolute bottom-4 right-4 max-w-[140px] text-right text-[10px] text-muted-foreground">
                  Nenhum atalho — sem botão flutuante nesta tela.
                </p>
              )}
            </div>
            <p className="text-center text-[10.5px] text-muted-foreground">
              Toque no botão redondo pra simular abrir o menu.
            </p>
          </div>
        </div>
      </div>

      <Modal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title={addTarget && draft ? `Adicionar à pasta "${draft.folders[addTarget]?.label}"` : "Adicionar atalhos"}
      >
        {poolItems.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Todas as ações já estão em uso nesta tela.</p>
        ) : (
          <div className="space-y-1.5">
            {poolItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => addItem(item.id)}
                  className="flex w-full items-center gap-2.5 rounded-lg border border-border p-2 text-left hover:border-primary/50 hover:bg-secondary/50"
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${toneBg[item.tone]} ${toneText[item.tone]}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.label}</span>
                  {item.adminOnly && (
                    <span className="shrink-0 rounded-full bg-debit/15 px-2 py-0.5 text-[10px] font-bold text-debit">admin</span>
                  )}
                  <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        )}
      </Modal>
    </div>
  );
}

function PoolBox({ items, onAdd }: { items: typeof CATALOG; onAdd: (id: string) => void }) {
  if (!items.length) {
    return (
      <div className="flex min-h-[100px] items-center justify-center rounded-xl border border-border bg-background/50 p-4 text-center text-xs text-muted-foreground">
        Todas as ações já estão em uso nesta tela.
      </div>
    );
  }
  return (
    <div className="flex max-h-[360px] flex-col gap-1.5 overflow-y-auto rounded-xl border border-border bg-background/50 p-2">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.id} className="flex items-center gap-2 rounded-lg border border-border bg-card p-1.5 pr-2 text-xs">
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${toneBg[item.tone]} ${toneText[item.tone]}`}>
              <Icon className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
            {item.adminOnly && <span className="shrink-0 rounded-full bg-debit/15 px-1.5 py-0.5 text-[9px] font-bold text-debit">admin</span>}
            <button
              type="button"
              onClick={() => onAdd(item.id)}
              aria-label={`Adicionar ${item.label}`}
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-primary"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function SelectedList({
  draft,
  expandedFolders,
  onToggleFolder,
  onMoveTop,
  onRemoveTop,
  onMoveInFolder,
  onRemoveFromFolder,
  onRenameFolder,
  onFolderIcon,
  onOpenFolderAdd,
}: {
  draft: FabConfigValue;
  expandedFolders: Set<string>;
  onToggleFolder: (fid: string) => void;
  onMoveTop: (index: number, dir: -1 | 1) => void;
  onRemoveTop: (ref: string) => void;
  onMoveInFolder: (fid: string, index: number, dir: -1 | 1) => void;
  onRemoveFromFolder: (fid: string, id: string) => void;
  onRenameFolder: (fid: string, label: string) => void;
  onFolderIcon: (fid: string, icon: string) => void;
  onOpenFolderAdd: (fid: string) => void;
}) {
  if (!draft.actions.length) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-background/50 p-4 text-center text-xs text-muted-foreground">
        Nenhum atalho selecionado — o botão flutuante não vai aparecer nesta tela.
      </p>
    );
  }
  return (
    <div className="flex max-h-[420px] flex-col gap-1.5 overflow-y-auto rounded-xl border border-border bg-background/50 p-2">
      {draft.actions.map((ref, i) => {
        if (ref.startsWith("folder:")) {
          const fid = ref.slice(7);
          const folder = draft.folders[fid];
          if (!folder) return null;
          const expanded = expandedFolders.has(fid);
          const FIcon = ICON_BY_NAME[folder.icon] ?? FolderIcon;
          return (
            <div key={ref}>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-1.5 pr-1 text-xs">
                <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <FIcon className="h-3.5 w-3.5" />
                </span>
                <input
                  value={folder.label}
                  onChange={(e) => onRenameFolder(fid, e.target.value)}
                  placeholder="Nome da pasta"
                  className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 py-1 text-xs font-semibold hover:border-border focus:border-primary focus:bg-background focus:outline-none"
                />
                <select
                  value={folder.icon}
                  onChange={(e) => onFolderIcon(fid, e.target.value)}
                  className="shrink-0 rounded-md border border-border bg-background px-1 py-1 text-[10px]"
                  title="Ícone da pasta"
                >
                  {FOLDER_ICONS.map(({ name }) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
                  {folder.actionIds.length}
                </span>
                <button type="button" onClick={() => onToggleFolder(fid)} className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-secondary">
                  {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                <button type="button" onClick={() => onMoveTop(i, -1)} disabled={i === 0} className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-secondary disabled:opacity-30">
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => onMoveTop(i, 1)} disabled={i === draft.actions.length - 1} className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-secondary disabled:opacity-30">
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => onRemoveTop(ref)} aria-label="Excluir pasta" className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {expanded && (
                <div className="mt-1 mb-1 ml-6 space-y-1 border-l-2 border-border pl-2">
                  {folder.actionIds.length === 0 ? (
                    <p className="p-1 text-[11px] text-muted-foreground">Pasta vazia.</p>
                  ) : (
                    folder.actionIds.map((id, j) => {
                      const item = CATALOG_BY_ID[id as ActionId];
                      if (!item) return null;
                      const Icon = item.icon;
                      return (
                        <div key={id} className="flex items-center gap-2 rounded-lg border border-border bg-card p-1.5 pr-1 text-xs">
                          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${toneBg[item.tone]} ${toneText[item.tone]}`}>
                            <Icon className="h-3 w-3" />
                          </span>
                          <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
                          <button type="button" onClick={() => onMoveInFolder(fid, j, -1)} disabled={j === 0} className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-secondary disabled:opacity-30">
                            <ChevronUp className="h-3 w-3" />
                          </button>
                          <button type="button" onClick={() => onMoveInFolder(fid, j, 1)} disabled={j === folder.actionIds.length - 1} className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-secondary disabled:opacity-30">
                            <ChevronDown className="h-3 w-3" />
                          </button>
                          <button type="button" onClick={() => onRemoveFromFolder(fid, id)} aria-label={`Remover ${item.label}`} className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })
                  )}
                  <button
                    type="button"
                    onClick={() => onOpenFolderAdd(fid)}
                    className="w-full rounded-lg border border-dashed border-border py-1.5 text-[11px] font-semibold text-muted-foreground hover:border-primary hover:text-primary"
                  >
                    + Adicionar nesta pasta
                  </button>
                </div>
              )}
            </div>
          );
        }
        const item = CATALOG_BY_ID[ref as ActionId];
        if (!item) return null;
        const Icon = item.icon;
        return (
          <div key={ref} className="flex items-center gap-2 rounded-lg border border-border bg-card p-1.5 pr-1 text-xs">
            <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${toneBg[item.tone]} ${toneText[item.tone]}`}>
              <Icon className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
            {item.adminOnly && <span className="shrink-0 rounded-full bg-debit/15 px-1.5 py-0.5 text-[9px] font-bold text-debit">admin</span>}
            <button type="button" onClick={() => onMoveTop(i, -1)} disabled={i === 0} className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-secondary disabled:opacity-30">
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => onMoveTop(i, 1)} disabled={i === draft.actions.length - 1} className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-secondary disabled:opacity-30">
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => onRemoveTop(ref)} aria-label={`Remover ${item.label}`} className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
