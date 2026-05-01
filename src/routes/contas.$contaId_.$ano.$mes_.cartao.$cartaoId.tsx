import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  useAccounts,
  useCards,
  usePurchases,
  useInstallments,
  useCardPayments,
  useToggleInstallmentPaid,
  useSetCardPaid,
  useRemovePurchase,
  isCardFullyPaid,
  type Installment,
} from "@/store/finance";
import { useAccountFilter } from "@/store/account-filter";
import { formatCurrency, MONTHS, formatDate } from "@/lib/format";
import { ChevronLeft, Plus, Check, Pencil, Trash2, CheckSquare, Square } from "lucide-react";
import { AddPurchaseDialog } from "@/components/AddPurchaseDialog";
import { EditInstallmentDialog } from "@/components/EditInstallmentDialog";

export const Route = createFileRoute("/contas/$contaId_/$ano/$mes_/cartao/$cartaoId")({
  head: ({ params }) => ({
    meta: [{ title: `Fatura — ${MONTHS[Number(params.mes)]} ${params.ano}` }],
  }),
  component: CardInvoice,
});

function CardInvoice() {
  const { contaId, ano, mes, cartaoId } = Route.useParams();
  const year = Number(ano);
  const month = Number(mes);

  const { data: accounts = [] } = useAccounts();
  const { data: cards = [] } = useCards();
  const { data: purchases = [] } = usePurchases();
  const { data: installments = [] } = useInstallments();
  const { data: cardPayments = {} } = useCardPayments();

  const toggleInst = useToggleInstallmentPaid();
  const setCardPaid = useSetCardPaid();
  const removePurchase = useRemovePurchase();

  const { setAccountId } = useAccountFilter();
  useEffect(() => setAccountId(contaId), [contaId, setAccountId]);

  const [openAdd, setOpenAdd] = useState(false);
  const [editing, setEditing] = useState<Installment | null>(null);

  const account = accounts.find((a) => a.id === contaId);
  const card = cards.find((c) => c.id === cartaoId);

  const monthInst = installments
    .filter((i) => i.parentType === "purchase" && i.year === year && i.month === month)
    .filter((i) => {
      const pur = purchases.find((p) => p.id === i.parentId);
      return pur?.cardId === cartaoId;
    });

  const total = monthInst.reduce((s, i) => s + i.amount, 0);
  const paidTotal = monthInst.filter((i) => i.paid).reduce((s, i) => s + i.amount, 0);
  const fullyPaid = isCardFullyPaid(installments, purchases, cardPayments, cartaoId, year, month);

  const grouped = new Map<
    string,
    { purchase: (typeof purchases)[number]; items: Installment[] }
  >();
  for (const i of monthInst) {
    const pur = purchases.find((p) => p.id === i.parentId);
    if (!pur) continue;
    if (!grouped.has(pur.id)) grouped.set(pur.id, { purchase: pur, items: [] });
    grouped.get(pur.id)!.items.push(i);
  }
  const groups = Array.from(grouped.values()).sort((a, b) =>
    a.purchase.date.localeCompare(b.purchase.date),
  );

  const editingPurchase = editing ? purchases.find((p) => p.id === editing.parentId) : null;

  if (!card || !account) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-12 text-center text-muted-foreground">
        Cartão ou conta não encontrados.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 md:py-12">
      <Link
        to="/contas/$contaId/$ano/$mes"
        params={{ contaId, ano, mes }}
        className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> {MONTHS[month]} {year}
      </Link>

      <header className="mb-6 overflow-hidden rounded-2xl border border-border bg-gradient-card p-6">
        <div className="flex items-center gap-3">
          <div className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: card.color }} />
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {account.name} · Fatura
            </p>
            <h1 className="text-2xl font-bold tracking-tight">{card.name}</h1>
          </div>
          <button
            type="button"
            onClick={() => {
              setCardPaid.mutate(
                { cardId: cartaoId, year, month, paid: !fullyPaid },
                {
                  onError: (e: any) =>
                    alert(`Erro ao atualizar fatura: ${e?.message ?? "tente novamente"}`),
                },
              );
            }}
            disabled={setCardPaid.isPending}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors disabled:opacity-60 ${
              fullyPaid
                ? "bg-success/15 text-success hover:bg-success/25"
                : "bg-warning/15 text-warning hover:bg-warning/25"
            }`}
          >
            {setCardPaid.isPending ? "..." : fullyPaid ? "✓ Fatura paga" : "Marcar paga"}
          </button>
        </div>

        {monthInst.length > 0 && (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => {
                const allPaid = monthInst.every((i) => i.paid);
                monthInst.forEach((i) => {
                  if (i.paid !== !allPaid) toggleInst(i.id, !allPaid);
                });
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-[11px] font-semibold text-foreground hover:bg-secondary/80"
            >
              {monthInst.every((i) => i.paid) ? (
                <>
                  <Square className="h-3.5 w-3.5" /> Desmarcar todas
                </>
              ) : (
                <>
                  <CheckSquare className="h-3.5 w-3.5" /> Marcar todas como pagas
                </>
              )}
            </button>
          </div>
        )}

        <div className="mt-5 grid grid-cols-3 gap-3">
          <Stat label="Total" value={formatCurrency(total)} />
          <Stat label="Pago" value={formatCurrency(paidTotal)} tone="success" />
          <Stat
            label="A pagar"
            value={formatCurrency(total - paidTotal)}
            tone={total - paidTotal > 0 ? "warning" : "success"}
          />
        </div>
      </header>

      {groups.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nenhuma compra nesta fatura.
        </div>
      )}

      <div className="space-y-4">
        {groups.map(({ purchase, items }) => {
          // Valor em destaque = valor da parcela do mês.
          // Se houver múltiplas parcelas da mesma compra no mesmo mês (raro),
          // mostramos a soma — ainda assim continua sendo "o que cai neste mês".
          const headlineAmount =
            items.length === 1 ? items[0].amount : items.reduce((s, i) => s + i.amount, 0);
          const installmentsCount = purchase.installmentsCount;
          return (
            <div
              key={purchase.id}
              className="overflow-hidden rounded-2xl border border-border bg-card"
            >
              <div className="flex items-start justify-between gap-3 border-b border-border p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{purchase.description}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDate(purchase.date)}
                    {installmentsCount > 1
                      ? ` · ${formatCurrency(purchase.totalAmount)} em ${installmentsCount}x`
                      : ` · ${formatCurrency(purchase.totalAmount)} à vista`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-base font-bold text-credit">
                    {formatCurrency(headlineAmount)}
                  </span>
                  <button
                    onClick={() => {
                      if (confirm(`Excluir "${purchase.description}" e todas as parcelas?`)) {
                        removePurchase.mutate(purchase.id);
                      }
                    }}
                    className="rounded p-1 text-muted-foreground hover:text-destructive"
                    title="Excluir compra inteira"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="divide-y divide-border">
                {items.map((i) => (
                  <div key={i.id} className="flex items-center gap-3 px-4 py-3">
                    <button
                      onClick={() => toggleInst(i.id, !i.paid)}
                      className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors ${
                        i.paid
                          ? "border-success bg-success text-success-foreground"
                          : "border-border hover:border-primary"
                      }`}
                    >
                      {i.paid && <Check className="h-3.5 w-3.5" />}
                    </button>
                    <button onClick={() => setEditing(i)} className="flex-1 min-w-0 text-left">
                      <p
                        className={`text-sm font-medium ${
                          i.paid ? "text-muted-foreground line-through" : ""
                        }`}
                      >
                        {i.total > 1 ? `Parcela ${i.number}/${i.total}` : "Pagamento"}
                      </p>
                      <p className="text-xs text-muted-foreground">venc. {formatDate(i.dueDate)}</p>
                    </button>
                    <p className="text-sm font-semibold">{formatCurrency(i.amount)}</p>
                    <button
                      onClick={() => setEditing(i)}
                      className="text-muted-foreground hover:text-primary"
                      title="Editar parcela"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={() => setOpenAdd(true)}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border py-4 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
      >
        <Plus className="h-4 w-4" /> Adicionar item à fatura
      </button>

      <AddPurchaseDialog
        open={openAdd}
        onClose={() => setOpenAdd(false)}
        defaultYear={year}
        defaultMonth={month}
        fixedCardId={cartaoId}
      />

      <EditInstallmentDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        installment={editing}
        parentLabel={editingPurchase?.description}
        parentSubtitle={
          editingPurchase
            ? `Total ${formatCurrency(editingPurchase.totalAmount)} em ${editingPurchase.installmentsCount}x · ${formatDate(editingPurchase.date)}`
            : undefined
        }
        onDeleteParent={
          editingPurchase ? () => removePurchase.mutate(editingPurchase.id) : undefined
        }
      />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "warning";
}) {
  const c =
    tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-foreground";
  return (
    <div className="rounded-xl bg-background/50 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 text-base font-bold ${c}`}>{value}</p>
    </div>
  );
}
