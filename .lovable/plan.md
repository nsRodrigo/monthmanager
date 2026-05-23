## Problema

Em `src/store/finance.ts` (`useRemoveCard`, linhas 872-878), a remoção de `card_payments` por escopo de mês/período usa apenas `gte("year", …)` + `lte("year", …)`, ignorando o mês. Resultado: ao excluir "só junho/2025" o status de pago de todos os meses de 2025 é apagado.

## Correção

Aplicar a mesma lógica `ym = year * 12 + month` já usada nas parcelas:

1. Buscar `id, year, month` de `card_payments` do cartão.
2. Filtrar em memória pelos registros com `ym` dentro de `[sYM, eYM]`.
3. Deletar apenas esses ids.

Restante do fluxo (parcelas, compras órfãs, preservação do cartão fora da janela) já está correto e não muda.

## Arquivo

- `src/store/finance.ts` — substituir o bloco de delete de `card_payments` no `useRemoveCard`.
