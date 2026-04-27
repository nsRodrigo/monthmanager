## Ajustes mobile — Consolidado e Conta

### Problemas identificados

**Tela Consolidado (`src/routes/index.tsx`):**
1. Saldo previsto com `text-4xl md:text-5xl` causa overflow com valores grandes no mobile (ex: `-R$ 283.305,58`).
2. Grid de 5 stats em `grid-cols-2` no mobile fica apertado.
3. Linha de cada conta (ícone + nome + saldo + chevron) fica apertada — nome trunca e saldo aparece colado.

**Tela Conta (`src/routes/contas.$contaId.tsx`):**
1. Header com ícone + nome + saldo numa única linha flex — no mobile o nome trunca para "I..." e o saldo invade o espaço (visível na imagem).
2. Grid de 5 stats em `grid-cols-2` no mobile gera cards apertados.
3. Cada linha da lista de meses tem balanço colado no chevron com valores grandes.

### Mudanças propostas

**`src/routes/index.tsx`**
1. Saldo previsto: `text-3xl sm:text-4xl md:text-5xl` + `break-words`.
2. Grid de stats: `grid-cols-1 sm:grid-cols-2 md:grid-cols-5` (mesma estratégia já aplicada na tela mensal).
3. Lista de contas: `min-w-0` no container de texto, fonte do saldo `text-sm sm:text-base`.

**`src/routes/contas.$contaId.tsx`**
1. Header da conta: layout `flex-col sm:flex-row` — no mobile, ícone + nome em cima, "Saldo atual + valor" embaixo alinhado à esquerda; fonte responsiva (`text-xl sm:text-2xl md:text-3xl`) com `break-words`.
2. Grid de stats: `grid-cols-1 sm:grid-cols-2 md:grid-cols-5`.
3. Lista de meses: `min-w-0` no container de texto, fonte do balanço `text-xs sm:text-sm`, garantir que ícone e chevron mantenham `shrink-0`.

### Não muda

- Lógica de cálculo, dados, navegação, dialogs.
- Layout desktop (md+) permanece idêntico.
- Componentes auxiliares (`Stat`, `Mini`, `currentMonthSummary`).