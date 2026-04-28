# Finance App Architecture (MonthManager)

App pessoal de gestão financeira mensal (contas, cartões, débitos, recebimentos, investimentos, parcelas). Stack: **TanStack Start + React 19 + Vite 7 + Tailwind v4 + Supabase (Lovable Cloud) + TanStack Query**.

Use esta skill como referência de verdade para qualquer mudança de feature, refactor de performance, mudança de schema, ou nova tela.

---

## 1. Stack & convenções globais

- **Framework**: TanStack Start (file-based routing em `src/routes/`). Roteamento com `createFileRoute`. NÃO usar react-router-dom nem `src/pages/`.
- **Data layer**: TanStack Query (`useQuery`, `useMutation`) com QueryClient criado por requisição em `src/router.tsx`. Provider em `src/routes/__root.tsx`.
- **Backend**: Supabase via `@/integrations/supabase/client`. Apenas SELECT/INSERT/UPDATE/DELETE diretos do client — **sem edge functions** neste projeto. RLS por `auth.uid() = user_id` em todas as tabelas.
- **Auth**: `src/store/auth.tsx` (`useAuth()`) — email/senha + Google. Sessão persistida em localStorage. NUNCA usar signups anônimos.
- **Estilo**: Tailwind v4 com tokens semânticos em `src/styles.css` (oklch). NUNCA cores diretas (`text-white`, `bg-black`) — sempre tokens (`bg-background`, `text-foreground`, `bg-primary`, etc.).
- **Mobile-first**: viewport alvo é 390x844 (iPhone). Sempre testar layouts nesse breakpoint primeiro.
- **PWA**: manifest em `public/manifest.webmanifest`, ícones `public/icon-*.png`. Theme color e favicon configurados em `src/routes/__root.tsx`.

---

## 2. Schema de dados (Supabase)

Todas as tabelas têm `user_id uuid not null` + RLS (`own X select/insert/update/delete` com `auth.uid() = user_id`). Datas são `date` (YYYY-MM-DD, **sem timezone** — ver §5).

| Tabela | Campos chave | Notas |
|---|---|---|
| `accounts` | `id, user_id, name, type, color, initial_balance` | Contas correntes/poupança/etc |
| `cards` | `id, user_id, account_id, name, color, due_day, closing_day` | Cartões pertencem a 1 conta |
| `purchases` | `id, user_id, card_id, description, total_amount, purchase_date, installments_count` | Compra do cartão (gera N installments) |
| `installments` | `id, user_id, parent_id, parent_type ('purchase'|'debit'|'income'), purchase_id, number, total, amount, due_date, year, month, paid` | **Tabela quente** — pode ter milhares de linhas. Chave: `year`/`month` são desnormalizados de `due_date` para filtrar rápido sem parsear data. |
| `debits` | `id, user_id, account_id, description, amount, date, required, paid, auto_debit, auto_debit_day, installments_count, is_parent` | Débitos avulsos ou parcelados (parcelado vira `is_parent=true` + N installments com `parent_type='debit'`) |
| `incomes` | `id, user_id, account_id, description, amount, date, received, installments_count, is_parent` | Mesmo padrão de debits |
| `investments` | `id, user_id, account_id, type, amount, percentage` | **Posições**, não eventos — não têm `date`. Aparecem em todo mês. |
| `card_payments` | `id, user_id, card_id, year, month, paid` | Marca fatura do cartão como paga (UPSERT com `onConflict: card_id,year,month`) |

### Regras de mês (CRÍTICO)
- **Débitos / recebimentos / investimentos**: o "mês" é o mês da `date` no fuso local (ver §5). Um débito em 01/01/2026 pertence a janeiro/2026.
- **Parcelas de cartão**: o "mês" é o mês da **fatura**, não da compra. `due_date`/`year`/`month` da installment já vêm calculados a partir do `closing_day`/`due_day` do cartão. Compras feitas após o fechamento entram na fatura seguinte.

---

## 3. Estrutura de arquivos

```
src/
├── router.tsx                # createRouter + QueryClient por request
├── routes/
│   ├── __root.tsx           # QueryClientProvider, AuthProvider, head/meta, PWA
│   ├── index.tsx            # Dashboard: lista de contas com mini-stats do mês
│   ├── auth.tsx             # Login/signup (email + Google)
│   ├── contas.$contaId.tsx  # Detalhe da conta: header com saldo + lista de meses
│   ├── contas.$contaId_.$ano.$mes.tsx              # Mês: accordions de débitos/recebimentos/investimentos/cartões
│   ├── contas.$contaId_.$ano.$mes_.cartao.$cartaoId.tsx  # Fatura do cartão (compras + parcelas)
│   ├── importar.tsx         # Importação simples
│   └── importar-historico.tsx
├── components/
│   ├── ui/                  # shadcn (button, dialog, input, etc.)
│   ├── Modal.tsx            # Modal customizado mobile-first
│   ├── AccountSelect.tsx
│   ├── ManageAccountsDialog.tsx
│   ├── Add{Card,Debit,Income,Investment,Purchase}Dialog.tsx
│   └── EditInstallmentDialog.tsx
├── store/
│   ├── auth.tsx             # useAuth() — sessão Supabase
│   ├── account-filter.tsx   # filtro global de conta no dashboard
│   └── finance.ts           # **TODO o data layer** (queries, mutations, derivations)
├── integrations/supabase/
│   ├── client.ts            # NÃO EDITAR — auto-gerado
│   └── types.ts             # NÃO EDITAR — auto-gerado
└── styles.css               # tokens oklch + tailwind v4
```

Roteamento dot-separated: `contas.$contaId.tsx` → `/contas/:contaId`. Underscore no fim (`$mes_`) força quebra de layout pai.

---

## 4. `src/store/finance.ts` — o coração do app

Único arquivo de data layer. Convenções:

### Queries
- Padrão: `useX()` retorna `useQuery` com `queryKey: ["nome", user?.id]` e `enabled: !!user`.
- Helper `fetchAllRows<T>(builder)` pagina automaticamente acima do limite de 1000 do Supabase.
- Hooks principais: `useAccounts`, `useCards`, `usePurchases`, `useInstallments`, `useDebits`, `useIncomes`, `useInvestments`, `useCardPaymentsMap`.

### Mutations — padrão **Optimistic Update** (CRÍTICO para UX)
Os toggles de "pago/recebido" e mudanças de campo de installment usam `onMutate`/`onError`/`onSettled` para que o checkbox responda instantaneamente sem esperar o roundtrip + refetch (que pode levar segundos por causa do tamanho das listas).

Template padrão:
```ts
export function useToggleX() {
  const inv = useInvalidate();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args) => { /* update no supabase */ },
    onMutate: async (args) => {
      await qc.cancelQueries({ queryKey: ["X"] });
      const prev = qc.getQueriesData<T[]>({ queryKey: ["X"] });
      qc.setQueriesData<T[]>({ queryKey: ["X"] }, (old) =>
        old ? old.map((it) => (it.id === args.id ? { ...it, ...patch } : it)) : old,
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      ctx?.prev?.forEach(([k, d]) => qc.setQueryData(k, d));
    },
    onSettled: () => inv(["X"]),
  });
}
```
Já aplicado em: `useUpdateInstallment`, `useToggleDebitPaid`, `useToggleIncomeReceived`, `useSetCardPaid`. **Replicar esse padrão em qualquer nova mutation que afete UI imediata.**

`useInvalidate()` faz invalidação por prefixo (`queryKey: [k]`), o que casa com qualquer `[k, userId]`.

### Builders
- `buildInstallments(parentId, parentType, userId, totalAmount, count, anchorDate)` — gera N parcelas mensais a partir de uma data âncora.
- `useShiftInstallmentDate` / `useAdvanceInstallments` — operações em lote sobre parcelas futuras.

### Derivações (cálculos)
- `computeAccountBalance(accountId, accounts, debits, incomes, installments, cardPayments)` — saldo atual de uma conta.
- `getMonthDebits/getMonthIncomes(items, year, month)` — filtro por mês usando **parse manual** de string (ver §5).
- Sempre usar essas funções em vez de recalcular nos componentes (memoizar com `useMemo` se necessário).

---

## 5. Datas — armadilha de timezone (CRÍTICO)

**NUNCA** use `new Date(d.date)` para datas vindas do Supabase (`type date`, formato `YYYY-MM-DD`). O JS interpreta como UTC meia-noite, e em fusos negativos (Brasil = UTC-3) a data "volta" um dia, jogando 01/01 em 31/12 do mês anterior.

**Sempre** parsear manualmente:
```ts
const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
// y = ano, m-1 = mês 0-indexado, d = dia
```

Helpers em `finance.ts`:
- `parseLocalDate(s)` → `{ y, m, d }` (m é 0-indexado)
- `fmtLocalDate(y, m, d)` → `"YYYY-MM-DD"` (m é 0-indexado)

Aplicado em `getMonthDebits`, `getMonthIncomes`, `useUpdateInstallment`, `useShiftInstallmentDate`.

---

## 6. UI patterns

- **Modal**: usar `src/components/Modal.tsx` para detalhes overlay (ex: stats da conta no header). Dialogs de formulário usam `Add*Dialog.tsx` (shadcn dialog).
- **Accordions de mês**: agrupam débitos/recebimentos/cartões. O header mostra total; clicar expande a lista. "Adicionar X" sempre **no final da lista** (consistência com débitos).
- **Mobile**: header da conta é compacto — saldo + botão "ver detalhes do mês" (abre modal com a grid completa). Não duplicar info entre BigSummary e accordions.
- **Tokens visuais**: cores semânticas em `src/styles.css`. Cor por conta/cartão vem do campo `color` da row (hex armazenado no banco — exceção legítima ao "no hex in components").

---

## 7. Performance — checklist

Sintomas de lentidão (ex: checkbox demora a marcar) geralmente vêm de:
1. **Falta de optimistic update** na mutation → adicionar `onMutate`/`onError`/`onSettled` (§4).
2. **Refetch de lista grande** (`installments` pode ter milhares) → garantir que `onSettled` invalide só o necessário, não tudo.
3. **Recalculo de derivações pesadas em cada render** → `useMemo` em componentes que chamam `computeAccountBalance` ou agrupadores por mês.
4. **Múltiplos `useQuery` independentes** disparando refetch em cascata → considerar consolidar.

NÃO criar APIs/edge functions para resolver lentidão de UI — Optimistic Update resolve. Edge functions só fazem sentido para lógica que não pode rodar no client (ex: chamar IA, webhooks, segredos).

---

## 8. Auth & RLS

- Toda tabela: 4 policies (`select/insert/update/delete`) com `auth.uid() = user_id`.
- Toda inserção precisa setar `user_id: user!.id` explicitamente (RLS bloqueia caso contrário).
- Roles de admin/permissão: usar tabela separada `user_roles` + função `has_role` SECURITY DEFINER (ver instruções globais). Hoje o app não tem roles — é single-user-per-account.

---

## 9. Quando adicionar feature nova

1. Schema novo? → migration via tool `supabase--migration`. Sempre RLS + policies.
2. Nova entity? → adicionar `useX()` query + `useAddX/useUpdateX/useRemoveX` mutations em `finance.ts` seguindo padrões §4.
3. Nova tela? → arquivo em `src/routes/` com `createFileRoute`. Sempre `errorComponent` + `notFoundComponent`. Mobile-first.
4. Mutação que afeta UI imediata (toggle, edit inline)? → **obrigatório** Optimistic Update.
5. Datas? → parse manual, nunca `new Date(string)`.

---

## 10. O que NÃO fazer

- ❌ Editar `src/integrations/supabase/{client,types}.ts`
- ❌ Edge functions para lógica que pode rodar no client com RLS
- ❌ `new Date("YYYY-MM-DD")` para campos `date`
- ❌ Cores hex/tailwind diretas em componentes (exceto `color` vindo do banco)
- ❌ Mutations sem optimistic update em UI interativa
- ❌ Roles na tabela `accounts` ou `profiles` (use `user_roles` separada)
- ❌ Anonymous signups
- ❌ Auto-confirm email signups (a menos que o usuário peça)
- ❌ Duplicar info na tela (header summary + accordion totals — escolher um)
