# Desfazer / Refazer estilo Google Sheets

Histórico em memória (só na sessão atual) e dois botões fixos no topo de cada página. Os botões ficam sempre visíveis, mas só ficam **ativos** quando há algo a desfazer/refazer — exatamente como na barra do Google Sheets.

## Onde os botões vão ficar

Eles entram na barra superior, **antes do título da página** (à esquerda do conteúdo principal), em todas as telas autenticadas. No mobile, vão no topbar ao lado do botão de menu.

```text
Desktop (dentro do <main>, topo de cada rota):
┌────────────────────────────────────────────────────────────┐
│ [ ↶ ]  [ ↷ ]   │   Título da página / breadcrumbs          │
├────────────────────────────────────────────────────────────┤
│  ...conteúdo da página...                                  │

Mobile (header já existente):
┌────────────────────────────────────────────────────────────┐
│ [☰]  Gestão Financeira              [ ↶ ]  [ ↷ ]           │
└────────────────────────────────────────────────────────────┘
```

Comportamento dos botões:
- Cinza/desabilitado quando a pilha está vazia.
- Coloridos quando há ação disponível; tooltip mostra o que será desfeito/refeito ("Desfazer: adicionar compra 'Mercado'").
- Atalhos globais **Ctrl+Z** e **Ctrl+Shift+Z** (e **⌘Z / ⌘⇧Z** no Mac).
- Toast curto após cada ação confirma o que aconteceu ("Compra adicionada · Desfazer").

## Ações cobertas

Tudo que o usuário faz manualmente no app:
- Compras de cartão (adicionar/editar/remover, incluindo parcelas filhas)
- Débitos e receitas (adicionar/editar/remover)
- Cartões (adicionar/editar/remover/posição)
- Contas (adicionar/editar/remover)

Ficam **fora** do undo: login/logout, importação de CSV/planilha (operações em massa), mudanças de perfil/tema, e qualquer alteração vinda de outro dispositivo via realtime.

## Como funciona por baixo

Padrão "command com inverso", em memória:

1. Novo arquivo `src/store/history.ts` expõe um store (Zustand-like via React context) com:
   - `undoStack`, `redoStack` (limite 50 ações)
   - `push({ label, undo, redo })`
   - `undo()` / `redo()` / `canUndo` / `canRedo`
2. Em `src/store/finance.ts`, cada mutação do usuário, no `onSuccess`, registra no histórico um par `{undo, redo}` que reusa as próprias mutações existentes:
   - **Adicionar X** → undo = deletar X pelo id retornado; redo = re-adicionar com o mesmo payload.
   - **Editar X** → snapshot do estado anterior (lido do cache do React Query antes de mutar); undo = update com snapshot; redo = update com novo estado.
   - **Remover X** → snapshot completo da linha (e filhas, no caso de compra com parcelas) antes do delete; undo = re-inserir preservando o id; redo = deletar de novo.
3. Para preservar ids ao "recriar" (importante para compras→parcelas), as funções de insert ganham um parâmetro opcional `id?: string` usado só pelo redo/undo.
4. Toda ação nova **limpa o redoStack** (igual editores de texto).
5. Realtime: quando chega um evento de outro dispositivo, o histórico local é **invalidado** (limpo) para evitar conflitos — mais seguro que tentar reconciliar.

## Componentes novos

- `src/store/history.tsx` — provider + hook `useHistory()`.
- `src/components/UndoRedoBar.tsx` — os dois botões + tooltip + atalhos de teclado (`useEffect` com listener global).
- Integração em `src/routes/__root.tsx`:
  - `<HistoryProvider>` dentro de `RootComponent`.
  - `<UndoRedoBar />` no topo do `<main>` (desktop) e no header mobile.

## Mudanças em arquivos existentes

- `src/store/finance.ts` — em cada hook de mutação relevante (`useAddPurchase`, `useUpdatePurchase`, `useRemovePurchase`, equivalentes de debit/income, card e account), capturar snapshot pré-mutação e empurrar entry no histórico no `onSuccess`. Adicionar suporte a `id` opcional nos inserts.
- `src/routes/__root.tsx` — wrapper do provider + render da barra.

## Pontos que vou validar durante a implementação

- Remoção de compra com parcelas: snapshot precisa incluir `purchase + installments` para o undo recriar tudo atomicamente.
- Edição que altera `installmentsCount`: o undo restaura o estado anterior completo (lista de parcelas pode ter sido recriada).
- Após erro de rede em undo/redo: a entry volta para a pilha original e mostra toast de erro.
