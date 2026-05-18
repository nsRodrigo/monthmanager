# Plano: Alinhar lista de meses com a tela do mês

Arquivo único alterado: `src/routes/contas.$contaId.tsx`.

## Mudanças

### 1. Loop `monthsForYear.map((m) => ...)`
- Filtrar cartões visíveis no mês com `isCardVisibleInMonth(c, year, m)` antes de chamar `currentMonthSummary`, passando `visibleCardIds` e `visibleCards` em vez de `accountCardIds`/`accountCards` (que ignoram vigência).
- Calcular `totalIncome` via `getMonthIncomes(accountIncomes, installments, year, m)` somando `single + parcelled`.
- Calcular `totalDebits` via `getMonthDebits(accountDebits, installments, year, m)` somando `single + parcelled`.
- Calcular `totalInvested` via `getMonthInvestments(accountInvestments, year, m)`.
- `gastosTotais = totalDebits + totalInvested + sum.cardsTotal`.
- `monthBal = totalIncome - gastosTotais` (mantém semântica de balanço do mês coerente).

### 2. Mini-cards (renderização)
Substituir os três `<Mini>` por:
- `Receb.` → `totalIncome`
- `Gastos Totais` → `gastosTotais` (tone `debit`) — remove o card separado de "Faturas"
- Mantém o `Saldo em conta` na coluna lateral/linha mobile (já existente)

Grid passa de 3 colunas para 2 colunas (`grid-cols-2` com `divide-x`), já que viram só 2 mini-cards.

### 3. `monthlyBalances` (useMemo)
Reescrever para usar a mesma fórmula:
```
running = running + income - (totalDebits + cardsTotal + invested)
```
Com cartões filtrados por `isCardVisibleInMonth` e débitos/receitas calculados com `getMonthDebits`/`getMonthIncomes` (consistente com o loop visual).

### 4. Header (dashboard do topo)
Não alterar — escopo restrito à lista de meses, conforme pedido.

## Validação
- Build TS passa.
- Conferir visualmente que os valores de Receb., Gastos Totais e Saldo em Conta na lista batem com a tela do mês ao abrir o mês correspondente.
- Cartão criado no meio do ano não aparece somando faturas em meses anteriores à vigência.
