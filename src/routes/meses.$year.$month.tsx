import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  useCards,
  usePurchases,
  useInstallments,
  useDebits,
  useIncomes,
  useCardPayments,
  useToggleInstallmentPaid,
  useSetCardPaid,
  useRemovePurchase,
  useToggleDebitPaid,
  useRemoveDebit,
  useToggleIncomeReceived,
  useRemoveIncome,
  getMonthInstallments,
  getMonthDebits,
  getMonthIncomes,
  isCardFullyPaid,
  type Installment,
  type Purchase,
} from "@/store/finance";
import { formatCurrency, MONTHS, formatDate } from "@/lib/format";
import { ArrowLeft, Plus, CreditCard, ArrowDownRight, ArrowUpRight, Trash2, Check, Pencil } from "lucide-react";
import { AddPurchaseDialog } from "@/components/AddPurchaseDialog";
import { AddDebitDialog } from "@/components/AddDebitDialog";
import { AddIncomeDialog } from "@/components/AddIncomeDialog";
import { EditInstallmentDialog } from "@/components/EditInstallmentDialog";

export const Route = createFileRoute("/meses/$year/$month")({
  head: ({ params }) => ({
    meta: [{ title: `${MONTHS[Number(params.month)]} ${params.year} — Finanças` }],
  }),
  component: MonthView,
});

type Tab = "cartoes" | "debitos" | "recebimentos";

function MonthView() {
  const { year: y, month: m } = Route.useParams();
  const year = Number(y);
  const month = Number(m);
  const [tab, setTab] = useState<Tab>("cartoes");
  const [openPurchase, setOpenPurchase] = useState(false);
  const [openDebit, setOpenDebit] = useState(false);
  const [openIncome, setOpenIncome] = useState(false);
  const [editing, setEditing] = useState<{ inst: Installment; pur: Purchase } | null>(null);

  const { data: cards = [] } = useCards();
  const { data: purchases = [] } = usePurchases();
  const { data: installments = [] } = useInstallments();
  const { data: debits = [] } = useDebits();
  const { data: incomes = [] } = useIncomes();
  const { data: cardPayments = {} } = useCardPayments();

  const toggleInst = useToggleInstallmentPaid();
  const setCardPaid = useSetCardPaid();
  const removePurchase = useRemovePurchase();
  const toggleDebit = useToggleDebitPaid();
  const removeDebit = useRemoveDebit();
  const toggleIncome = useToggleIncomeReceived();
  const removeIncome = useRemoveIncome();

  const inst = getMonthInstallments(installments, year, month);
  const monthDebits = getMonthDebits(debits, year, month);
  const monthIncomes = getMonthIncomes(incomes, year, month);

  const totalCredit = inst.reduce((s, i) => s + i.amount, 0);
  const totalDebits = monthDebits.reduce((s, d) => s + d.amount, 0);
  const totalIncome = monthIncomes.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 md:py-12">
      <Link to="/meses" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Todos os meses
      </Link>

      <header className="mb-8">
        <p className="text-sm font-medium text-primary">{year}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">{MONTHS[month]}</h1>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <SummaryPill label="Crédito" value={formatCurrency(totalCredit)} tone="credit" />
        <SummaryPill label="Débitos" value={formatCurrency(totalDebits)} tone="debit" />
        <SummaryPill label="Recebido" value={formatCurrency(totalIncome)} tone="income" />
      </div>

      <div className="mt-8 flex gap-1 rounded-full border border-border bg-card p-1">
        {(["cartoes", "debitos", "recebimentos"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-medium capitalize transition-all ${
              tab === t ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "cartoes" ? "Cartões" : t === "debitos" ? "Débitos" : "Recebimentos"}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "cartoes" && (
          <div className="space-y-4">
            {cards.length === 0 && <Empty text="Nenhum cartão cadastrado." />}
            {cards.map((c) => {
              const cardInst = inst.filter((i) => {
                const pur = purchases.find((p) => p.id === i.purchaseId);
                return pur?.cardId === c.id;
              });
              const total = cardInst.reduce((s, i) => s + i.amount, 0);
              const paid = isCardFullyPaid(installments, purchases, cardPayments, c.id, year, month);
              return (
                <div key={c.id} className="overflow-hidden rounded-2xl border border-border bg-gradient-card">
                  <div className="flex items-center justify-between gap-3 border-b border-border p-5">
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: c.color }} />
                      <div>
                        <p className="font-semibold">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {cardInst.length} {cardInst.length === 1 ? "parcela" : "parcelas"} · {formatCurrency(total)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setCardPaid.mutate({ cardId: c.id, year, month, paid: !paid })}
                      className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                        paid ? "bg-success/15 text-success hover:bg-success/25" : "bg-warning/15 text-warning hover:bg-warning/25"
                      }`}
                    >
                      {paid ? "✓ Pago" : "Marcar pago"}
                    </button>
                  </div>
                  <div className="divide-y divide-border">
                    {cardInst.length === 0 && (
                      <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                        Nenhuma compra neste mês.
                      </div>
                    )}
                    {cardInst.map((i) => {
                      const pur = purchases.find((p) => p.id === i.purchaseId)!;
                      return (
                        <div key={i.id} className="flex items-center gap-3 px-5 py-3">
                          <button
                            onClick={() => toggleInst(i.id, !i.paid)}
                            className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors ${
                              i.paid ? "border-success bg-success text-success-foreground" : "border-border hover:border-primary"
                            }`}
                          >
                            {i.paid && <Check className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            onClick={() => setEditing({ inst: i, pur })}
                            className="flex-1 min-w-0 text-left"
                          >
                            <p className={`truncate text-sm font-medium ${i.paid ? "text-muted-foreground line-through" : ""}`}>
                              {pur.description}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {i.total > 1 ? `Parcela ${i.number}/${i.total}` : "À vista"} · venc. {formatDate(i.dueDate)}
                            </p>
                          </button>
                          <p className="text-sm font-semibold">{formatCurrency(i.amount)}</p>
                          <button
                            onClick={() => setEditing({ inst: i, pur })}
                            className="text-muted-foreground hover:text-primary"
                            title="Editar parcela"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <button
              onClick={() => setOpenPurchase(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border py-4 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <Plus className="h-4 w-4" /> Nova compra
            </button>
          </div>
        )}

        {tab === "debitos" && (
          <div className="space-y-3">
            {monthDebits.length === 0 && <Empty text="Nenhum débito neste mês." />}
            {monthDebits.map((d) => (
              <div key={d.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                <button
                  onClick={() => toggleDebit.mutate({ id: d.id, paid: !d.paid })}
                  className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors ${
                    d.paid ? "border-success bg-success text-success-foreground" : "border-border hover:border-primary"
                  }`}
                >
                  {d.paid && <Check className="h-3.5 w-3.5" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`truncate font-medium ${d.paid ? "text-muted-foreground line-through" : ""}`}>{d.description}</p>
                    {d.required && (
                      <span className="rounded-full bg-debit/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-debit">
                        Obrigatório
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{formatDate(d.date)}</p>
                </div>
                <p className="font-semibold text-debit">{formatCurrency(d.amount)}</p>
                <button onClick={() => removeDebit.mutate(d.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              onClick={() => setOpenDebit(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border py-4 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <Plus className="h-4 w-4" /> Novo débito
            </button>
          </div>
        )}

        {tab === "recebimentos" && (
          <div className="space-y-3">
            {monthIncomes.length === 0 && <Empty text="Nenhum recebimento neste mês." />}
            {monthIncomes.map((i) => (
              <div key={i.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                <button
                  onClick={() => toggleIncome.mutate({ id: i.id, received: !i.received })}
                  className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors ${
                    i.received ? "border-success bg-success text-success-foreground" : "border-border hover:border-primary"
                  }`}
                >
                  {i.received && <Check className="h-3.5 w-3.5" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`truncate font-medium ${i.received ? "text-muted-foreground" : ""}`}>{i.description}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(i.date)}</p>
                </div>
                <p className="font-semibold text-success">{formatCurrency(i.amount)}</p>
                <button onClick={() => removeIncome.mutate(i.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              onClick={() => setOpenIncome(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border py-4 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <Plus className="h-4 w-4" /> Novo recebimento
            </button>
          </div>
        )}
      </div>

      <button
        onClick={() => {
          if (tab === "cartoes") setOpenPurchase(true);
          else if (tab === "debitos") setOpenDebit(true);
          else setOpenIncome(true);
        }}
        className="fixed bottom-20 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground shadow-glow transition-transform hover:scale-110 md:hidden"
      >
        <Plus className="h-6 w-6" />
      </button>

      <AddPurchaseDialog open={openPurchase} onClose={() => setOpenPurchase(false)} defaultYear={year} defaultMonth={month} />
      <AddDebitDialog open={openDebit} onClose={() => setOpenDebit(false)} defaultYear={year} defaultMonth={month} />
      <AddIncomeDialog open={openIncome} onClose={() => setOpenIncome(false)} defaultYear={year} defaultMonth={month} />
      <EditInstallmentDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        installment={editing?.inst ?? null}
        purchase={editing?.pur ?? null}
        onDeletePurchase={editing ? () => removePurchase.mutate(editing.pur.id) : undefined}
      />
    </div>
  );
}

function SummaryPill({ label, value, tone }: { label: string; value: string; tone: "credit" | "debit" | "income" }) {
  const c = tone === "credit" ? "text-credit" : tone === "debit" ? "text-debit" : "text-success";
  const Icon = tone === "income" ? ArrowUpRight : tone === "debit" ? ArrowDownRight : CreditCard;
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <p className={`mt-1.5 text-base font-bold md:text-lg ${c}`}>{value}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
