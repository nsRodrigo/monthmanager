import { useEffect, useMemo, useState } from "react";
import { Plus, Copy, ArrowDownRight, ArrowUpRight, CreditCard, TrendingUp } from "lucide-react";
import { Modal, Field, inputClass, Select, PaidToggle, Accordion } from "./Modal";
import { CurrencyInputWithCalculator } from "./CurrencyInput";
import { CatalogDescriptionField } from "./CatalogDescriptionField";
import { FitLabel } from "./FitLabel";
import {
  useAddDebit,
  useAddIncome,
  useAddPurchase,
  useAddInvestment,
  useAddMirroredEntry,
  useCards,
  useCatalogItems,
  useUpsertCatalogItem,
  useCustomPaymentMethods,
  PAYMENT_METHOD_OPTIONS,
  normalizeCatalogName,
} from "@/store/finance";

export type EntryTab = "inc" | "deb" | "card" | "inv";
type PaymentType = "unico" | "parcelado" | "recorrente";
type PaymentMethod = "none" | (typeof PAYMENT_METHOD_OPTIONS)[number]["value"];
const incomePaymentMethods = PAYMENT_METHOD_OPTIONS.filter((o) => o.value !== "auto_debit");

const INV_TYPES = ["CDB", "Tesouro Direto", "Poupança", "Fundo", "Ações", "Cripto", "Outros"];

const TABS: { id: EntryTab; label: string; icon: typeof ArrowDownRight }[] = [
  { id: "inc", label: "Recebimento", icon: ArrowUpRight },
  { id: "deb", label: "Débito", icon: ArrowDownRight },
  { id: "card", label: "Cartão", icon: CreditCard },
  { id: "inv", label: "Investimento", icon: TrendingUp },
];

/**
 * Modal único de "Novo lançamento" — abas trocam o tipo (Recebimento, Débito,
 * Cartão, Investimento) sem fechar o modal; cabeçalho, abas e os botões do
 * rodapé ficam fixos (ver `subheader`/`footer`/`tall` em Modal). Sempre
 * lança na conta e no mês/ano da tela (`accountId`/`defaultYear`/
 * `defaultMonth`) — não existe campo de conta aqui.
 *
 * Em Débito/Recebimento, se a descrição escolhida for outra conta do app
 * (contas viram itens do catálogo — ver CatalogDescriptionField), o
 * lançamento é criado nas DUAS contas por `useAddMirroredEntry`: débito de
 * um lado, recebimento do outro, sempre no mesmo mês/ano.
 */
export function AddEntryDialog({
  open,
  onClose,
  defaultYear,
  defaultMonth,
  accountId,
  accountName,
  initialTab = "deb",
  onCreateCard,
}: {
  open: boolean;
  onClose: () => void;
  defaultYear: number;
  defaultMonth: number;
  accountId: string;
  accountName: string;
  initialTab?: EntryTab;
  /** Fecha este modal e abre o de criar cartão (aba Cartão, quando a conta ainda não tem nenhum). */
  onCreateCard?: () => void;
}) {
  const [tab, setTab] = useState<EntryTab>(initialTab);

  const addDebit = useAddDebit();
  const addIncome = useAddIncome();
  const addPurchase = useAddPurchase();
  const addInvestment = useAddInvestment();
  const addMirrored = useAddMirroredEntry();
  const upsertCatalogItem = useUpsertCatalogItem();
  const { data: cards = [] } = useCards();
  const { data: catalogItems = [] } = useCatalogItems();
  const { data: customPaymentMethods = [] } = useCustomPaymentMethods();
  const selectableCards = useMemo(
    () => cards.filter((c) => c.accountId === accountId),
    [cards, accountId],
  );

  const [description, setDescription] = useState("");
  const [invType, setInvType] = useState(INV_TYPES[0]);
  const [amount, setAmount] = useState(0);
  const [percentage, setPercentage] = useState("");
  const [date, setDate] = useState("");
  const [cardId, setCardId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("none");
  const [autoDebitDay, setAutoDebitDay] = useState("");
  const [paymentType, setPaymentType] = useState<PaymentType>("unico");
  const [mode, setMode] = useState<"total" | "perInstallment">("total");
  const [installments, setInstallments] = useState("2");
  const [installmentNumber, setInstallmentNumber] = useState("1");
  const [settled, setSettled] = useState(true);
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [notifyDaysBefore, setNotifyDaysBefore] = useState("");
  const [busy, setBusy] = useState(false);

  const resetFields = (preserveDescLike = false) => {
    setDate("");
    setCardId(selectableCards[0]?.id ?? "");
    setPaymentType("unico");
    setMode("total");
    setInstallments("2");
    setInstallmentNumber("1");
    setSettled(tab !== "inc");
    setNotifyEnabled(false);
    setNotifyDaysBefore("");
    setPaymentMethod("none");
    setAutoDebitDay("");
    if (!preserveDescLike) {
      setDescription("");
      setAmount(0);
      setPercentage("");
      setInvType(INV_TYPES[0]);
    }
  };

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      resetFields();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialTab, defaultYear, defaultMonth, accountId]);

  useEffect(() => {
    if (!open) return;
    setCardId(selectableCards[0]?.id ?? "");
    setSettled(tab !== "inc");
    if (tab !== "deb" && paymentMethod === "auto_debit") setPaymentMethod("none");
    if (tab !== "deb" && tab !== "inc" && paymentMethod !== "none") setPaymentMethod("none");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const autoDebit = tab === "deb" && paymentMethod === "auto_debit";
  const isInstallment = !autoDebit && paymentType === "parcelado";
  const isRecurring = !autoDebit && paymentType === "recorrente";
  const n = isInstallment ? Math.max(1, parseInt(installments) || 1) : 1;
  const cur = isInstallment ? Math.max(1, Math.min(n, parseInt(installmentNumber) || 1)) : 1;
  const total = mode === "perInstallment" && n > 1 ? (amount || 0) * n : amount || 0;
  const perInstallment = n > 0 ? total / n : 0;

  // Conta ligada: a descrição digitada bate com o item de catálogo de OUTRA
  // conta. Só se aplica a Débito/Recebimento — o produto continua um
  // produto comum nas outras abas.
  const mirrorTarget = useMemo(() => {
    if (tab !== "deb" && tab !== "inc") return null;
    const q = normalizeCatalogName(description);
    if (!q) return null;
    const item = catalogItems.find((i) => i.accountId && normalizeCatalogName(i.name) === q);
    return item?.accountId && item.accountId !== accountId ? item : null;
  }, [tab, description, catalogItems, accountId]);

  const isValid =
    tab === "inv"
      ? !!date && amount >= 0
      : tab === "card"
        ? description.trim() !== "" && !!date && !!cardId
        : description.trim() !== "" && !!date;

  const submit = async (after: "close" | "another" | "duplicate" = "close") => {
    if (!isValid || busy) return;
    setBusy(true);
    try {
      if (tab === "inv") {
        const totalAmount = mode === "perInstallment" && n > 1 ? amount * n : amount;
        await addInvestment.mutateAsync({
          accountId,
          type: invType,
          amount: totalAmount,
          percentage: Number(percentage) || 0,
          date,
          installmentsCount: n,
          installmentNumber: cur,
          recurring: isRecurring,
          referenceYear: defaultYear,
          referenceMonth: defaultMonth,
        });
      } else if (tab === "card") {
        const invoiceAnchorDate = `${defaultYear}-${String(defaultMonth + 1).padStart(2, "0")}-${String(
          Math.min(
            new Date(defaultYear, defaultMonth + 1, 0).getDate(),
            Number(date.slice(8, 10)) || 1,
          ),
        ).padStart(2, "0")}`;
        const totalAmount = mode === "perInstallment" && n > 1 ? amount * n : amount;
        await addPurchase.mutateAsync({
          cardId,
          description: description.trim(),
          totalAmount,
          date,
          installmentsCount: n,
          installmentNumber: cur,
          invoiceAnchorDate,
          recurring: isRecurring,
          paidNow: settled && !isInstallment,
          markCurrentPaid: settled && isInstallment,
          notifyDaysBefore:
            isRecurring && notifyEnabled ? Math.max(0, parseInt(notifyDaysBefore) || 0) : null,
        });
        upsertCatalogItem.mutate({ name: description.trim() });
      } else if (mirrorTarget) {
        const totalAmount = mode === "perInstallment" && n > 1 ? amount * n : amount;
        await addMirrored.mutateAsync({
          side: tab === "deb" ? "debit" : "income",
          accountId,
          accountName,
          targetAccountId: mirrorTarget.accountId!,
          description: description.trim(),
          amount: totalAmount,
          date,
          referenceYear: defaultYear,
          referenceMonth: defaultMonth,
          installmentsCount: n,
          installmentNumber: cur,
          recurring: isRecurring || autoDebit,
          paymentMethod: tab === "deb" && paymentMethod !== "none" ? paymentMethod : undefined,
          autoDebitDay:
            autoDebit && autoDebitDay ? Math.max(1, Math.min(31, parseInt(autoDebitDay))) : null,
          notifyDaysBefore:
            (isRecurring || autoDebit) && notifyEnabled
              ? Math.max(0, parseInt(notifyDaysBefore) || 0)
              : null,
          settled,
        });
      } else if (tab === "deb") {
        const totalAmount = mode === "perInstallment" && n > 1 ? amount * n : amount;
        await addDebit.mutateAsync({
          accountId,
          description: description.trim(),
          amount: totalAmount,
          date,
          required: isRecurring,
          paymentMethod: paymentMethod === "none" ? null : paymentMethod,
          autoDebitDay:
            autoDebit && autoDebitDay ? Math.max(1, Math.min(31, parseInt(autoDebitDay))) : null,
          installmentsCount: n,
          installmentNumber: cur,
          referenceYear: defaultYear,
          referenceMonth: defaultMonth,
          paidNow: settled && !isInstallment,
          markCurrentPaid: settled && isInstallment,
          notifyDaysBefore:
            !isInstallment && notifyEnabled ? Math.max(0, parseInt(notifyDaysBefore) || 0) : null,
        });
        upsertCatalogItem.mutate({ name: description.trim() });
      } else {
        const totalAmount = mode === "perInstallment" && n > 1 ? amount * n : amount;
        await addIncome.mutateAsync({
          accountId,
          description: description.trim(),
          amount: totalAmount,
          date,
          installmentsCount: n,
          installmentNumber: cur,
          recurring: isRecurring,
          referenceYear: defaultYear,
          referenceMonth: defaultMonth,
          receivedNow: settled && !isInstallment,
          markCurrentPaid: settled && isInstallment,
          notifyDaysBefore:
            !isInstallment && notifyEnabled ? Math.max(0, parseInt(notifyDaysBefore) || 0) : null,
          paymentMethod: paymentMethod === "none" ? null : paymentMethod,
        });
        upsertCatalogItem.mutate({ name: description.trim() });
      }
      if (after === "another") resetFields();
      else if (after === "close") onClose();
    } finally {
      setBusy(false);
    }
  };

  const tabDef = TABS.find((t) => t.id === tab)!;
  const noun =
    tab === "inc"
      ? "Recebimento"
      : tab === "deb"
        ? "Débito"
        : tab === "card"
          ? "Compra"
          : "Investimento";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo lançamento"
      tall
      headerRight={
        tab !== "inv" ? (
          <PaidToggle
            checked={settled}
            onChange={setSettled}
            offLabel={tab === "inc" ? "Marcar recebido" : "Marcar pago"}
            onLabel={tab === "inc" ? "Recebido" : "Pago"}
          />
        ) : undefined
      }
      subheader={
        <div className="grid grid-cols-4 gap-1.5" role="tablist" aria-label="Tipo de lançamento">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-[11.5px] font-semibold transition-colors ${
                  active
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-transparent bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon
                  className={`h-[18px] w-[18px] ${active ? "text-primary" : "text-muted-foreground"}`}
                />
                <FitLabel text={t.label} />
              </button>
            );
          })}
        </div>
      }
      footer={
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border bg-background py-2.5 text-sm font-semibold hover:bg-secondary"
          >
            Cancelar
          </button>
          <button
            onClick={() => submit("close")}
            disabled={busy || !isValid}
            className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Salvando…" : "Adicionar"}
          </button>
          <button
            type="button"
            onClick={() => submit("another")}
            disabled={busy || !isValid}
            title={`Salvar e adicionar outro ${noun.toLowerCase()} (limpa os campos)`}
            aria-label={`Salvar e adicionar outro ${noun.toLowerCase()}`}
            className="inline-flex items-center justify-center rounded-lg bg-orange-700 px-3 py-2.5 text-white hover:bg-orange-800 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => submit("duplicate")}
            disabled={busy || !isValid}
            title="Salvar e duplicar (mantém os campos preenchidos)"
            aria-label={`Salvar e duplicar este ${noun.toLowerCase()}`}
            className="inline-flex items-center justify-center rounded-lg bg-secondary px-3 py-2.5 text-foreground hover:bg-secondary/70 disabled:opacity-50"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Entra em <span className="font-semibold text-foreground">{accountName}</span>, mês de{" "}
          <span className="font-semibold text-foreground">
            {new Date(defaultYear, defaultMonth, 1).toLocaleDateString("pt-BR", {
              month: "long",
              year: "numeric",
            })}
          </span>
          . A data abaixo é só referência.
        </p>

        {tab === "inv" ? (
          <>
            <Field label="Tipo">
              <Select
                className={inputClass}
                value={invType}
                onChange={(e) => setInvType(e.target.value)}
              >
                {INV_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label={
                  mode === "perInstallment" && isInstallment
                    ? "Valor por parcela"
                    : "Valor aplicado"
                }
              >
                <CurrencyInputWithCalculator
                  value={amount}
                  onValueChange={setAmount}
                  allowNegative
                />
              </Field>
              <Field label="Rendimento (% a.a.)">
                <input
                  type="number"
                  step="0.01"
                  className={inputClass}
                  value={percentage}
                  onChange={(e) => setPercentage(e.target.value)}
                  placeholder="0"
                />
              </Field>
            </div>
            <Field label="Data">
              <input
                type="date"
                className={inputClass}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
          </>
        ) : (
          <>
            <Field label="Descrição">
              <CatalogDescriptionField
                value={description}
                onChange={setDescription}
                placeholder={
                  tab === "card"
                    ? "Ex: Tênis novo"
                    : tab === "inc"
                      ? "Ex: Salário, freelance"
                      : "Ex: IPVA, aluguel"
                }
                includeAccounts={tab === "deb" || tab === "inc"}
                excludeAccountId={accountId}
              />
            </Field>

            {tab === "card" && (
              <Field label="Cartão">
                {selectableCards.length === 0 ? (
                  <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
                    <p className="text-xs text-muted-foreground">
                      Esta conta não tem cartão cadastrado.
                    </p>
                    {onCreateCard && (
                      <button
                        type="button"
                        onClick={onCreateCard}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        + Criar cartão nesta conta
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <Select
                      className={inputClass}
                      value={cardId}
                      onChange={(e) => setCardId(e.target.value)}
                    >
                      {selectableCards.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                    {onCreateCard && (
                      <button
                        type="button"
                        onClick={onCreateCard}
                        className="mt-1.5 text-xs font-semibold text-primary hover:underline"
                      >
                        + Criar outro cartão nesta conta
                      </button>
                    )}
                  </>
                )}
              </Field>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field
                label={
                  mode === "perInstallment" && isInstallment ? "Valor por parcela" : "Valor total"
                }
              >
                <CurrencyInputWithCalculator
                  value={amount}
                  onValueChange={setAmount}
                  allowNegative
                />
              </Field>
              <Field label="Data da compra">
                <input
                  type="date"
                  className={inputClass}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
            </div>

            {mirrorTarget && (
              <div className="space-y-1.5 rounded-lg border border-primary/25 bg-primary/[0.06] p-3 text-xs">
                <p className="font-semibold text-foreground">Transferência entre contas</p>
                <p className="text-muted-foreground">
                  Cria um débito de {accountName} e um recebimento em {mirrorTarget.name} (ou o
                  contrário, se esta for um recebimento) — sempre no mesmo mês. Editar, marcar como
                  pago ou excluir um dos lados repete no outro.
                </p>
              </div>
            )}

            {(tab === "deb" || tab === "inc") && (
              <div className="space-y-2">
                <span className="block text-xs font-medium text-muted-foreground">
                  Meio de pagamento
                </span>
                <Select
                  className={inputClass}
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                >
                  <option value="none">Nenhum</option>
                  {(tab === "deb" ? PAYMENT_METHOD_OPTIONS : incomePaymentMethods).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                  {customPaymentMethods.length > 0 && (
                    <optgroup label="Personalizados">
                      {customPaymentMethods.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </Select>

                {autoDebit && (
                  <div className="rounded-lg border border-border bg-background/50 p-3">
                    <Field label="Dia do débito (1-31)">
                      <input
                        type="number"
                        min="1"
                        max="31"
                        className={inputClass}
                        value={autoDebitDay}
                        onChange={(e) => setAutoDebitDay(e.target.value)}
                        placeholder="Ex: 10"
                      />
                    </Field>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Replicado automaticamente todo mês, até o último mês que já existe nesta conta
                      — e continua acompanhando conforme a conta cresce.
                      {mirrorTarget && " O espelho na outra conta acompanha junto."}
                    </p>
                  </div>
                )}
              </div>
            )}

            {!autoDebit && (
              <div className="space-y-2">
                <span className="block text-xs font-medium text-muted-foreground">
                  Tipo de pagamento
                </span>
                <Select
                  className={inputClass}
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value as PaymentType)}
                >
                  <option value="unico">À Vista</option>
                  <option value="parcelado">Parcelado</option>
                  <option value="recorrente">
                    {tab === "inc"
                      ? "Recebível recorrente"
                      : tab === "card"
                        ? "Compra recorrente"
                        : "Recorrente"}
                  </option>
                </Select>

                {isInstallment && (
                  <div className="space-y-3 rounded-lg border border-border bg-background/50 p-3">
                    <div className="flex gap-1 rounded-full bg-secondary p-1">
                      <button
                        type="button"
                        onClick={() => setMode("total")}
                        className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${mode === "total" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                      >
                        Valor total
                      </button>
                      <button
                        type="button"
                        onClick={() => setMode("perInstallment")}
                        className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${mode === "perInstallment" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                      >
                        Valor por parcela
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Total de parcelas">
                        <input
                          type="number"
                          min="2"
                          max="60"
                          className={inputClass}
                          value={installments}
                          onChange={(e) => setInstallments(e.target.value)}
                        />
                      </Field>
                      <Field label="Parcela atual">
                        <input
                          type="number"
                          min="1"
                          max={n}
                          className={inputClass}
                          value={installmentNumber}
                          onChange={(e) => setInstallmentNumber(e.target.value)}
                        />
                      </Field>
                    </div>
                    {amount > 0 && n > 1 && (
                      <p className="text-xs text-muted-foreground">
                        {n}x de{" "}
                        <span className="font-semibold text-foreground">
                          R$ {perInstallment.toFixed(2).replace(".", ",")}
                        </span>{" "}
                        · total{" "}
                        <span className="font-semibold text-foreground">
                          R$ {total.toFixed(2).replace(".", ",")}
                        </span>
                        <br />
                        Esta é a parcela{" "}
                        <span className="font-semibold text-foreground">
                          {cur}/{n}
                        </span>
                        .
                        {cur > 1 && ` ${cur - 1} parcela(s) anterior(es) serão criadas como pagas.`}
                        {mirrorTarget && " Todas as parcelas também são criadas do outro lado."}
                      </p>
                    )}
                  </div>
                )}

                {isRecurring && (
                  <p className="rounded-lg border border-border bg-background/50 p-3 text-[11px] text-muted-foreground">
                    Replicado automaticamente todo mês, até o último mês que já existe nesta conta —
                    e continua acompanhando conforme a conta cresce. Cada mês é independente e pode
                    ser editado ou excluído sem afetar os demais.
                    {mirrorTarget && " O espelho na outra conta acompanha junto, mês a mês."}
                  </p>
                )}
              </div>
            )}

            {(isRecurring || autoDebit) && (
              <Accordion
                open={notifyEnabled}
                onOpenChange={(v) => {
                  setNotifyEnabled(v);
                  if (v && !notifyDaysBefore) setNotifyDaysBefore("1");
                }}
                label="Notificar antes do vencimento"
              >
                <Field label="Quantos dias antes?">
                  <input
                    type="number"
                    min={0}
                    max={30}
                    className={inputClass}
                    value={notifyDaysBefore}
                    onChange={(e) => setNotifyDaysBefore(e.target.value)}
                  />
                </Field>
              </Accordion>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
