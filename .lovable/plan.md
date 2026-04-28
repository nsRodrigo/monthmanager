## Ajustes solicitados

Combinando os pedidos pendentes em um plano só:

### 1. Total de "CARTÕES DE CRÉDITO" em vermelho

Hoje o total no header da `GroupedSection` de cartões usa `toneText["credit"]` (roxo). Como cartão também é saída, deve ficar vermelho como débitos.

**Como aplicar:** adicionar prop opcional `totalTone?: Tone` em `GroupedSection` (`src/routes/contas.$contaId_.$ano.$mes.tsx` ~linha 452). Quando informada, o `<p>` do total (linha 499) usa `toneText[totalTone]`. Na seção de cartões (linha 326), passar `totalTone="debit"`. Ícone, descrição e "6 itens" continuam no tom `credit`.

### 2. Investimentos por mês (mesma regra de débitos/recebíveis)

Hoje `Investment` não tem campo de data — todos aparecem em qualquer mês visitado.

**Migration:** `ALTER TABLE public.investments ADD COLUMN date date NOT NULL DEFAULT CURRENT_DATE;` (investimentos antigos caem no mês atual; usuário pode editar/recriar se quiser).

**`src/store/finance.ts`:**
- Adicionar `date: string` ao type `Investment` (linha 77).
- `useInvestments` (linha 506): incluir `date` no select e map.
- `useAddInvestment` (linha 1163): aceitar e gravar `date`.
- Importer (linha 1639-1650): gravar `e.date` no investmentRow.
- Novo helper `getMonthInvestments(invs, year, month)` parseando `date` como local (split de `YYYY-MM-DD`, sem `new Date()` UTC).

**`src/components/AddInvestmentDialog.tsx`:** novo Field "Data" (`<input type="date">`) com default = hoje.

**`src/routes/contas.$contaId_.$ano.$mes.tsx`** (linhas 136, 157, 303-323): filtrar `investments` por `getMonthInvestments`. `totalInvested`, `count` e `map` da seção INVESTIMENTOS passam a usar a lista do mês.

**`src/routes/index.tsx`** e **`src/routes/contas.$contaId.tsx`**: nos mini-stats / modal "Investido no mês", aplicar o mesmo filtro mensal. `computeAccountBalance` mantém a soma de **todos** os investimentos da conta (é posição acumulada, não evento do mês).

### 3. Esconder cartões sem compra no mês + botão "Adicionar cartão" no fim

Hoje todos os cartões da conta são listados em CARTÕES DE CRÉDITO mesmo quando não têm parcela no mês. O usuário tem um "ocultar" manual; queremos automático.

**Mudança em `src/routes/contas.$contaId_.$ano.$mes.tsx` (~linha 336):**

- Filtrar antes do `.map`: incluir só cartões com `cardInst.length > 0` no mês.
  ```ts
  const cardsWithMovement = accountCards
    .filter((c) => !hiddenCardIds.includes(c.id))
    .map((c) => ({ card: c, items: monthInst.filter(...) }))
    .filter(({ items }) => items.length > 0);
  ```
- Renderizar a partir desse array. `count` da seção também passa a ser `cardsWithMovement.length`.
- Cartões sem movimento ficam **invisíveis nessa tela** (continuam existindo no banco, aparecem em outros meses se tiverem compras, e estão disponíveis no seletor do diálogo de nova compra).

**Botão "Adicionar a um cartão" no fim do accordion:**

- Após a lista de cartões com movimento, renderizar um botão tracejado (mesmo estilo do `onAdd` da `GroupedSection`) com texto "Adicionar gasto a um cartão".
- Ao clicar, abre `AddPurchaseDialog` (sem `fixedCardId`) já existente, com `defaultYear={year}` / `defaultMonth={month}` — o usuário escolhe qualquer cartão da conta no select interno do diálogo.
- Para isso, passar pela prop `onAdd` da `GroupedSection` (que já renderiza o botão tracejado). Hoje a seção CARTÕES não tem `onAdd`; vamos adicionar:
  ```tsx
  onAdd={accountCards.length > 0 ? () => setOpenPurchase(true) : undefined}
  addLabel="Adicionar gasto a um cartão"
  ```
  e criar estado `openPurchase` ligado a um novo `<AddPurchaseDialog open={openPurchase} onClose={...} defaultYear={year} defaultMonth={month} />` (sem `fixedCardId`, então o select aparece).

- Estado `emptyText` quando `accountCards.length === 0` continua igual; quando há cartões mas nenhum com movimento, o `empty` deve ser `false` para o botão tracejado aparecer — ajustar `empty={accountCards.length === 0}` (já é assim) e mostrar uma linha sutil tipo "Nenhum cartão com lançamentos neste mês." acima do botão quando `cardsWithMovement.length === 0 && accountCards.length > 0`.

- Remover (ou manter desabilitado) a UI de "ocultar cartão / mostrar X cartões ocultos" — fica redundante com o filtro automático. Vou **remover** `hideCardForMonth` / `restoreHiddenCards` / botões correspondentes e o `localStorage` `hiddenKey` para simplificar.

### Não muda

- Regra de fatura de cartão (`getInvoiceMonth`).
- `computeAccountBalance` (saldo da conta soma todos investimentos como posição).
- Dialogs e fluxos de débito/recebível.
- RLS, autenticação, schema dos demais campos.

## Arquivos a alterar

- **Migration:** adicionar `date` em `public.investments`.
- `src/store/finance.ts` — type `Investment`, `useInvestments`, `useAddInvestment`, importer, novo `getMonthInvestments`.
- `src/components/AddInvestmentDialog.tsx` — campo Data.
- `src/routes/contas.$contaId_.$ano.$mes.tsx` — `totalTone="debit"` em cartões; filtrar cartões sem movimento; botão "Adicionar gasto a um cartão" no fim; remover lógica de ocultar manual; filtro mensal de investimentos.
- `src/routes/index.tsx` — investimentos do mês no mini-stat da conta.
- `src/routes/contas.$contaId.tsx` — investido do mês no modal de detalhes.
