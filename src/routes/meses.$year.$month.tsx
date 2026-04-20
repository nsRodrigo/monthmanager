import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  useCards,
  usePurchases,
  useInstallments,
  useDebits,
  useIncomes,
  useCardPayments,
  useToggleDebitPaid,
  useRemoveDebit,
  useToggleIncomeReceived,
  useRemoveIncome,
  useToggleInstallmentPaid,
  getMonthInstallments,
  getMonthDebits,
  getMonthIncomes,
  isCardFullyPaid,
  filterCardsByAccount,
  filterDebitsByAccount,
  filterIncomesByAccount,
  type Installment,
  type Debit,
  type Income,
} from "@/store/finance";
import { useAccountFilter } from "@/store/account-filter";
import { formatCurrency, MONTHS, formatDate } from "@/lib/format";
import {
  ArrowLeft,
  Plus,
  CreditCard,
  ArrowDownRight,
  ArrowUpRight,
  Trash2,
  Check,
  Pencil,
  ChevronRight,
  Zap,
} from "lucide-react";
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
  const [openDebit, setOpenDebit] = useState(false);
  const [openIncome, setOpenIncome] = useState(false);
  const [editing, setEditing] = useState<{
    inst: Installment;
    label: string;
    subtitle?: string;
    onDeleteParent?: () => void;
  } | null>(null);

  const { accountId } = useAccountFilter();
  const { data: allCards = [] } = useCards();
  const { data: purchases = [] } = usePurchases();
  const { data: installments = [] } = useInstallments();
  const { data: allDebits = [] } = useDebits();
  const { data: allIncomes = [] } = useIncomes();
  const { data: cardPayments = {} } = useCardPayments();

  const cards = filterCardsByAccount(allCards, accountId);
  const debits = filterDebitsByAccount(allDebits, accountId);
  const incomes = filterIncomesByAccount(allIncomes, accountId);

  const toggleInst = useToggleInstallmentPaid();
  const toggleDebit = useToggleDebitPaid();
  const removeDebit = useRemoveDebit();
  const toggleIncome = useToggleIncomeReceived();
  const removeIncome = useRemoveIncome();

  const allMonthInst = getMonthInstallments(installments, year, month);
  // restrict purchase installments to cards in current account
  const visibleCardIds = new Set(cards.map((c) => c.id));
  const visiblePurchaseIds = new Set(
    purchases.filter((p) => visibleCardIds.has(p.cardId)).map((p) => p.id),
  );
  const inst = allMonthInst.filter((i) =>
    i.parentType === "purchase" ? (accountId ? visiblePurchaseIds.has(i.parentId) : true) : true,
  );
  const monthDebits = getMonthDebits(debits, installments, year, month);
  const monthIncomes = getMonthIncomes(incomes, installments, year, month);

  const totalCredit = inst
    .filter((i) => i.parentType === "purchase")
    .reduce((s, i) => s + i.amount, 0);
  const totalDebits =
    monthDebits.single.reduce((s, d) => s + d.amount, 0) +
    monthDebits.parcelled.reduce((s, p) => s + p.installment.amount, 0);
  const totalIncome =
    monthIncomes.single.reduce((s, i) => s + i.amount, 0) +
    monthIncomes.parcelled.reduce((s, p) => s + p.installment.amount, 0);

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
          <div className="space-y-3">
            {cards.length === 0 && <Empty text="Nenhum cartão cadastrado." />}
            {cards.map((c) => {
              const cardInst = inst.filter((i) => {
                if (i.parentType !== "purchase") return false;
                const pur = purchases.find((p) => p.id === i.parentId);
                return pur?.cardId === c.id;
              });
              const total = cardInst.reduce((s, i) => s + i.amount, 0);
              const paid = isCardFullyPaid(installments, purchases, cardPayments, c.id, year, month);
              return (
                <Link
                  key={c.id}
                  to="/meses/$year/$month/cartao/$cardId"
                  params={{ year: y, month: m, cardId: c.id }}
                  className="group flex items-center gap-4 rounded-2xl border border-border bg-gradient-card p-5 transition-all hover:border-primary/40 hover:shadow-glow"
                >
                  <div className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{c.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {cardInst.length} {cardInst.length === 1 ? "lançamento" : "lançamentos"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold">{formatCurrency(total)}</p>
                    <span
                      className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        paid ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
                      }`}
                    >
                      {paid ? "Pago" : "Em aberto"}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                </Link>
              );
            })}
            <p className="px-1 text-center text-xs text-muted-foreground">
              Toque em um cartão para ver compras, parcelas e adicionar itens.
            </p>
          </div>
        )}

        {tab === "debitos" && (
          <div className="space-y-3">
            {monthDebits.single.length === 0 && monthDebits.parcelled.length === 0 && (
              <Empty text="Nenhum débito neste mês." />
            )}
            {monthDebits.single.map((d) => (
              <DebitRow
                key={d.id}
                debit={d}
                onToggle={() => toggleDebit.mutate({ id: d.id, paid: !d.paid })}
                onRemove={() => removeDebit.mutate(d.id)}
              />
            ))}
            {monthDebits.parcelled.map((p) => (
              <ParcelledRow
                key={p.installment.id}
                kind="debit"
                installment={p.installment}
                parent={p.debit!}
                onToggle={() => toggleInst(p.installment.id, !p.installment.paid)}
                onEdit={() =>
                  setEditing({
                    inst: p.installment,
                    label: p.debit!.description,
                    subtitle: `Débito parcelado · Total ${formatCurrency(p.debit!.amount)} em ${p.debit!.installmentsCount}x`,
                    onDeleteParent: () => removeDebit.mutate(p.debit!.id),
                  })
                }
              />
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
            {monthIncomes.single.length === 0 && monthIncomes.parcelled.length === 0 && (
              <Empty text="Nenhum recebimento neste mês." />
            )}
            {monthIncomes.single.map((i) => (
              <IncomeRow
                key={i.id}
                income={i}
                onToggle={() => toggleIncome.mutate({ id: i.id, received: !i.received })}
                onRemove={() => removeIncome.mutate(i.id)}
              />
            ))}
            {monthIncomes.parcelled.map((p) => (
              <ParcelledRow
                key={p.installment.id}
                kind="income"
                installment={p.installment}
                parent={p.income!}
                onToggle={() => toggleInst(p.installment.id, !p.installment.paid)}
                onEdit={() =>
                  setEditing({
                    inst: p.installment,
                    label: p.income!.description,
                    subtitle: `Recebimento parcelado · Total ${formatCurrency(p.income!.amount)} em ${p.income!.installmentsCount}x`,
                    onDeleteParent: () => removeIncome.mutate(p.income!.id),
                  })
                }
              />
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

      {tab !== "cartoes" && (
        <button
          onClick={() => (tab === "debitos" ? setOpenDebit(true) : setOpenIncome(true))}
          className="fixed bottom-20 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground shadow-glow transition-transform hover:scale-110 md:hidden"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      <AddDebitDialog open={openDebit} onClose={() => setOpenDebit(false)} defaultYear={year} defaultMonth={month} />
      <AddIncomeDialog open={openIncome} onClose={() => setOpenIncome(false)} defaultYear={year} defaultMonth={month} />
      <EditInstallmentDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        installment={editing?.inst ?? null}
        parentLabel={editing?.label}
        parentSubtitle={editing?.subtitle}
        onDeleteParent={editing?.onDeleteParent}
      />
    </div>
  );
}

function DebitRow({ debit, onToggle, onRemove }: { debit: Debit; onToggle: () => void; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
      <button
        onClick={onToggle}
        className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors ${
          debit.paid ? "border-success bg-success text-success-foreground" : "border-border hover:border-primary"
        }`}
      >
        {debit.paid && <Check className="h-3.5 w-3.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className={`truncate font-medium ${debit.paid ? "text-muted-foreground line-through" : ""}`}>{debit.description}</p>
          {debit.required && (
            <span className="rounded-full bg-debit/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-debit">
              Obrigatório
            </span>
          )}
          {debit.autoDebit && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
              <Zap className="h-3 w-3" />Auto{debit.autoDebitDay ? ` dia ${debit.autoDebitDay}` : ""}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{formatDate(debit.date)}</p>
      </div>
      <p className="font-semibold text-debit">{formatCurrency(debit.amount)}</p>
      <button onClick={onRemove} className="text-muted-foreground hover:text-destructive">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function IncomeRow({ income, onToggle, onRemove }: { income: Income; onToggle: () => void; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
      <button
        onClick={onToggle}
        className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors ${
          income.received ? "border-success bg-success text-success-foreground" : "border-border hover:border-primary"
        }`}
      >
        {income.received && <Check className="h-3.5 w-3.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`truncate font-medium ${income.received ? "text-muted-foreground" : ""}`}>{income.description}</p>
        <p className="text-xs text-muted-foreground">{formatDate(income.date)}</p>
      </div>
      <p className="font-semibold text-success">{formatCurrency(income.amount)}</p>
      <button onClick={onRemove} className="text-muted-foreground hover:text-destructive">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function ParcelledRow({
  kind,
  installment,
  parent,
  onToggle,
  onEdit,
}: {
  kind: "debit" | "income";
  installment: Installment;
  parent: Debit | Income;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const tone = kind === "debit" ? "text-debit" : "text-success";
  const auto = kind === "debit" && (parent as Debit).autoDebit;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
      <button
        onClick={onToggle}
        className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors ${
          installment.paid ? "border-success bg-success text-success-foreground" : "border-border hover:border-primary"
        }`}
      >
        {installment.paid && <Check className="h-3.5 w-3.5" />}
      </button>
      <button onClick={onEdit} className="flex-1 min-w-0 text-left">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className={`truncate font-medium ${installment.paid ? "text-muted-foreground line-through" : ""}`}>
            {parent.description}
          </p>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
            {installment.number}/{installment.total}
          </span>
          {auto && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
              <Zap className="h-3 w-3" />Auto
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">venc. {formatDate(installment.dueDate)}</p>
      </button>
      <p className={`font-semibold ${tone}`}>{formatCurrency(installment.amount)}</p>
      <button onClick={onEdit} className="text-muted-foreground hover:text-primary" title="Editar parcela">
        <Pencil className="h-4 w-4" />
      </button>
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
