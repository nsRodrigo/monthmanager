# P0.1 — Separar Recorrência de Parcelamento

## Problema

Hoje, "recorrente" reusa o motor de `installments` (cria N filhos com `installmentsCount`/`isParent`), por isso:
- aparece como "x/y"
- abre modal de parcelas na edição
- cai em regras de installment (excluir uma parcela, anchor, etc.)

Recorrência e parcelamento são coisas diferentes e devem ter caminhos separados no store, na UI e nas regras de exclusão/edição.

## Modelo de dados (sem migração de schema)

Reaproveitar as tabelas atuais sem mudar SQL:

- **Parcelado** (`installment`): igual hoje — `installments_count > 1`, registros filhos em `installments`, parent com `is_parent=true`.
- **Recorrente** (`recurring`): cada mês é um registro **independente** em `debits`/`incomes` com:
  - `installments_count = 1`
  - `is_parent = false`
  - **Sem** linhas em `installments`
  - Marcado por convenção de descrição interna? Não — usamos um campo já existente: nenhum. Em vez disso, adicionamos uma coluna leve `recurrence_group_id uuid null` em `debits` e `incomes` (migração mínima) para agrupar a série e suportar "este e os próximos".
- **À vista** (`single`): `installments_count = 1`, sem `recurrence_group_id`.

A migração apenas adiciona a coluna `recurrence_group_id` em `debits` e `incomes` (nullable, indexada). Nada quebra para dados existentes.

## Mudanças no backend

1. Migração: `ALTER TABLE debits ADD COLUMN recurrence_group_id uuid;` + idem em `incomes` + index.
2. Atualizar `bulk_insert_finance` para aceitar/persistir `recurrence_group_id` (passthrough, opcional).

## Mudanças no store (`src/store/finance.ts`)

1. Tipos `Debit`/`Income` ganham `recurrenceGroupId?: string | null`.
2. Selects passam a incluir `recurrence_group_id`.
3. **Novo helper** `addRecurringSeries(kind, payload, monthsAhead)`:
   - Gera um `groupId = uuid()`.
   - Para cada mês de `[startMonth, lastOpenMonth]` (e default 24 meses), insere **um registro independente** em `debits`/`incomes` com `installments_count=1`, `is_parent=false`, `recurrence_group_id=groupId`. Sem tocar em `installments`.
4. `useAddDebit`/`useAddIncome`: separar branches:
   - se `recurring=true` → `addRecurringSeries`
   - se `installmentsCount>1` → fluxo atual de parcelado
   - senão → insert simples
   - Remover o atalho atual em `AddIncomeDialog` que faz `amount * 24` com `installmentsCount=24` (gambiarra que cria filhos de parcela).
5. **Novos hooks**:
   - `useUpdateRecurring({ id, scope: 'one'|'forward', patch })`
   - `useDeleteRecurring({ id, scope: 'one'|'forward' })`
   `forward` opera por `recurrence_group_id` + `date >= alvo.date`.
6. Geração ao **abrir novo mês**: localizar onde `addMonth` cria meses; após criar, chamar `replicateRecurringInto(year, month)` que faz `SELECT DISTINCT ON (recurrence_group_id) ... ORDER BY date DESC` para cada série ativa e insere uma cópia naquele mês (se ainda não existir naquele competence).

## Mudanças na UI

1. `AddDebitDialog` / `AddIncomeDialog`:
   - Checkbox "Recorrente" e "É parcelado" são **mutuamente exclusivos** (já são, manter).
   - Quando "Recorrente" marcado: ocultar todos os campos de parcela e o textinho "Parcela x/y". Modal mostra apenas Nome / Valor / Data / Recorrente / (Auto-débito p/ débito).
   - Submit recorrente NÃO envia `installmentsCount`/`installmentNumber`.
2. `EditInstallmentDialog`:
   - No abrir, detectar `recurrenceGroupId`. Se for recorrente → renderizar a variante simples "Editar lançamento" com campos básicos + radio "Apenas este / Este e próximos".
   - Caso contrário, comportamento atual de parcela.
3. Diálogo de exclusão:
   - Se recorrente, abrir um novo `DeleteRecurringDialog` com "Apenas este / Este e próximos / Cancelar".
   - Se parcelado, manter `DeleteParcelledDialog` atual.
   - Se à vista, confirm simples.
4. Renderização nas linhas de débito/recebimento: se `recurrenceGroupId` presente, **nunca** mostrar "x/y", nunca chamar regra de installment.

## Áreas que NÃO mudam

- Importação de planilha, backup, biometria, whitelist, dashboard, cartões/parcelados de crédito, investimentos não-recorrentes.
- Schema das tabelas (apenas adição de coluna nullable).

## Arquivos afetados

- `supabase/migrations/<novo>.sql` + atualização da função `bulk_insert_finance`
- `src/store/finance.ts` (tipos, selects, hooks novos, replicação ao criar mês)
- `src/components/AddDebitDialog.tsx`
- `src/components/AddIncomeDialog.tsx`
- `src/components/EditInstallmentDialog.tsx` (branch recorrente) **ou** novo `EditRecurringDialog.tsx`
- novo `src/components/DeleteRecurringDialog.tsx`
- `src/routes/contas.$contaId_.$ano.$mes.tsx` (chamadas dos diálogos + render sem x/y para recorrentes)
- `src/integrations/supabase/types.ts` (auto-regenerado pela migração)

## Validações que farei

- Criar débito recorrente → não há linhas em `installments`; aparece em todos os meses abertos a partir da data.
- Editar "Apenas este" muda só o registro da competência.
- Editar "Este e próximos" muda do registro escolhido para a frente, dentro do mesmo `recurrence_group_id`.
- Excluir "Apenas este" / "Este e próximos" idem.
- Abrir novo mês → série recorrente aparece automaticamente naquele mês.
- Parcelado de débito/recebimento e parcelado de cartão continuam idênticos (modal de parcelas, x/y, anchor).

## Risco / observação

Dados antigos onde "recorrente" foi salvo como `installments_count=24, is_parent=true` continuam tratados como parcelados (não há como adivinhar a intenção sem heurística). Para esses casos podemos oferecer no futuro um botão "converter em recorrente"; **fora do escopo desta tarefa**.

Confirma que posso seguir com esse plano? Em particular: (a) ok adicionar a coluna `recurrence_group_id` em `debits`/`incomes`? (b) ok manter os dados antigos como parcelados (sem migração automática)?
