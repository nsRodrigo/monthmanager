## Mudanças visuais e comportamentais

### 1. Botão do accordion (chevron) à direita do filtro
**Hoje** (Investimentos, Recebíveis, Débitos e dentro do Cartão):
```
[ícone] TÍTULO ........ total/itens   [↕ Filtro]   [▼/▲ chevron]
                                       ↑ aparece só quando aberto, à esquerda do chevron
```
**Depois**: o filtro continua aparecendo apenas quando aberto, mas a ordem fica fixa com o chevron sempre à direita do filtro:
```
[ícone] TÍTULO ........ total/itens   [↕ Filtro]   [▼/▲]
```
Fechado:
```
[ícone] TÍTULO ........ total/itens                [▼]
```
*Arquivo:* `GroupedSection` e `CardRow` em `src/routes/contas.$contaId_.$ano.$mes.tsx` — mover `{open && sortControl}` para dentro do bloco do botão de toggle (lado direito, antes do chevron) em vez de fora.

### 2. Botão "Pago" / "Marcar pago" ao lado do filtro
**Hoje**: aparece numa barra separada logo abaixo do header quando o accordion está aberto (Débitos, Cartão).
**Depois**: vira um chip no próprio cabeçalho, ao lado do filtro, visível quando o accordion está aberto:
```
[ícone] DÉBITOS ........ R$ 1.234   [✓ Pago | Marcar pago]  [↕ Filtro]  [▲]
```
- Em Débitos: marca/desmarca todos os débitos do mês (single + parcelas).
- Dentro do Cartão: marca/desmarca a fatura inteira do mês (mesma ação atual).
- Recebíveis e Investimentos: não têm "pago" → nenhum chip ali (sem mudança).
- A `<SelectionBar>` (modo seleção múltipla) continua aparecendo abaixo do header como hoje, sem conflito.

### 3. Nome do cartão sem link + long-press com menu
**Hoje**: clicar no nome do cartão abre direto o modal de edição.
**Depois**: o nome do cartão vira texto simples (sem hover/underline, sem onClick). Clicar e segurar (long-press) no cabeçalho do cartão abre um popover com duas opções:
```
┌──────────────────────┐
│ ✏  Editar cartão     │
│ ↕  Reordenar cartões │
└──────────────────────┘
```
- **Editar cartão** → abre o `EditCardDialog` atual (sem mudança nele).
- **Reordenar cartões** → entra em "modo reordenação" da seção CARTÕES DE CRÉDITO: cada cartão vira uma linha compacta com setas ▲▼ (e handle de arrastar no desktop) e um botão "Concluir" no topo da seção. Salvando, a nova ordem vale **para a conta inteira em todos os meses** onde o cartão aparece.

Usa o hook existente `useLongPress` (`src/hooks/use-long-press.ts`) — mesma UX do modo seleção múltipla das linhas, então o usuário já conhece o gesto.

### 4. Persistência da ordem dos cartões
Hoje a tabela `cards` não tem coluna de posição. Vou adicionar uma coluna `position int` (default crescente por `created_at` na migração) e ordenar os cartões em todas as views por `position ASC, created_at ASC`. A reordenação só atualiza essa coluna — não duplica nem cria registros novos.

## Detalhes técnicos

### Arquivos alterados
- `src/routes/contas.$contaId_.$ano.$mes.tsx`
  - `GroupedSection`: mover `sortControl` e novo `paidControl?: ReactNode` para o lado direito (antes do chevron).
  - Remover a `headerBar` que renderiza o chip "Marcar pago" em Débitos; passar essa lógica como `paidControl`.
  - `CardRow`: mover `sortControl` e o botão "Marcar paga" da fatura para o lado direito (antes do chevron); remover a linha separada `flex flex-wrap items-center justify-end gap-2 px-3 py-2`.
  - `CardRow`: remover o `<button>` no nome do cartão; envolver o cabeçalho do cartão num wrapper que aceita `useLongPress` → abre um `Popover` (shadcn) com "Editar cartão" e "Reordenar cartões". O click curto continua expandindo/recolhendo o accordion (usar `didFire()` para suprimir o toggle quando o long-press disparou).
  - Renderização condicional de modo reordenação da seção CARTÕES (lista compacta com ▲▼ + botão Concluir).
- `src/components/EditCardDialog.tsx`: sem mudanças (continua sendo aberto pelo menu Editar).
- `src/store/finance.ts`: adicionar `position` em `Card`/queries; novo mutation `useReorderCards(accountId, orderedIds)` que faz `UPDATE cards SET position = $n WHERE id = $id` em lote; aplicar `ORDER BY position` em `useCards`.

### Migração de banco
```sql
ALTER TABLE public.cards ADD COLUMN position int;
-- inicializar com ordem atual (created_at) por conta
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY account_id ORDER BY created_at) AS rn
  FROM public.cards
)
UPDATE public.cards c SET position = r.rn FROM ranked r WHERE c.id = r.id;
ALTER TABLE public.cards ALTER COLUMN position SET NOT NULL;
ALTER TABLE public.cards ALTER COLUMN position SET DEFAULT 0;
CREATE INDEX cards_account_position_idx ON public.cards(account_id, position);
```
RLS não muda (a tabela já tem policies por `user_id`).

### Fora do escopo
- Não mexer em `EditCardDialog`, `CardScopeConfirmDialog`, nem na lógica de saldo / pagamentos.
- Não mexer em recebíveis/investimentos além de reposicionar o chevron à direita do filtro.

Confirma que posso seguir nesse formato?