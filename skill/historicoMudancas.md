# Histórico de Mudanças — monthmanager

> Este arquivo existe para dar contexto a uma IA (ou a você) numa sessão
> futura. Se aparecer um bug relacionado a parcelamento, recorrência,
> navegação de mês ou exclusão de lançamentos, comece por aqui antes de
> vasculhar o código do zero.

---

## v1 — 2026-07-26 — Âncora de mês pela PÁGINA + gerenciamento de parcelas

**Origem:** `prompt/prompt-nova-sessao-merge.txt` (spec completa da tarefa,
mantida no repo para referência do pedido original).

### Regra de negócio central introduzida/reforçada

A data digitada pelo usuário é **apenas referência visual**. Ela NUNCA
define em que mês um lançamento aparece:

- **Avulso** (débito/recebimento simples): mês da PÁGINA onde o usuário
  estava ao criar.
- **Parcelado**: mês da PÁGINA ancora a parcela atual sendo criada; as
  anteriores caem em meses anteriores, as seguintes em meses posteriores.
- **Recorrente/débito automático**: mês da PÁGINA é o primeiro da série;
  os seguintes são gerados em sequência a partir dele.
- **Editar a data de um lançamento existente NUNCA move ele de mês.** A
  data é só corrigida visualmente.

Se um bug aparecer do tipo "criei em Março mas apareceu em Abril", ou
"editei a data e o lançamento sumiu do mês", comece verificando se essa
regra foi respeitada no ponto do código envolvido.

### Arquivos alterados

#### `src/store/finance.ts`
- **Nova função `buildRecurringMonthDates(anchorDateIso, months, startOffset)`**
  — gera a lista de `{dateStr, year, month}` para séries recorrentes,
  preservando o dia do mês (com clamp para meses mais curtos). Substituiu
  o loop manual que existia duplicado dentro de `useAddDebit` e
  `useAddIncome`.
- **`useAddDebit`** (bloco `count > 1`): antes ancorava as parcelas na
  data digitada (`d.date`); agora ancora em `refYear`/`refMonth` (mês da
  página), mantendo apenas o dia da data digitada (com clamp para o
  último dia do mês âncora).
- **`useAddDebit`** (bloco `isRecurring`): agora usa
  `buildRecurringMonthDates(d.date, d.recurrenceMonths ?? 24, 1)` em vez
  do loop manual antigo. `startOffset = 1` porque o registro do mês
  corrente já foi inserido como `baseRow` antes desse bloco.
- **`useAddIncome`**: mesmas duas correções, espelhadas para incomes.
- **Nova mutation `useChangeInstallmentSeries`** — generaliza
  `useChangePurchaseInstallments` (que **não foi removida**, pode ter
  outros usos) para funcionar com `purchase | debit | income`. Apaga as
  installments antigas, atualiza `installments_count` +
  `total_amount`/`amount` no parent, recria via `buildInstallmentsAnchored`
  ancorado na data da 1ª parcela existente (`firstDue`).
  - ⚠️ Ponto de atenção de TypeScript: a primeira versão tentava fazer
    `.update({ installments_count, [amountField]: total })` com
    `amountField` dinâmico e `table` também dinâmico
    (`"purchases"|"debits"|"incomes"`). O supabase-js rejeita chave
    computada nesse cenário (`RejectExcessProperties`). A correção foi
    trocar por um `if/else if/else` explícito por tabela, cada um com
    objeto literal tipado. Se for mexer nessa função de novo, **não
    volte a usar chave computada no `.update()`**.
- **Nova mutation `useRenumberInstallment`** — move uma parcela
  específica para outra posição na série (`oldNumber` → `newNumber`),
  preservando a "vaga de mês" (due_date/year/month) de cada posição
  original. Tem flag `includePrevious` para também deslocar as parcelas
  anteriores à que está sendo movida.
- **`resolveScopeMonths`** passou de função interna (`function`) para
  **exportada** (`export function`) — usada agora também na rota de
  conta/mês para validar exclusões de lançamentos avulsos.

#### `src/components/EditInstallmentDialog.tsx`
- Importa e instancia `useChangeInstallmentSeries` e
  `useRenumberInstallment` (removeu o uso de `useChangePurchaseInstallments`
  nesse componente — a função em si continua existindo em `finance.ts`).
- Novo estado `newCurrentNumber` (inicializado com `String(installment.number)`
  sempre que o modal abre) e `recreateMode: "recalculate" | "keepPerInstallment"`.
- **Removida** a restrição `inst.parentType === "purchase"` no botão
  "Alterar parcelamento" — agora aparece para débito e recebimento
  parcelados também. `canManage` virou sempre `true`.
- View **"change"** foi totalmente reescrita em duas seções dentro do
  mesmo modal:
  1. **Recriar parcelamento** — campos Nº parcelas + Valor total, com
     toggle entre "Recalcular valor por parcela" (mantém o total, você
     edita o total livremente) e "Manter valor por parcela" (o valor
     atual da parcela fica fixo, o total é `valorAtual × novoN`, campo
     de total fica somente leitura). Chama `changeInstSeries`.
  2. **Renumerar parcela** — campo "Parcela atual" (`newCurrentNumber`).
     Botão "Aplicar só a renumeração" faz 2 confirms em sequência
     (confirma a mudança → pergunta se inclui parcelas anteriores) antes
     de chamar `renumberInstallment`. Fica desabilitado se o número não
     mudou.
  - As duas seções são separadas por um divisor visual com o label
    "Renumerar".

#### `src/components/MonthYearPicker.tsx`
- As setas `<`/`>` (mês anterior/próximo) agora ficam **desabilitadas**
  quando o mês adjacente não tem nenhum lançamento
  (`prevHasData`/`nextHasData`, calculados a partir do `yearMonthMap`
  já existente). Classe `disabled:opacity-40 disabled:pointer-events-none`.
- O cálculo de `yearMonthMap` para débitos/recebimentos avulsos agora
  prioriza `referenceYear`/`referenceMonth` (quando não são `null`) em
  vez de fazer parse do campo `date`. Isso é importante: **um lançamento
  pode ter uma data digitada de um mês, mas pertencer a outro mês** (ver
  regra de negócio no topo) — usar só `date` faria o picker mostrar o
  mês errado como "tendo dado".

#### `src/routes/contas.$contaId_.$ano.$mes.tsx`
- Importa `resolveScopeMonths` de `finance.ts`.
- **`askDeleteSingle` reescrita**: agora recebe também `date`, calcula os
  meses-alvo do escopo escolhido via `resolveScopeMonths(scope, year, month)`
  e só executa a exclusão se o mês do item (`iy`/`im-1`) estiver dentro
  desse escopo. Passou a chamar diretamente `removeDebit`/`removeIncome`/
  `removePurchase` em vez de `deleteParcelledScoped` (que é para séries
  parceladas, não para um avulso único).
- **`onRemove` do `DebitRow`** ganhou um ramo intermediário: se
  `d.autoDebit` (e não for recorrente), abre `askDeleteSingle` em vez do
  confirm simples direto. Fluxo final:
  `isRecurring → askDeleteRecurring` / `autoDebit → askDeleteSingle` /
  senão → confirm simples + `removeDebit.mutate`.
- **Tag "PAR"** nas linhas parceladas (`ParcelledRow`): estava sendo
  renderizada ao lado da descrição; foi **realocada** para o mesmo
  container flex da tag de número (`N/total`), aparecendo antes dela —
  como pedido na spec. (Não foi duplicada, apenas movida.)
- **Botão "revisado" dos itens de cartão** (`PurchaseInstRow`): era um
  quadradinho de checkbox (`h-4 w-4`, ícone `Check` sem texto). Virou
  pill de texto igual ao padrão usado em débitos/recebimentos:
  "Validado" (verde, com ícone) / "Não validado" (cinza).
- **NÃO precisou mexer**: ordenação padrão de débitos/recebimentos
  (recorrentes + auto-débito + parcelados mesclados por data, à-vista
  por último) e o botão de "Marcar recebido" em massa na seção de
  Recebimentos — **ambos já estavam implementados corretamente** antes
  desta sessão, batendo com a spec sem alteração.

#### `src/components/AddIncomeDialog.tsx`
- Único ajuste necessário: label do checkbox de recorrência trocado de
  "Recorrente" para **"Recebível recorrente"**.

#### `src/components/AddDebitDialog.tsx` e `src/components/AddPurchaseDialog.tsx`
- **Nenhuma alteração** — já tinham o campo "Repetir por quantos meses?"
  e já passavam `referenceYear`/`referenceMonth` (débito) ou
  `invoiceAnchorDate`/`recurrenceMonths` (compra) corretamente.
  - Nota sobre `Purchase`: o tipo `Purchase` em `finance.ts` **não tem**
    `referenceYear`/`referenceMonth` (só existe em `Debit`/`Income`). A
    âncora de mês para compras recorrentes é feita via
    `invoiceAnchorDate` (calculado a partir de `defaultYear`/`defaultMonth`
    quando o dialog é aberto dentro de um cartão específico) + o
    `year`/`month` gravado em cada installment gerada. Isso já satisfaz a
    regra de negócio sem precisar de coluna nova — **não crie
    `reference_year`/`reference_month` em `purchases` sem necessidade
    real**, o mecanismo atual já resolve o caso.

### Ambiente / observação não-funcional
- O `node_modules` não estava instalado no ambiente usado para validar
  esta mudança; foi rodado `npm install`, o que **regenerou o
  `package-lock.json`** (diff grande, ~6800 linhas) só para sincronizar
  com dependências que já estavam em `package.json` mas nunca tinham
  gerado lockfile atualizado. Isso é esperado, não é regressão de
  funcionalidade — mas se aparecer um diff gigante em `package-lock.json`
  sem relação com o bug investigado, a causa provável é essa.

### Verificação feita
- `npx tsc --noEmit` rodou limpo (0 erros) ao final.
- Nenhum commit foi feito — mudanças ficaram só no working tree, para o
  usuário testar localmente antes de decidir commitar.
- **Não testado manualmente no browser** (fluxos de UI dos dois modais
  novos — "Recriar parcelamento"/"Renumerar parcela" no
  `EditInstallmentDialog`, travamento das setas no `MonthYearPicker`,
  exclusão de débito automático). Se um bug aparecer nessas telas, esse
  é o primeiro lugar a olhar com atenção, pois só foi validado por
  leitura de código + typecheck.

### Onde procurar primeiro, por sintoma

| Sintoma | Onde olhar |
|---|---|
| Parcelado/recorrente aparece no mês errado ao criar | `useAddDebit`/`useAddIncome` em `finance.ts` (bloco de âncora `refYear/refMonth`) |
| Recorrência não gera todos os meses / dia errado | `buildRecurringMonthDates` |
| "Alterar parcelamento" com valor/total errado | `useChangeInstallmentSeries` + os dois sub-modos em `EditInstallmentDialog.tsx` |
| Renumerar parcela bagunça datas de outras parcelas | `useRenumberInstallment` (mapa `dateByOldNumber`/`nextNumber`) |
| Seta do MonthYearPicker não trava ou trava errado | `prevHasData`/`nextHasData` e `yearMonthMap` em `MonthYearPicker.tsx` |
| Excluir débito automático apaga o mês errado / não pede escopo | `askDeleteSingle` + `resolveScopeMonths` em `contas.$contaId_.$ano.$mes.tsx` |
| Tag PAR ou "Validado/Não validado" sumiu ou duplicou | `ParcelledRow` / `PurchaseInstRow` no mesmo arquivo de rota |

---

## v2 — 2026-07-26 — Tags/UI, unificação do modal recorrente de cartão e correção real da renumeração

**Origem:** `prompt/prompt-2.txt` — lista de bugs encontrados testando o v1 (tags,
nomenclatura, ordenação, modal de recorrente de cartão diferente do de débito,
checkbox menor, e principalmente "a renumeração das parcelas não está
funcionando", com uma spec extensa de cenários A/P/R para validar o
comportamento correto de parcelados/recorrentes).

### 1. Tags e nomenclatura
- **`ParcelledRow`** (débito/recebimento parcelado): a tag `PAR` estava no
  container de valor (ao lado do número da parcela); **movida** para o
  container do nome (ao lado da descrição), como pedido.
- Nomes de tag padronizados sem ponto final: `Rec.` → `REC`, `Aut.` → `AUT`
  (em `DebitRow`, `IncomeRow`, `ParcelledRow`).
- **`PurchaseInstRow`** (itens de cartão de crédito) **não tinha nenhuma tag**.
  Adicionado: `PAR` quando `inst.total > 1`, e `REC` quando a compra pertence
  a uma série recorrente (`purchase.recurrenceGroupId`) — ambas ao lado do
  nome. Para isso o tipo do prop `purchase` do componente ganhou o campo
  opcional `recurrenceGroupId`.

### 2. Ordenação da lista de cartão
- `CardRow` já ordenava parcelados antes de à-vista por data, mas **compras
  recorrentes** (installmentsCount=1, mesmo tier que à-vista) não eram
  priorizadas — ficavam misturadas com as compras à vista em vez de subirem
  junto com os parcelados, ao contrário do que já acontecia em
  débitos/recebimentos. Corrigido o comparador para tratar
  `installmentsCount > 1 || recurrenceGroupId != null` como tier 0.
  Débitos/recebimentos já ordenavam corretamente por data completa
  (ano/mês/dia via `localeCompare` em string ISO) — nada a mudar ali.

### 3. Padronização "Data da compra"
- Campos que diziam apenas "Data" agora dizem **"Data da compra"** em:
  `AddDebitDialog`, `AddIncomeDialog`, `AddPurchaseDialog`,
  `EditRecurringDialog`, e o branch de parcela em `EditInstallmentDialog`
  (antes só purchase tinha esse label, débito/recebimento parcelado tinham
  "Data"). `AddInvestmentDialog` foi deixado como "Data" (não é uma compra).

### 4. Checkbox "menor" no frame de recorrente
- Não eram checkboxes de fato — era o **radio button** de `CardScopePicker.tsx`
  (o frame "Aplicar em" usado por toda ação de escopo: excluir parcelado,
  excluir recorrente, duplicar, etc.), com `h-3.5 w-3.5` contra o padrão
  `h-4 w-4 accent-primary` usado em todo o resto do app. Corrigido para
  `h-4 w-4` (e alinhamento `mt-0.5` em vez de `mt-1`).

### 5. Modal de edição de compra recorrente ≠ modal de débito recorrente
Causa raiz: compras recorrentes (cada mês = uma `purchases` row própria +
1 `installments` row própria, ligadas por `recurrence_group_id`) sempre
abriam o `EditInstallmentDialog` genérico (tratadas como uma "parcela
única", `total=1`), nunca o `EditRecurringDialog` usado por débito/receita
recorrente.

- **`finance.ts`**: novas mutations `useUpdateRecurringPurchaseSeries` e
  `useDeleteRecurringPurchaseSeries`, espelhando
  `useUpdateRecurringSeries`/`useDeleteRecurringSeries` mas operando em
  `purchases` (campo `purchase_date`/`total_amount`) e mantendo a
  `installments` row pareada em sincronia (`amount`) — **sem nunca tocar**
  `due_date`/`year`/`month` da installment, porque é isso que define o mês
  do item (regra central do projeto).
- **`EditRecurringDialog.tsx`**: `RecurringEditTarget` virou union incluindo
  `kind: "purchase"` (com `cardId` em vez de `accountId`). Editar usa o
  mesmo fluxo de escopo "Apenas este mês" / "Este e os próximos meses" que
  débito/receita. Excluir usa um modal de escopo binário próprio
  (`askDeletePurchaseScope`, mesma UX) chamando
  `useDeleteRecurringPurchaseSeries` — não reaproveitei o
  `CardScopeConfirmDialog` genérico (mês/período/todas) para o delete de
  compra recorrente porque esse componente é acoplado a `DeleteSource`
  (que não tinha variante de purchase) e o escopo binário já resolve o
  caso. Duplicar reaproveita `useDuplicateOverScope`, que **já** tinha
  suporte a `kind: "purchase"`.
- **`contas.$contaId_.$ano.$mes.tsx`**: `onEditInst` do cartão agora checa
  `pur.recurrenceGroupId` — se existir, abre `EditRecurringDialog` (kind
  "purchase"); senão segue para `EditInstallmentDialog` como antes.

### 6. Renumeração de parcela — bug real encontrado e corrigido
O algoritmo antigo de `useRenumberInstallment` **preservava o mapeamento
número→mês inteiro** (usava um `Map` de "vaga por número original" e
reatribuía cada linha à vaga do seu NOVO número) — na prática isso é um
no-op visual: mover a parcela 1/4 para a posição 3 resultava exatamente no
mesmo mês para cada número (1=Jul, 2=Ago, 3=Set, 4=Out, igual a antes),
só trocando qual *row id* ocupava cada posição. Por isso "a renumeração não
funciona".

**Semântica correta** (derivada e validada contra os cenários P14/P15/P16
da spec, ver `prompt/prompt-2.txt`):
- A parcela editada e todas as que vêm **depois dela na numeração
  original** ("cauda", `number >= oldNumber`) são deslocadas pelo mesmo
  delta (`newNumber - oldNumber`), **mantendo cada uma no seu próprio mês**
  (nunca mexe em `due_date`/`year`/`month` de sobreviventes). As que caírem
  fora de `[1, total]` depois do deslocamento são **excluídas**.
- Toda parcela **antes** da editada na numeração original ("cabeça",
  `number < oldNumber`) é **sempre excluída**, independente da direção do
  movimento — não há como "reaproveitar" uma parcela anterior numa
  renumeração, ela é descartada e pode ser recriada.
- Os números que ficaram sem parcela (cabeça excluída + transbordo da
  cauda) podem ser recriados sob demanda (`createMissing`, ex-
  `includePrevious` — renomeado porque a pergunta mudou de "deslocar
  anteriores" para "criar as que faltaram"), em meses consecutivos
  ancorados no mês da própria parcela editada (`anchorMonth + (número -
  novoNúmero)`), reaproveitando o `amount` da parcela editada.
- `EditInstallmentDialog.tsx`: textos dos dois `confirm()` atualizados para
  refletir o que realmente acontece (exclusão da cabeça + do transbordo,
  não mais "deslocar parcelas anteriores").

### 7. Bug relacionado encontrado durante a investigação: editar data de compra única/ocorrência recorrente movia de mês
Em `EditInstallmentDialog.commit()`, o branch de edição de data só usava
"atualizar apenas a data do parent" (`purchase.date`/`debit.date`/
`income.date`, sem tocar a installment) quando `!isSingleParcel` (ou seja,
só para séries com mais de 1 parcela). Para compras **avulsas** (1x) ou
**ocorrências de recorrente** (`total` sempre 1), caía no fallback
`shift.mutateAsync`, que recalcula `due_date`/`year`/`month` a partir da
nova data digitada — **isso move o item de mês**, violando a regra central
("a data digitada é só referência visual, nunca define o mês"). Corrigido
para usar o branch de "só atualizar o parent" sempre que houver
`parentDate` disponível, independente de `isSingleParcel`.

### Itens da spec endereçados na v2 (não implementados nesta sessão, ver v3)
- P10-P12 (resync de total + histórico de ajuste) — **feito na v3**.
- P17 (excluir por período + renumerar restante) — **feito na v3**.

---

## v3 — 2026-07-26 — Auditoria cenário-a-cenário + fechamento dos gaps (P5-P12, P7-P9, R3-R5, P17)

**Origem:** pedido do usuário para auditar TODOS os cenários A/P/R de
`prompt/prompt-2.txt` contra o código (não só os 6 bugs nomeados da v2) e
corrigir o que faltasse.

**⚠️ AÇÃO MANUAL NECESSÁRIA — rodar antes de testar:**
Esta sessão adicionou uma migration
(`supabase/migrations/20260726120000_add_reference_date_and_amount_adjustments.sql`)
que **não foi aplicada** (sem Supabase CLI disponível no ambiente; projeto
aponta para o banco remoto `dmiazxfsyjoohzgcfalf`). Ela cria:
- `installments.reference_date` (coluna nova, nullable) — sem ela, o app
  vai falhar ao carregar installments (`useInstallments` seleciona essa
  coluna).
- Tabela `amount_adjustments` (histórico de ajuste de valor).

Rode a migration no SQL editor do Supabase (ou `supabase db push` se tiver
a CLI linkada) **antes** de testar qualquer coisa relacionada a parcelas.

### Resultado da auditoria (o que estava ✅ / ⚠️ / ❌ antes desta sessão)
- ✅ A1-A3, P1-P4, P13a/b, P14-P16 (renumerar), R1-R2 — já corretos (v1/v2).
- ⚠️ P5-P6, P10-P12 — parcialmente corretos, faltava algo pontual.
- ❌ P7-P9, R3 (parcial), P17 — não implementados / architeturalmente
  impossíveis com o schema anterior.

### P5-P6 — marcar parcela atual como paga na criação
- `buildInstallments`/`buildInstallmentsAnchored` ganharam um param
  `markAnchorPaid` — antes só existia `paidPast` (marca as ANTERIORES à
  âncora); agora dá pra marcar a própria parcela âncora também.
- `useAddDebit`/`useAddIncome`/`useAddPurchase` ganharam o campo
  `markCurrentPaid?: boolean`.
- `AddDebitDialog`/`AddIncomeDialog`/`AddPurchaseDialog`: o checkbox
  "Marcar como paga" (antes só visível para lançamento simples) agora
  também aparece quando `isInstallment=true`, com o label ajustado
  ("Marcar esta parcela como paga"/"...recebida").

### P10-P12 parte A — resync do total do parent
- `useUpdateInstallmentAmountScope` agora, depois de aplicar o novo valor
  por escopo, **recalcula a soma real** das installments do parent e
  reescreve `debit.amount`/`income.amount`/`purchase.total_amount` só se
  o total realmente mudou (evita updates/logs à toa).

### P10-P12 parte B — histórico de ajuste de valor (novo)
- Nova tabela `amount_adjustments` (ver migration acima) + hook
  `useLatestAmountAdjustment(parentId, parentType)` (finance.ts) +
  `useUpdateInstallmentAmountScope` grava uma linha nela sempre que o total
  do parent muda de fato.
- `EditInstallmentDialog.tsx`: mostra "Histórico: valor original X →
  ajustado para Y" logo abaixo de "Valor atual da parcela", quando existir
  um registro.
- **Ponto de atenção**: é histórico cumulativo simples (guarda cada ajuste,
  a UI só lê o mais recente). Não tenta reconstruir uma timeline completa
  nem se preocupa com edição concorrente — para o volume de uso do app
  (pessoal) isso é suficiente; se precisar de mais, dá pra listar todos via
  a mesma tabela.

### P7-P9 — data por parcela com escopo (mudança de schema)
Causa raiz: a "data da compra" sempre foi UM campo só, compartilhado por
toda a série (`purchases.purchase_date`/`debits.date`/`incomes.date`).
Não tinha como uma parcela mostrar uma data diferente da outra — então
"só esta parcela"/"esta e as próximas" eram, na prática, impossíveis, e o
modal nem chegava a perguntar o escopo pra edição de data.

- **Nova coluna `installments.reference_date`** (nullable). `null` = usa a
  data do parent (comportamento antigo/default). Quando preenchida, é um
  override só daquela parcela. **Nunca** influencia `due_date`/`year`/
  `month` (mês continua sendo definido só por esses três).
- **Nova mutation `useUpdateInstallmentDateScope`** (finance.ts):
  - `scope: "current"` → grava `reference_date` só nesta parcela.
  - `scope: "future"` → grava nesta + todas com `number > esta`.
  - `scope: "all"` → atualiza a data COMPARTILHADA do parent e **limpa**
    `reference_date` de todas as parcelas da série (evita overrides
    obsoletos flutuando depois que a base mudou).
- `Installment` (tipo) ganhou o campo `referenceDate: string | null`;
  `useInstallments()` agora seleciona e mapeia `reference_date`.
- `EditInstallmentDialog.tsx`: `parentDate` (a data compartilhada) e
  `effectiveDate` (`installment.referenceDate ?? parentDate`, o que
  realmente deve aparecer no campo) viraram conceitos separados.
  `commit()` agora decide entre 3 caminhos pra edição de data:
  1. `isSingleParcel && parentDate` → avulso/ocorrência única, só edita o
     campo do parent (comportamento da v2, inalterado).
  2. `!isSingleParcel && parentDate` → série genuína, usa
     `useUpdateInstallmentDateScope` com o escopo escolhido.
  3. fallback (sem parent, ex. investimento) → `shift` como antes.
  - **`handleSave` mudou**: antes só abria o seletor de escopo quando o
    VALOR mudava; agora abre também quando a DATA muda (bug: antes uma
    edição de data pura numa série nunca perguntava escopo e aplicava
    direto no campo compartilhado — end-state coincidia com "todas as
    parcelas", nunca com "só esta"/"esta e as próximas").
  - Texto do modal de escopo ajustado: removida a menção a "mantendo o dia
    X" (isso era da lógica antiga de `shift`, que preservava dia-do-mês
    por mês; `reference_date` grava o valor literal digitado, igual em
    todas as parcelas afetadas — bate com o texto exato da spec: "passam a
    exibir 20/07/2026").
- `ParcelledRow`/`PurchaseInstRow` (contas.$contaId_.$ano.$mes.tsx): a data
  mostrada na lista virou `installment.referenceDate || parent.date` (era
  só `parent.date`).

### R3-R5 — terceira opção de escopo "Toda a conta"
- `useUpdateRecurringSeries`, `useUpdateRecurringPurchaseSeries` e (por
  consistência, já que os criei na v2) `useDeleteRecurringPurchaseSeries`
  ganharam `scope: "one" | "forward" | "all"` (antes só `"one"|"forward"`).
  `"all"` = sem filtro de data, aplica em todos os meses da série,
  inclusive passados.
- `EditRecurringDialog.tsx`: terceiro botão "Toda a conta" nos dois
  seletores de escopo (editar e excluir-de-compra-recorrente).
- **Não mexi** no delete de débito/recebimento recorrente
  (`useDeleteRecurringSeries` / `askDeleteRecurring` na rota) — ele usa um
  mecanismo totalmente diferente (`CardScopeConfirmDialog` genérico de
  mês/período/24-meses via `useDeleteOverScope`), não o par "one/forward"
  do update. R3-R5 da spec é especificamente sobre EDITAR data, então focei
  ali; a exclusão de recorrente de débito/recebimento já tinha sua própria
  UI de escopo (mês/período/tudo) e não foi citada como quebrada.
  - Nota à parte: notei que `useDeleteRecurringSeries` (debit/income) está
    **sem uso real** — o botão de excluir do `EditRecurringDialog` para
    esses dois kinds sempre passou pelo `CardScopeConfirmDialog` +
    `useDeleteOverScope`, nunca chama essa mutation via `mutateAsync`
    (só usava seu `isPending` pra desabilitar botão). Não removi por não
    ser o foco do pedido, mas é código morto — se for mexer nessa área de
    novo, vale limpar.

### P17 — renumerar após excluir por período
- `useDeleteParcelledByScope` agora retorna `{ remainingCount, hasGap }`
  depois de excluir (calculado comparando a numeração restante contra
  `1..remainingCount` contíguo).
- Nova mutation `useCompactInstallmentNumbering({parentId, parentType})` —
  renumera 1..N as parcelas que sobraram (ordenadas pelo `number` atual),
  atualiza `total` em cada uma e `installments_count` no parent. Não toca
  `due_date`/`year`/`month`/`reference_date` de nenhuma.
- `contas.$contaId_.$ano.$mes.tsx`: o `execute` de `askDeleteParcelled`
  agora é assíncrono — depois do delete, se `hasGap && remainingCount > 0`,
  abre um `confirmDialog` ("Renumerar parcelas restantes?") e, se
  confirmado, chama `useCompactInstallmentNumbering`.

### Verificação feita
- `npx tsc --noEmit` rodou limpo (0 erros) ao final de cada etapa.
- Nenhum commit foi feito.
- **Migration NÃO aplicada** (ver aviso no topo desta seção) — sem rodá-la,
  qualquer tela que carregue installments vai quebrar (`reference_date`
  não existe na tabela ainda).
- **Não testado manualmente no browser** — só leitura de código +
  raciocínio sobre os cenários da spec + typecheck. P7-P9 em particular
  envolve um fluxo novo (escopo pra edição de data) que merece um teste
  manual assim que a migration for aplicada.
