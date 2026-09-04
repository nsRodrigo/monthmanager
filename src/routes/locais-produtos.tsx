import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { HeaderBand } from "@/components/HeaderBand";
import { Field, Select, inputClass } from "@/components/Modal";
import { useConfirm } from "@/store/confirm";
import { formatDate } from "@/lib/format";
import {
  useCatalogItems,
  useAddCatalogItem,
  useUpdateCatalogItem,
  useDeleteCatalogItem,
  type CatalogItem,
  type CatalogKind,
} from "@/store/finance";
import { MapPin, Package, Plus, Pencil, Trash2, Check, X, Search, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/locais-produtos")({
  component: LocaisProdutosPage,
});

type Filter = "all" | CatalogKind;

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
  const [filter, setFilter] = useState<Filter>("all");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<CatalogKind>("local");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editKind, setEditKind] = useState<CatalogKind | null>(null);

  const counts = useMemo(
    () => ({
      all: items.length,
      local: items.filter((i) => i.kind === "local").length,
      produto: items.filter((i) => i.kind === "produto").length,
    }),
    [items],
  );

  const duplicate = useMemo(() => {
    const n = normalize(newName);
    if (!n) return null;
    return items.find((i) => normalize(i.name) === n) ?? null;
  }, [newName, items]);

  const visible = useMemo(() => {
    const q = normalize(search);
    return items.filter((i) => {
      if (filter !== "all" && i.kind !== filter) return false;
      if (q && !i.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, search, filter]);

  async function handleAdd() {
    const name = newName.trim();
    if (!name || duplicate) return;
    await addItem.mutateAsync({ name, kind: newKind });
    setNewName("");
    setAdding(false);
    toast.success(`"${name}" cadastrado em Locais e Produtos.`);
  }

  function startEdit(item: CatalogItem) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditKind(item.kind);
  }

  async function saveEdit(item: CatalogItem) {
    const name = editName.trim();
    if (!name) return;
    await updateItem.mutateAsync({ id: item.id, name, kind: editKind });
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
              placeholder="Buscar local ou produto..."
              className={`${inputClass} pl-9`}
            />
          </div>

          <div className="flex gap-2">
            {(
              [
                ["all", `Todos · ${counts.all}`],
                ["local", `Locais · ${counts.local}`],
                ["produto", `Produtos · ${counts.produto}`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  filter === key
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
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
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nome (ex.: Posto Shell)"
                  className={`${inputClass} flex-1`}
                />
                <div className="flex overflow-hidden rounded-lg border border-input">
                  <button
                    type="button"
                    onClick={() => setNewKind("local")}
                    className={`flex items-center gap-1.5 px-3 text-xs font-semibold ${
                      newKind === "local" ? "bg-credit/20 text-credit" : "text-muted-foreground"
                    }`}
                  >
                    <MapPin className="h-3.5 w-3.5" /> Local
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewKind("produto")}
                    className={`flex items-center gap-1.5 px-3 text-xs font-semibold ${
                      newKind === "produto" ? "bg-debit/20 text-debit" : "text-muted-foreground"
                    }`}
                  >
                    <Package className="h-3.5 w-3.5" /> Produto
                  </button>
                </div>
              </div>

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
                : "Nenhum item encontrado com esse filtro."}
            </p>
          ) : (
            <div className="space-y-2">
              {visible.map((item) => {
                const Icon = item.kind === "local" ? MapPin : item.kind === "produto" ? Package : Search;
                const isEditing = editingId === item.id;
                return (
                  <div key={item.id} className="rounded-xl border border-border bg-card p-3">
                    {isEditing ? (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <input
                            autoFocus
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className={`${inputClass} flex-1`}
                          />
                          <Select
                            className={inputClass}
                            value={editKind ?? "none"}
                            onChange={(e) =>
                              setEditKind(e.target.value === "none" ? null : (e.target.value as CatalogKind))
                            }
                          >
                            <option value="none">Não classificado</option>
                            <option value="local">Local</option>
                            <option value="produto">Produto</option>
                          </Select>
                        </div>
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
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                            item.kind === "local"
                              ? "bg-credit/20 text-credit"
                              : item.kind === "produto"
                                ? "bg-debit/20 text-debit"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <Icon className="h-[18px] w-[18px]" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.kind === "local" ? "Local" : item.kind === "produto" ? "Produto" : "Não classificado"}
                            {" · "}usado {item.usageCount}x · último em {formatDate(item.lastUsedAt)}
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
