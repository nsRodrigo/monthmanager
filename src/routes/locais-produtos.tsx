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

  return (
    <div>
      <div className="sticky top-0 z-10">
        <HeaderBand
          compact
          title="Locais e Produtos"
          subtitle={`${items.length} ${items.length === 1 ? "item cadastrado" : "itens cadastrados"}`}
          onBack={goBack}
        />
      </div>
      <div className="mx-auto max-w-2xl px-5 pb-8 md:pb-12">
        <div className="space-y-4 pt-6 pb-20">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar item..."
              className={`${inputClass} pl-9`}
            />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Ordenar por</p>
            <div className="flex gap-1 rounded-full bg-secondary p-1">
              <button
                type="button"
                onClick={() => setSort("name")}
                className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  sort === "name" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                <ArrowDownAZ className="h-3.5 w-3.5" /> Nome
              </button>
              <button
                type="button"
                onClick={() => setSort("usage")}
                className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  sort === "usage" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                <Flame className="h-3.5 w-3.5" /> Mais usados
              </button>
            </div>
          </div>

          {!adding ? (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-3 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary"
            >
              <Plus className="h-4 w-4" /> Adicionar item
            </button>
          ) : (
            <div className="space-y-3 rounded-xl border border-border bg-card p-3">
              <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Novo item</p>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nome (ex.: Posto Shell)"
                className={inputClass}
              />

              {duplicate && (
                <div className="flex items-start gap-2.5 rounded-lg border border-debit/40 bg-debit/10 p-3">
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

          {visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {items.length === 0
                ? "Nenhum item ainda — cadastre um acima, ou ele entra sozinho quando você usar a descrição num lançamento."
                : "Nenhum item encontrado com essa busca."}
            </p>
          ) : (
            <div className="space-y-2">
              {visible.map((item) => {
                const isEditing = editingId === item.id;
                return (
                  <div key={item.id} className="rounded-xl border border-border bg-card p-3">
                    {isEditing ? (
                      <div className="space-y-2">
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
                            className="rounded p-1.5 text-muted-foreground hover:bg-secondary"
                          >
                            <X className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => saveEdit(item)}
                            className="rounded p-1.5 text-primary hover:bg-secondary"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <Tag className="h-[18px] w-[18px]" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            usado {item.usageCount}x · último em {formatDate(item.lastUsedAt)}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col gap-0.5">
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item)}
                            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
