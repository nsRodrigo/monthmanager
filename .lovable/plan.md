## Ajustes solicitados

### 1. Regra de mês para débitos, recebimentos e investimentos

**Regra:** lançamento feito em `01/01/2014` deve aparecer em **Janeiro/2014**, sempre baseado no mês da `date` do lançamento (não no fuso UTC).

**Cartão de crédito:** mantém regra atual (`getInvoiceMonth` em `src/store/finance.ts` linhas 114-133) — compras agrupam pela fatura (fechamento/vencimento), aparecendo no mês de vencimento.

**Bug atual:** `getMonthDebits` e `getMonthIncomes` (`src/store/finance.ts` linhas 1731-1772) usam `new Date(d.date)` numa string `"YYYY-MM-DD"`, que JS interpreta como UTC midnight. Em UTC-3, `2014-01-01` vira `31/12/2013` → o débito cai em Dezembro/2013 em vez de Janeiro/2014.

**Correção:** parsear a data como local (mesmo padrão já usado em `formatDate` de `src/lib/format.ts` e `buildInstallmentsAnchored`). Trocar:
```ts
const dt = new Date(d.date);
return dt.getFullYear() === year && dt.getMonth() === month;
```
por:
```ts
const [y, m] = d.date.slice(0, 10).split("-").map(Number);
return y === year && (m - 1) === month;
```
Aplicar em `getMonthDebits` e `getMonthIncomes`. Investimentos hoje não têm campo de data — eles aparecem em **todos os meses** porque o filtro é só por conta. Manter como está (são posições, não eventos), a menos que você queira que invistam apenas no mês de criação — me avise.

### 2. Eliminar duplicidade dos cards de resumo (tela do mês — imagem 1)

**Hoje:** `src/routes/contas.$contaId_.$ano.$mes.tsx` mostra 4 `BigSummary` (Recebimentos / Débitos / Cartões / Investimentos) **e logo abaixo** as mesmas 4 seções `GroupedSection` colapsáveis com o mesmo total.

**Mudança:** remover completamente o bloco `BigSummary` (linhas ~213-246). Manter apenas as `GroupedSection`, que já mostram total + contagem no header e expandem com os itens. A ordem segue a atual: Débitos → Recebimentos → Investimentos → Cartões.

### 3. Tela da conta (imagem 2) — saldo com pop-up de detalhes

**Hoje:** `src/routes/contas.$contaId.tsx` mostra header com saldo + grid de 5 stats (Recebimentos / Débitos / Faturas / Investido / Saldo previsto) sempre visível.

**Mudança:**
- Header mostra apenas: ícone + nome da conta + **Saldo atual** (clicável).
- Ao clicar no saldo, abre um Modal (usando `src/components/Modal.tsx`) com os 5 stats consolidados do mês corrente: Recebimentos do mês, Débitos do mês, Faturas do mês, Investido, Saldo previsto.
- O grid de stats sai da página; vira conteúdo do modal.
- Adicionar uma dica visual (ícone `Info` ou cursor pointer + underline sutil) no saldo para indicar interatividade.

### 4. Tela Consolidado (imagem 3) — mais detalhes nas contas

**Hoje:** `src/routes/index.tsx` lista cada conta como linha simples: ícone + nome + tipo/qtd cartões + saldo atual.

**Mudança:** enriquecer cada card de conta (mantendo clicável e navegando para `/contas/$contaId`) com mini-stats do mês corrente daquela conta:
- Saldo atual (já existe, em destaque)
- A receber no mês
- A pagar (débitos) no mês
- Faturas do mês
- Saldo previsto fim do mês

Layout proposto: card maior (não mais uma linha), com header (ícone + nome + saldo) e abaixo um mini-grid 2x2 ou 4 colunas em desktop / 2 em mobile com os valores do mês. Cálculo reusa as mesmas funções (`getMonthDebits`, `getMonthIncomes`, `getMonthInstallments`) já filtradas por `accountId`/`cardIds` da conta.

## Arquivos a alterar

- `src/store/finance.ts` — corrigir parsing de data em `getMonthDebits` e `getMonthIncomes`.
- `src/routes/contas.$contaId_.$ano.$mes.tsx` — remover bloco `BigSummary` e o componente não usado.
- `src/routes/contas.$contaId.tsx` — header simplificado + modal de detalhes ao clicar no saldo.
- `src/routes/index.tsx` — cards de conta enriquecidos com stats do mês corrente.

## Não muda

- Regra de fatura de cartão (`getInvoiceMonth`).
- Cálculo de saldo (`computeAccountBalance`).
- Dialogs de adicionar débito/recebimento/compra/investimento.
- Persistência, RLS, autenticação.
