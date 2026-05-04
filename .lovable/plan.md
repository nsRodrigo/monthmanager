
## Resumo

Refatoração focada em corrigir regras financeiras (parcela atual configurável, saldo em conta por mês), melhorar UX em mobile, garantir atualização imediata das listas após criação e otimizar performance — sem quebrar importação, regras existentes ou histórico.

---

## 1. Parcela atual configurável (regra crítica)

**Comportamento novo nos diálogos `AddPurchaseDialog`, `AddDebitDialog`, `AddIncomeDialog`** quando "É parcelado" estiver marcado:

- Adicionar campo obrigatório **"Parcela atual"** (1..N) ao lado de "Número de parcelas".
- Default = 1 (mantém comportamento atual).
- Texto explicativo dinâmico: "Parcela 5/10 cai em <mês selecionado>. Serão criadas 1..4 nos meses anteriores e 6..10 nos próximos."

**Lógica em `src/store/finance.ts`:**

- Crédito (`useAddPurchase`): quando `installmentNumber > 1`, deixar de chamar `buildInstallmentsForPurchase` e usar `buildInstallmentsAnchored` (já existe e gera passado + futuro corretamente, marca anteriores como `paid: true`).
- Débito (`useAddDebit`) e recebimento (`useAddIncome`): hoje só chamam `buildInstallments` que sempre começa em `startDate`. Criar nova função `buildInstallmentsAnchoredGeneric(parentId, parentType, userId, totalAmount, count, anchorNumber, anchorDate, paidPast)` análoga a `buildInstallmentsAnchored` mas paramétrica em `parent_type`. Usar quando `installmentNumber > 1`.
- Para débitos passados anteriores marcar `paid = true`; para recebimentos passados anteriores marcar `paid = true` (= recebido).

**Edição de parcela:** já existe `EditInstallmentDialog` + `useShiftInstallmentDate({applyToFuture})`. Garantir que o diálogo apresenta as opções "Editar só esta" / "Editar esta e as próximas" claramente (já implementado para data; estender para valor — atualizar valor de todas as próximas com mesma diferença ou novo valor, decisão: aplicar mesmo valor às próximas).

---

## 2. Saldo em conta por mês (nova métrica)

**Conceito:**

```text
saldoEmConta(M) = saldoEmConta(M-1)
               + recebimentos(M)
               - débitos(M)
               - faturas crédito(M)
               - investimentos(M)   (entrada de aporte = saída da conta)
```

Distinto de **balanço(M) = recebimentos(M) - despesas(M)** que continua existindo.

**Implementação:**

- Em `src/store/finance.ts` adicionar `computeMonthlyAccountBalance(account, cards, purchases, installments, debits, incomes, investments): Map<"YYYY-M", { saldoEmConta, balanco, recebimentos, debitos, faturas, investido }>` que itera cronologicamente partindo de `account.initialBalance`, agregando todos os meses que têm movimentação. Considera **todos** os lançamentos do mês (independente de pagos), pois a métrica é "saldo previsto/real ao final do mês".
- Em `src/routes/contas.$contaId.tsx` (lista de meses), exibir tanto **Balanço** (já mostrado) quanto **Saldo em conta** ao lado, ambos com cor por sinal. Em mobile (<480px), empilhar verticalmente.
- Adicionar um pequeno badge no canto superior direito do card mensal com "Saldo: R$ X" e manter "Balanço" abaixo.

---

## 3. Responsividade mobile

**Tailwind breakpoint customizado:** adicionar `xs: 480px` em `src/styles.css` (`@theme` block).

- Trocar label "Movimentado:" por "Mov:" em telas `<xs`. Implementar via `<span className="xs:hidden">Mov:</span><span className="hidden xs:inline">Movimentado:</span>` em `contas.$contaId.tsx`.
- Aplicar mesma técnica para "A receber"→"Recb", "A pagar"→"Pagar", "Faturas"→"Fatura", "Previsto"→"Prev" em `MiniStat` (props opcionais `shortLabel`).
- Reduzir paddings e tamanho de fonte em `<sm` no header da conta e cards de meses.

---

## 4. Bug — itens não aparecem na lista após adicionar

**Causas identificadas:**

- `useAddPurchase`, `useAddDebit`, `useAddIncome`, `useAddInvestment` invalidam apenas as chaves de topo (ex.: `["purchases"]`), mas as queries são chaveadas por `["purchases", user.id]` — `invalidateQueries({ queryKey: ["purchases"] })` faz prefix match e funciona, **porém** o `mutateAsync` no diálogo fecha antes do `onSuccess` em alguns fluxos.
- Mais crítico: para débitos/recebimentos parcelados, `installments` é invalidado mas a chave do React Query do `useDebits` que renderiza a lista pode ainda estar `staleTime` longo.

**Fix:**

- Em todos os `useAdd*`/`useImport*`: trocar `onSuccess` por `onSettled` e usar `await qc.invalidateQueries(...)` com `refetchType: "active"` para garantir refetch imediato.
- Adicionar `staleTime: 0` ou setar default global em `QueryClient` (`src/router.tsx` / provider) — verificar atual antes de mexer.
- Nos diálogos, o `await mutateAsync` já espera; garantir que o `onClose()` ocorre **depois** do `await`. Já é o caso. O ponto chave é o invalidate síncrono.
- Adicionar update otimista para `useAddDebit`/`useAddIncome`/`useAddInvestment`/`useAddPurchase` (push do novo item no cache via `setQueryData`) para feedback instantâneo.

---

## 5. Performance

- **Memoização de selectors mensais:** `getMonthInstallments`, `getMonthDebits`, `getMonthIncomes` são chamadas múltiplas vezes por render no `index.tsx` (1 por conta × 4 stats). Indexar:
  - Em `useInstallments` derivar `installmentsByYM = Map<"y-m", Installment[]>` via `useMemo` num hook `useInstallmentsIndex()`.
  - Mesmo para debits/incomes/investments.
- **Reduzir N+1 em `index.tsx`:** loop por conta refaz `getMonthDebits`/`getMonthIncomes` filtrando por todos os installments. Pré-computar uma vez `installmentsByParent`/`debitsByAccount` e reutilizar.
- **Memo nos componentes de linha** (`MiniStat`, item de cartão/débito/recebimento) com `React.memo` + props estáveis.
- **Virtualização** (apenas se lista de parcelas > 100 itens): adicionar `@tanstack/react-virtual` na lista de transações dentro de `contas.$contaId_.$ano.$mes.tsx`. Avaliar pós-medição — incluir lib só se necessário.
- **Query staleTime razoável:** definir `staleTime: 30_000` por padrão para queries de leitura; manter invalidate explícito nas mutations.

---

## 6. Detalhes técnicos

**Arquivos a editar:**

- `src/store/finance.ts` — nova função `buildInstallmentsAnchoredGeneric`, `computeMonthlyAccountBalance`; ajuste em `useAddPurchase`/`useAddDebit`/`useAddIncome` para aceitar `installmentNumber`; otimistic updates; `onSettled` + `refetchType: "active"`.
- `src/components/AddPurchaseDialog.tsx`, `AddDebitDialog.tsx`, `AddIncomeDialog.tsx` — campo "Parcela atual".
- `src/components/EditInstallmentDialog.tsx` — opção "Aplicar valor às próximas".
- `src/routes/contas.$contaId.tsx` — coluna "Saldo em conta" + responsividade ("Mov:").
- `src/routes/index.tsx` — usar índices memoizados; labels curtas em xs.
- `src/styles.css` — breakpoint `xs: 480px`.
- `src/router.tsx` (ou onde QueryClient é criado) — `defaultOptions.queries.staleTime`.

**Compatibilidade:**

- Importação CSV/XLSX (`useImportPurchases`, `useImportHistorical`) **não muda** — já usam `buildInstallmentsAnchored` corretamente.
- Regras de fatura (closingDay/dueDay) preservadas: o "Parcela atual" é opcional; quando = 1 ou ausente, comportamento idêntico ao atual.
- Histórico e múltiplas contas intactos.

---

## 7. Validação

1. Criar compra parcelada 5/10 em maio/2026 → verificar parcelas 1..4 (passadas, marcadas pagas) e 6..10 (futuras) geradas.
2. Criar débito/recebimento parcelado com `installmentNumber > 1` — mesma verificação.
3. Calcular saldo em conta jan→dez e conferir progressão.
4. Em viewport 375×812 confirmar "Mov:" e labels curtas.
5. Após adicionar item, listar imediatamente sem refresh.
6. Profile com >2000 parcelas: verificar tempo de render do home <200ms.
