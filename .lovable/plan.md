## Mudanças em `src/routes/contas.$contaId_.$ano.$mes.tsx`

### 1. Lista interna de cada cartão (fix do reordenar ao desmarcar pago)
Hoje sort só por `dueDate` (linha 982). Como todas as parcelas do mês têm a mesma data, o desempate é instável e muda após o refetch do toggle.
**Fix**: sort por `(dueDate, purchaseId, number, id)` para ordem determinística.

### 2. Recebimentos e Débitos — ordem nova
Renderizar nesta ordem, dentro da mesma seção:

1. **Recorrentes** — itens de `monthDebits.single` / `monthIncomes.single` com `recurrenceGroupId`, ordenados por `date` asc.
2. **Parcelados** — `monthDebits.parcelled` / `monthIncomes.parcelled`, ordenados por `installment.dueDate` asc (desempate por `parentId`+`number`+`id`).
3. **À vista** — itens single sem `recurrenceGroupId`, ordenados por `date` asc.

Sem mexer em `getMonthDebits` / `getMonthIncomes` em `finance.ts` — só split/sort no componente.

### 3. Investimentos
Lista atual (`investments.map`) sem ordenação. Ordenar por `date` asc.

### Fora do escopo
- Lista interna do cartão não tem "recorrente/à vista" — só parcelas; o fix #1 já cobre.
- Cards (seção CARTÕES DE CRÉDITO): a ordem dos cartões em si não muda.