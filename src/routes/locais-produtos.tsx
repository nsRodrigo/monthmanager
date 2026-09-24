import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { HeaderBand } from "@/components/HeaderBand";
import { inputClass } from "@/components/Modal";
import { useConfirm } from "@/store/confirm";
import { formatDate } from "@/lib/format";
import {
  useCatalogItems,
  useAddCatalogItem,
  useUpdateCatalogItem,
  useDeleteCatalogItem,
  type CatalogItem,
} from "@/store/finance";
import { Tag, Plus, Pencil, Trash2, Check, X, Search, AlertTriangle, ArrowDownAZ, Flame } from "lucide-react";

export const Route = createFileRoute("/locais-produtos")({
  component: LocaisProdutosPage,
});

type Sort = "name" | "usage";

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function LocaisProdutosPage() {
  const navigate = useNavigate();
  const goBack = () => navigate({ to: "/" });
  const confirmDialog = useConfirm();

  const { data: items = [] } = useCatalogItems();
  const addItem = useAddCatalogItem();
  const updateItem = useUpdateCatalogItem();
  const deleteItem = useDeleteCatalogItem();

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("name");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const duplicate = useMemo(() => {
    const n = normalize(newName);
    if (!n) return null;
    return items.find((i) => normalize(i.name) === n) ?? null;
  }, [newName, items]);

  const visible = useMemo(() => {
    const q = normalize(search);
    const filtered = q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items;
    return [...filtered].sort((a, b) =>
      sort === "usage" ? b.usageCount - a.usageCount : a.name.localeCompare(b.name, "pt-BR"),
    );
  }, [items, search, sort]);

  async function handleAdd() {
    const name = newName.trim();
    if (!name || duplicate) return;
    await addItem.mutateAsync({ name });
    setNewName("");
    setAdding(false);
    toast.success(`"${name}" cadastrado em Locais e Produtos.`);
  }

  function startEdit(item: CatalogItem) {
    setEditingId(item.id);
    setEditName(item.name);
  }

  async function saveEdit(item: CatalogItem) {
    const name = editName.trim();
    if (!name) return;
    await updateItem.mutateAsync({ id: item.id, name });
    setEditingId(null);
    toast.success("Item atualizado.");
  }

  async function handleDelete(item: CatalogItem) {
    const ok = await confirmDialog({
      title: "Excluir item",
      description: (
        <>
          Remover &ldquo;{item.name}&rdquo; de Locais e Produtos? Lançamentos já criados com essa
          descrição não são alterados — só deixa de aparecer nas sugestões.
        </>
      ),
      confirmLabel: "Excluir",
      variant: "destructive",
    });
    if (!ok) return;
    await deleteItem.mutateAsync(item.id);
    toast.success("Item removido.");
  }

  const maxUsage = Math.max(1, ...items.map((i) => i.usageCount));

  return (
    <div>
      <div className="sticky top-0 z-10">
        <HeaderBand
          title="Locais e produtos"
          subtitle={`${items.length} ${items.length === 1 ? "item cadastrado" : "itens cadastrados"}`}
          onBack={goBack}
        />
      </div>
      <div className="mx-auto max-w-3xl px-4 pt-5 pb-24 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-52 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar item…"
              aria-label="Buscar item"
              className={`${inputClass} pl-10`}
            />
          </div>
          <div role="group" aria-label="Ordenar" className="inline-flex gap-0.5 rounded-xl border border-border bg-card p-[3px]">
            {(
              [
                ["name", "Nome", ArrowDownAZ],
                ["usage", "Mais usados", Flame],
              ] as const
            ).map(([k, label, Icon]) => (
              <button
                key={k}
                type="button"
                aria-pressed={sort === k}
                onClick={() => setSort(k)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  sort === k ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>
          {!adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-4 w-4" strokeWidth={2.2} /> Adicionar item
            </button>
          )}
        </div>

        {adding && (
          <div className="mb-4 space-y-3 rounded-2xl border border-border bg-card p-4">
            <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Novo item</p>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome (ex.: Posto Shell)"
              className={inputClass}
            />

            {duplicate && (
              <div className="flex items-start gap-2.5 rounded-xl border border-debit/40 bg-debit/10 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-debit" />
                <div className="text-xs">
                  <p className="font-semibold text-foreground">Já existe: &ldquo;{duplicate.name}&rdquo;</p>
                  <p className="mt-0.5 text-muted-foreground">
                    Usado {duplicate.usageCount}x. Escolha outro nome ou cancele pra reaproveitar esse.
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setNewName("");
                }}
                className="rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={!newName.trim() || !!duplicate || addItem.isPending}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
              >
                Salvar
              </button>
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {visible.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              {items.length === 0
                ? "Nenhum item ainda — cadastre um acima, ou ele entra sozinho quando você usar a descrição num lançamento."
                : "Nenhum item encontrado com essa busca."}
            </p>
          ) : (
            visible.map((item) => {
              const isEditing = editingId === item.id;
              return (
                <div key={item.id} className="border-t border-border first:border-t-0">
                  {isEditing ? (
                    <div className="space-y-2 p-3.5">
                      <input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className={inputClass}
                      />
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          aria-label="Cancelar edição"
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"
                        >
                          <X className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => saveEdit(item)}
                          aria-label="Salvar"
                          className="rounded-lg p-1.5 text-primary hover:bg-secondary"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/30">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                        <Tag className="h-[17px] w-[17px]" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{item.name}</p>
                        <div className="mt-1.5 h-1.5 max-w-64 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
                          <i
                            className="block h-full rounded-full bg-primary"
                            style={{ width: `${(item.usageCount / maxUsage) * 100}%` }}
                          />
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          último em {formatDate(item.lastUsedAt)}
                        </p>
                      </div>
                      <span className="hidden shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-[11.5px] font-semibold text-muted-foreground sm:inline">
                        {item.usageCount}× usado
                      </span>
                      <div className="flex shrink-0 items-center">
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          aria-label={`Editar ${item.name}`}
                          className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          aria-label={`Excluir ${item.name}`}
                          className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Itens novos entram sozinhos quando você usa uma descrição em um lançamento.
        </p>
      </div>
    </div>
  );
}
