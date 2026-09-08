import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { HeaderBand } from "@/components/HeaderBand";
import { inputClass } from "@/components/Modal";
import { useConfirm } from "@/store/confirm";
import { AddCardDialog } from "@/components/AddCardDialog";
import { EditCardDialog } from "@/components/EditCardDialog";
import {
  useAccounts,
  useCards,
  useCustomPaymentMethods,
  useAddPaymentMethod,
  useUpdatePaymentMethod,
  useDeletePaymentMethod,
  getEffectiveCurrentMonth,
  type Card,
  type CustomPaymentMethod,
} from "@/store/finance";
import { Plus, Pencil, Trash2, Check, X, Wallet, CreditCard } from "lucide-react";

export const Route = createFileRoute("/meios-pagamento")({
  component: MeiosPagamentoPage,
});

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function MeiosPagamentoPage() {
  const navigate = useNavigate();
  const goBack = () => navigate({ to: "/" });
  const confirmDialog = useConfirm();
  const eff = getEffectiveCurrentMonth();

  const { data: accounts = [] } = useAccounts();
  const { data: cards = [] } = useCards();
  const { data: methods = [] } = useCustomPaymentMethods();
  const addMethod = useAddPaymentMethod();
  const updateMethod = useUpdatePaymentMethod();
  const deleteMethod = useDeletePaymentMethod();

  const [addingMethod, setAddingMethod] = useState(false);
  const [newMethodName, setNewMethodName] = useState("");
  const [editingMethodId, setEditingMethodId] = useState<string | null>(null);
  const [editMethodName, setEditMethodName] = useState("");

  const [addCardOpen, setAddCardOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);

  const duplicateMethod = useMemo(() => {
    const n = normalize(newMethodName);
    if (!n) return null;
    return methods.find((m) => normalize(m.name) === n) ?? null;
  }, [newMethodName, methods]);

  async function handleAddMethod() {
    const name = newMethodName.trim();
    if (!name || duplicateMethod) return;
    await addMethod.mutateAsync({ name });
    setNewMethodName("");
    setAddingMethod(false);
    toast.success(`"${name}" cadastrado.`);
  }

  function startEditMethod(m: CustomPaymentMethod) {
    setEditingMethodId(m.id);
    setEditMethodName(m.name);
  }

  async function saveEditMethod(m: CustomPaymentMethod) {
    const name = editMethodName.trim();
    if (!name) return;
    await updateMethod.mutateAsync({ id: m.id, name });
    setEditingMethodId(null);
    toast.success("Meio de pagamento atualizado.");
  }

  async function handleDeleteMethod(m: CustomPaymentMethod) {
    const ok = await confirmDialog({
      title: "Excluir meio de pagamento",
      description: (
        <>
          Remover &ldquo;{m.name}&rdquo;? Lançamentos já criados com esse meio não são alterados —
          só deixa de aparecer nas opções.
        </>
      ),
      confirmLabel: "Excluir",
      variant: "destructive",
    });
    if (!ok) return;
    await deleteMethod.mutateAsync(m.id);
    toast.success("Meio de pagamento removido.");
  }

  const cardsByAccount = useMemo(() => {
    return accounts
      .map((a) => ({ account: a, cards: cards.filter((c) => c.accountId === a.id) }))
      .filter((g) => g.cards.length > 0);
  }, [accounts, cards]);

  return (
    <div>
      <div className="sticky top-0 z-10">
        <HeaderBand compact title="Meios de Pagamento" subtitle="Meios de pagamento e cartões" onBack={goBack} />
      </div>
      <div className="mx-auto max-w-2xl px-5 pb-8 md:pb-12">
        <div className="space-y-8 pt-6 pb-20">
          {/* ───── Meios de pagamento ───── */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Meios de pagamento</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Pix, Débito automático, Boleto, Transferência, Dinheiro e Cartão de débito já vêm prontos.
              Adicione aqui outros que você usa (ex.: "Vale-refeição").
            </p>

            {!addingMethod ? (
              <button
                type="button"
                onClick={() => setAddingMethod(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-2.5 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary"
              >
                <Plus className="h-4 w-4" /> Adicionar meio de pagamento
              </button>
            ) : (
              <div className="space-y-3 rounded-xl border border-border bg-card p-3">
                <input
                  autoFocus
                  value={newMethodName}
                  onChange={(e) => setNewMethodName(e.target.value)}
                  placeholder="Ex: Vale-refeição"
                  className={inputClass}
                />
                {duplicateMethod && (
                  <p className="text-xs text-debit">Já existe &ldquo;{duplicateMethod.name}&rdquo;.</p>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAddingMethod(false);
                      setNewMethodName("");
                    }}
                    className="rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleAddMethod}
                    disabled={!newMethodName.trim() || !!duplicateMethod || addMethod.isPending}
                    className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            )}

            {methods.length > 0 && (
              <div className="space-y-2">
                {methods.map((m) => (
                  <div key={m.id} className="rounded-xl border border-border bg-card p-3">
                    {editingMethodId === m.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          autoFocus
                          value={editMethodName}
                          onChange={(e) => setEditMethodName(e.target.value)}
                          className={`${inputClass} flex-1`}
                        />
                        <button
                          type="button"
                          onClick={() => setEditingMethodId(null)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-secondary"
                        >
                          <X className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => saveEditMethod(m)}
                          className="rounded p-1.5 text-primary hover:bg-secondary"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="min-w-0 flex-1 truncate font-semibold">{m.name}</span>
                        <div className="flex shrink-0 gap-0.5">
                          <button
                            type="button"
                            onClick={() => startEditMethod(m)}
                            className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMethod(m)}
                            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ───── Cartões ───── */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Cartões</h2>
            </div>

            <button
              type="button"
              onClick={() => setAddCardOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-2.5 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary"
            >
              <Plus className="h-4 w-4" /> Novo cartão
            </button>

            {cardsByAccount.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Nenhum cartão cadastrado ainda.</p>
            ) : (
              <div className="space-y-4">
                {cardsByAccount.map(({ account, cards: accCards }) => (
                  <div key={account.id}>
                    <p className="mb-2 px-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                      {account.name}
                    </p>
                    <div className="space-y-2">
                      {accCards.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setEditingCard(c)}
                          className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left hover:border-primary/40"
                        >
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                            style={{ backgroundColor: c.color + "33", color: c.color }}
                          >
                            <CreditCard className="h-[18px] w-[18px]" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold">{c.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Fecha dia {c.closingDay} · vence dia {c.dueDay}
                            </p>
                          </div>
                          <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <AddCardDialog open={addCardOpen} onClose={() => setAddCardOpen(false)} defaultYear={eff.year} defaultMonth={eff.month} />
      <EditCardDialog
        open={!!editingCard}
        onClose={() => setEditingCard(null)}
        card={editingCard}
        defaultYear={eff.year}
        defaultMonth={eff.month}
      />
    </div>
  );
}
