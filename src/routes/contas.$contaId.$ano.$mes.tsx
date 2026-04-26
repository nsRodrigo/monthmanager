import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  useAccounts,
  useCards,
  usePurchases,
  useInstallments,
  useDebits,
  useIncomes,
  useInvestments,
  useCardPayments,
  useToggleDebitPaid,
  useRemoveDebit,
  useToggleIncomeReceived,
  useRemoveIncome,
  useToggleInstallmentPaid,
  useRemoveInvestment,
  getMonthInstallments,
  getMonthDebits,
  getMonthIncomes,
  isCardFullyPaid,
  type Installment,
  type Debit,
  type Income,
  type Investment,
} from "@/store/finance";
import { useAccountFilter } from "@/store/account-filter";
import { formatCurrency, MONTHS, formatDate } from "@/lib/format";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CreditCard,
  ArrowDownRight,
  ArrowUpRight,
  TrendingUp,
  Trash2,
  Check,
  Pencil,
  Zap,
} from "lucide-react";
import { AddDebitDialog } from "@/components/AddDebitDialog";
import { AddIncomeDialog } from "@/components/AddIncomeDialog";
import { EditInstallmentDialog } from "@/components/EditInstallmentDialog";

export const Route = createFileRoute("/contas/$contaId/$ano/$mes")({
  head: ({ params }) => ({
    meta: [
      {
        title: `${MONTHS[Number(params.mes)]} ${params.ano} — Finanças`,
      },
    ],
  }),
  component: AccountMonth,
});

function AccountMonth() {
  const { contaId, ano, mes } = Route.useParams();
  const year = Number(ano);
  const month = Number(mes);

  const { data: accounts = [] } = useAccounts();
  const { data: cards = [] } = useCards();
  const { data: purchases = [] } = usePurchases();
  const { data: installments = [] } = useInstallments();
  const { data: allDebits = [] } = useDebits();
  const { data: allIncomes = [] } = useIncomes();
  const { data: allInvestments = [] } = useInvestments();
  const { data: cardPayments = {} } = useCardPayments();

  const { setAccountId } = useAccountFilter();
  useEffect(() => setAccountId(contaId), [contaId, setAccountId]);

  const account = accounts.find((a) => a.id === contaId);

  const toggleInst = useToggleInstallmentPaid();
  const toggleDebit = useToggleDebitPaid();
  const removeDebit = useRemoveDebit();
  const toggleIncome = useToggleIncomeReceived();
  const removeIncome = useRemoveIncome();
  const removeInvestment = useRemoveInvestment();

  const [openDebit, setOpenDebit] = useState(false);
  const [openIncome, setOpenIncome] = useState(false);
  const [editing, setEditing] = useState<{
    inst: Installment;
    label: string;
    subtitle?: string;
    onDeleteParent?: () => void;
  } | null>(null);

  const accountCards = cards.filter((c) => c.accountId === contaId);
  const accountCardIds = new Set(accountCards.map((c) => c.id));
  const debits = allDebits.filter((d) => d.accountId === contaId);
  const incomes = allIncomes.filter((i) => i.accountId === contaId);
  const investments = allInvestments.filter((i) => i.accountId === contaId);

  const visiblePurchaseIds = new Set(
    purchases.filter((p) => accountCardIds.has(p.cardId)).map((p) => p.id),
  );

  const monthInst = getMonthInstallments(installments, year, month).filter((i) =>
    i.parentType === "purchase" ? visiblePurchaseIds.has(i.parentId) : true,
  );
  const monthDebits = getMonthDebits(debits, installments, year, month);
  const monthIncomes = getMonthIncomes(incomes, installments, year, month);

  const totalDebits =
    monthDebits.single.reduce((s, d) => s + d.amount, 0) +
    monthDebits.parcelled.reduce((s, p) => s + p.installment.amount, 0);
  const totalIncome =
    monthIncomes.single.reduce((s, i) => s + i.amount, 0) +
    monthIncomes.parcelled.reduce((s, p) => s + p.installment.amount, 0);
  const totalCards = monthInst
    .filter((i) => i.parentType === "purchase")
    .reduce((s, i) => s + i.amount, 0);
  const totalInvested = investments.reduce((s, i) => s + i.amount, 0);

  if (!account) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-12 text-center text-muted-foreground">
        Conta não encontrada.
      </div>
    );
  }

  const prevMonth = month === 0 ? { y: year - 1, m: 11 } : { y: year, m: month - 1 };
  const nextMonth = month === 11 ? { y: year + 1, m: 0 } : { y: year, m: month + 1 };

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:py-12">
      <div className="mb-4 flex items-center justify-between">
        <Link
          to="/contas/$contaId"
          params={{ contaId }}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> {account.name}
        </Link>
        <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
          <Link
            to="/contas/$contaId/$ano/$mes"
            params={{ contaId, ano: String(prevMonth.y), mes: String(prevMonth.m) }}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="px-2 text-xs font-semibold capitalize">
            {MONTHS[month]} {year}
          </span>
          <Link
            to="/contas/$contaId/$ano/$mes"
            params={{ contaId, ano: String(nextMonth.y), mes: String(nextMonth.m) }}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <header className="mb-6">
        <p className="text-sm font-medium" style={{ color: account.color }}>
          {account.name} · {year}
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl capitalize">
          {MONTHS[month]}
        </h1>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryPill label="Recebido" value={formatCurrency(totalIncome)} tone="income" />
        <SummaryPill label="Débitos" value={formatCurrency(totalDebits)} tone="debit" />
        <SummaryPill label="Cartões" value={formatCurrency(totalCards)} tone="credit" />
        <SummaryPill label="Investido" value={formatCurrency(totalInvested)} tone="primary" />
      </div>

      {/* FRAMES */}
      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        {/* DEBITS */}
        <Frame
          title="Débitos"
          icon={ArrowDownRight}
          tone="debit"
          total={formatCurrency(totalDebits)}
          onAdd={() => setOpenDebit(true)}
          addLabel="Novo débito"
        >
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
        </Frame>

        {/* INCOMES */}
        <Frame
          title="Recebimentos"
          icon={ArrowUpRight}
          tone="income"
          total={formatCurrency(totalIncome)}
          onAdd={() => setOpenIncome(true)}
          addLabel="Novo recebimento"
        >
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
        </Frame>

        {/* INVESTMENTS — full width */}
        <Frame
          title="Investimentos"
          icon={TrendingUp}
          tone="primary"
          total={formatCurrency(totalInvested)}
          className="lg:col-span-2"
        >
          {investments.length === 0 && <Empty text="Nenhum investimento nesta conta." />}
          {investments.map((inv) => (
            <InvestmentRow
              key={inv.id}
              inv={inv}
              onRemove={() => removeInvestment.mutate(inv.id)}
            />
          ))}
        </Frame>
      </div>

      {/* CARDS */}
      <section className="mt-8">
        <div className="mb-3 flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-credit" />
          <h2 className="text-lg font-semibold">Cartões da conta</h2>
        </div>
        {accountCards.length === 0 ? (
          <Empty text="Nenhum cartão vinculado a esta conta. Crie em 'Adicionar cartão'." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {accountCards.map((c) => {
              const cardInst = monthInst.filter((i) => {
                if (i.parentType !== "purchase") return false;
                const pur = purchases.find((p) => p.id === i.parentId);
                return pur?.cardId === c.id;
              });
              const total = cardInst.reduce((s, i) => s + i.amount, 0);
              const paid = isCardFullyPaid(installments, purchases, cardPayments, c.id, year, month);
              return (
                <Link
                  key={c.id}
                  to="/contas/$contaId/$ano/$mes/cartao/$cartaoId"
                  params={{ contaId, ano, mes, cartaoId: c.id }}
                  className="group flex items-center gap-3 rounded-2xl border border-border bg-gradient-card p-4 transition-all hover:border-primary/40 hover:shadow-glow"
                >
                  <div
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: c.color }}
                  />
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
                        paid
                          ? "bg-success/15 text-success"
                          : "bg-warning/15 text-warning"
                      }`}
                    >
                      {paid ? "Pago" : "Em aberto"}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <AddDebitDialog
        open={openDebit}
        onClose={() => setOpenDebit(false)}
        defaultYear={year}
        defaultMonth={month}
      />
      <AddIncomeDialog
        open={openIncome}
        onClose={() => setOpenIncome(false)}
        defaultYear={year}
        defaultMonth={month}
      />
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

/* ───────── presentational components ───────── */

function Frame({
  title,
  icon: Icon,
  tone,
  total,
  children,
  onAdd,
  addLabel,
  className = "",
}: {
  title: string;
  icon: typeof ArrowDownRight;
  tone: "debit" | "income" | "primary" | "credit";
  total: string;
  children: React.ReactNode;
  onAdd?: () => void;
  addLabel?: string;
  className?: string;
}) {
  const colors = {
    debit: "text-debit",
    income: "text-success",
    credit: "text-credit",
    primary: "text-primary",
  } as const;
  return (
    <section
      className={`overflow-hidden rounded-2xl border border-border bg-card ${className}`}
    >
      <header className="flex items-center justify-between border-b border-border bg-card/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${colors[tone]}`} />
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <p className={`text-sm font-bold ${colors[tone]}`}>{total}</p>
      </header>
      <div className="space-y-2 p-3">
        {children}
        {onAdd && addLabel && (
          <button
            onClick={onAdd}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-3 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <Plus className="h-3.5 w-3.5" /> {addLabel}
          </button>
        )}
      </div>
    </section>
  );
}

function DebitRow({
  debit,
  onToggle,
  onRemove,
}: {
  debit: Debit;
  onToggle: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-background/40 p-3">
      <button
        onClick={onToggle}
        className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors ${
          debit.paid
            ? "border-success bg-success text-success-foreground"
            : "border-border hover:border-primary"
        }`}
      >
        {debit.paid && <Check className="h-3 w-3" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <p
            className={`truncate text-sm font-medium ${
              debit.paid ? "text-muted-foreground line-through" : ""
            }`}
          >
            {debit.description}
          </p>
          {debit.required && (
            <span className="rounded-full bg-debit/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-debit">
              Obrig.
            </span>
          )}
          {debit.autoDebit && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-primary">
              <Zap className="h-2.5 w-2.5" />
              Auto{debit.autoDebitDay ? ` d${debit.autoDebitDay}` : ""}
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">{formatDate(debit.date)}</p>
      </div>
      <p className="text-sm font-semibold text-debit">{formatCurrency(debit.amount)}</p>
      <button onClick={onRemove} className="text-muted-foreground hover:text-destructive">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function IncomeRow({
  income,
  onToggle,
  onRemove,
}: {
  income: Income;
  onToggle: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-background/40 p-3">
      <button
        onClick={onToggle}
        className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors ${
          income.received
            ? "border-success bg-success text-success-foreground"
            : "border-border hover:border-primary"
        }`}
      >
        {income.received && <Check className="h-3 w-3" />}
      </button>
      <div className="flex-1 min-w-0">
        <p
          className={`truncate text-sm font-medium ${
            income.received ? "text-muted-foreground" : ""
          }`}
        >
          {income.description}
        </p>
        <p className="text-[11px] text-muted-foreground">{formatDate(income.date)}</p>
      </div>
      <p className="text-sm font-semibold text-success">{formatCurrency(income.amount)}</p>
      <button onClick={onRemove} className="text-muted-foreground hover:text-destructive">
        <Trash2 className="h-3.5 w-3.5" />
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
    <div className="flex items-center gap-3 rounded-xl border border-border bg-background/40 p-3">
      <button
        onClick={onToggle}
        className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors ${
          installment.paid
            ? "border-success bg-success text-success-foreground"
            : "border-border hover:border-primary"
        }`}
      >
        {installment.paid && <Check className="h-3 w-3" />}
      </button>
      <button onClick={onEdit} className="flex-1 min-w-0 text-left">
        <div className="flex flex-wrap items-center gap-1.5">
          <p
            className={`truncate text-sm font-medium ${
              installment.paid ? "text-muted-foreground line-through" : ""
            }`}
          >
            {parent.description}
          </p>
          <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-semibold uppercase text-muted-foreground">
            {installment.number}/{installment.total}
          </span>
          {auto && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-primary">
              <Zap className="h-2.5 w-2.5" />
              Auto
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">venc. {formatDate(installment.dueDate)}</p>
      </button>
      <p className={`text-sm font-semibold ${tone}`}>{formatCurrency(installment.amount)}</p>
      <button
        onClick={onEdit}
        className="text-muted-foreground hover:text-primary"
        title="Editar parcela"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function InvestmentRow({ inv, onRemove }: { inv: Investment; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-background/40 p-3">
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary">
        <TrendingUp className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium capitalize">{inv.type}</p>
        <p className="text-[11px] text-muted-foreground">{inv.percentage}% rendimento</p>
      </div>
      <p className="text-sm font-semibold text-primary">{formatCurrency(inv.amount)}</p>
      <button onClick={onRemove} className="text-muted-foreground hover:text-destructive">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function SummaryPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "credit" | "debit" | "income" | "primary";
}) {
  const c =
    tone === "credit"
      ? "text-credit"
      : tone === "debit"
        ? "text-debit"
        : tone === "income"
          ? "text-success"
          : "text-primary";
  const Icon =
    tone === "income"
      ? ArrowUpRight
      : tone === "debit"
        ? ArrowDownRight
        : tone === "credit"
          ? CreditCard
          : TrendingUp;
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
    <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
      {text}
    </div>
  );
}
