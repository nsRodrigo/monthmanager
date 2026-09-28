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
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_METHOD_BADGES,
} from "@/store/finance";
import { Plus, Pencil, Trash2, Check, X, Wallet, CreditCard, Info } from "lucide-react";

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
        <HeaderBand title="Meios de pagamento" subtitle="Formas de pagar e cartões cadastrados" onBack={goBack} />
      </div>
      <div className="mx-auto max-w-5xl px-4 pt-5 pb-24 sm:px-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
          {/* ───── Meios de pagamento ───── */}
          <section className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex items-start justify-between gap-3 p-4 pb-3">
              <div>
                <h2 className="font-display text-[15px] font-semibold">Meios de pagamento</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Aparecem como etiqueta nos lançamentos. Adicione outros que você usa (ex.: &ldquo;Vale-refeição&rdquo;).
                </p>
              </div>
              {!addingMethod && (
                <button
                  type="button"
                  onClick={() => setAddingMethod(true)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                >
                  <Plus className="h-3.5 w-3.5" /> Novo
                </button>
              )}
            </div>

            {addingMethod && (
              <div className="space-y-3 border-t border-border p-4">
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

            {/* Meios que já vêm prontos */}
            {PAYMENT_METHOD_OPTIONS.map((o) => (
              <div key={o.value} className="flex items-center gap-3 border-t border-border px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-[10.5px] font-bold tracking-wide text-muted-foreground">
                  {PAYMENT_METHOD_BADGES[o.value]}
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold">{o.label}</span>
                <span className="text-xs text-muted-foreground">padrão</span>
              </div>
            ))}

            {/* Os seus */}
            {methods.map((m) => (
              <div key={m.id} className="border-t border-border">
                {editingMethodId === m.id ? (
                  <div className="flex items-center gap-2 p-3">
                    <input
                      autoFocus
                      value={editMethodName}
                      onChange={(e) => setEditMethodName(e.target.value)}
                      className={`${inputClass} flex-1`}
                    />
                    <button
                      type="button"
                      onClick={() => setEditingMethodId(null)}
                      aria-label="Cancelar edição"
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => saveEditMethod(m)}
                      aria-label="Salvar"
                      className="rounded-lg p-1.5 text-primary hover:bg-secondary"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                      <Wallet className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1 truncate font-semibold">{m.name}</span>
                    <button
                      type="button"
                      onClick={() => startEditMethod(m)}
                      aria-label={`Editar ${m.name}`}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteMethod(m)}
                      aria-label={`Excluir ${m.name}`}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </section>

          {/* ───── Cartões ───── */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[17px] font-semibold tracking-tight">Cartões</h2>
              <button
                type="button"
                onClick={() => setAddCardOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-semibold hover:bg-muted"
              >
                <Plus className="h-3.5 w-3.5" /> Novo cartão
              </button>
            </div>

            {cardsByAccount.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                Nenhum cartão cadastrado ainda.
              </p>
            ) : (
              <div className="grid gap-3.5 sm:grid-cols-2">
                {cardsByAccount.flatMap(({ account, cards: accCards }) =>
                  accCards.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setEditingCard(c)}
                      aria-label={`Editar cartão ${c.name}`}
                      className="relative flex min-h-[170px] flex-col justify-between overflow-hidden rounded-2xl border border-white/10 p-4 text-left text-white transition-transform hover:-translate-y-0.5"
                      style={{
                        background: `linear-gradient(135deg, ${c.color}, color-mix(in oklab, ${c.color} 45%, #000))`,
                      }}
                    >
                      <span className="pointer-events-none absolute -top-10 -right-10 h-36 w-36 rounded-full bg-white/10" />
                      <span className="relative flex items-start justify-between gap-2">
                        <span className="font-display text-[15px] font-semibold">{c.name}</span>
                        <CreditCard className="h-5 w-5 shrink-0" aria-hidden="true" />
                      </span>
                      <span className="relative text-xs opacity-90">
                        <span className="mb-1 flex items-center justify-between gap-2">
                          <span>{account.name}</span>
                          <Pencil className="h-3 w-3" aria-hidden="true" />
                        </span>
                        Fecha dia {c.closingDay} · vence dia {c.dueDay}
                      </span>
                    </button>
                  )),
                )}
              </div>
            )}

            <div className="flex gap-3 rounded-xl border border-invest/30 bg-invest/10 p-3.5">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-invest" aria-hidden="true" />
              <div>
                <b className="block text-sm font-semibold">Fechamento e vencimento</b>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  O app usa esses dias para decidir em qual fatura cada compra cai e quando avisar.
                </p>
              </div>
            </div>
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
