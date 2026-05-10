# Plano em 3 fases

A entrega vai em fases porque os itens 4 e 5 são grandes e arriscados — não dá para misturar com refactors de UI sem comprometer estabilidade.

---

## Fase 1 — UX dos modais (itens 1, 2 e 3)

**Item 1 — Visibilidade do confirm**
- Substituir todos os `window.confirm(...)` por um `ConfirmDialog` reutilizável usando o `Modal` do projeto (mesmo padrão visual dos outros, com ações destacadas e fundo do tema).
- Locais hoje usando `confirm()`: exclusão de compra, exclusão de parcelas (DeleteParcelledDialog), exclusão de débito/receita/investimento, exclusão de cartão, exclusão de conta, restauração de backup.

**Item 2 — "Aplicar em" como modal pós-ação**
- Remover o `CardScopePicker` de dentro de `AddCardDialog` e `EditCardDialog`.
- Criar `CardScopeConfirmDialog`: abre **depois** que o usuário clica em **Salvar / Excluir / Duplicar** no cartão.
- Default selecionado: **"Só este mês"**.
- Opções: "Só este mês" · "Período" · "Toda a conta".
- Confirmar aplica a ação no escopo escolhido. Cancelar não aplica nada.
- Mesmo modal serve para excluir/editar **compras parceladas** (substitui o `DeleteParcelledDialog` atual, mas mantendo a lógica de "preservar parcelas pagas").

**Item 3 — Date pickers no período**
- No modo "Período", trocar os 4 selects (mês/ano início + mês/ano fim) por **dois date pickers** (Data inicial / Data final), igual ao usado em `AddPurchaseDialog`.
- Internamente continua salvando ano+mês (a granularidade do escopo é mensal), só a UI muda.

---

## Fase 2 — Backup no Google Drive (item 4)

**Pré-requisitos do usuário (uma vez):**
1. Criar projeto no Google Cloud Console.
2. Habilitar Google Drive API.
3. Criar OAuth Client ID (tipo Web), com redirect autorizado: `https://monthmanager.lovable.app/auth/google-drive/callback` (e equivalente preview).
4. Configurar tela de consentimento com escopo `https://www.googleapis.com/auth/drive.file` (acesso só aos arquivos criados pelo app — mais seguro que `drive` total).
5. Me passar o **Client ID** e **Client Secret** (vou pedir via secrets seguros).

**O que vou implementar:**
- Tabela `user_drive_tokens` (refresh_token criptografado, expiry).
- Server functions: `getDriveAuthUrl`, `exchangeDriveCode`, `refreshDriveToken`, `uploadBackupToDrive`.
- Rota `/auth/google-drive/callback` para receber o code do OAuth.
- Botão "Conectar Google Drive" na tela de Backup.
- Ao clicar em "Gerar backup":
  - Se Drive não conectado: salva local (fluxo atual).
  - Se conectado: abre dialog "Onde salvar?" com opções **Local** · **Google Drive** · **Ambos**.
  - No iPhone/iPad/desktop sem Drive: usa o **Web Share API nativo** quando disponível (Files/iCloud/AirDrop), com fallback para download.

---

## Fase 3 — Offline-first com fila de sync (item 5)

Esta é a fase mais pesada. Vai mexer em `src/store/finance.ts` inteiro.

- **Cache persistente**: persistir o React Query cache em IndexedDB (`@tanstack/query-sync-storage-persister` + `idb-keyval`). App abre offline com últimos dados.
- **Fila de mutações offline**:
  - Toda mutação (criar/editar/excluir compra, débito, etc.) passa por uma fila local.
  - Online → executa direto no Supabase.
  - Offline → enfileira em IndexedDB com timestamp + tipo + payload, marca a entidade como "pendente" (badge na UI).
  - Ao reconectar: drena a fila em ordem, com retry exponencial.
- **Conflitos**: estratégia simples "last-write-wins" baseada em `updated_at` (vou adicionar essa coluna nas tabelas que faltam). Quando detectar conflito, mostra modal "A versão do servidor é mais nova. Manter local ou servidor?".
- **Indicador de status**: ícone fixo (online/offline/syncando/N pendentes) no topo do app.
- **Service Worker**: ajustar `sw.js` para cachear shell do app + assets (já tem PWA básico).

---

## Como prefere prosseguir?

Sugiro ir **fase por fase**, com aprovação ao final de cada uma. Se concordar, começo agora pela **Fase 1** (que é onde está a dor visível dos itens 1-3) e, quando terminar, abrimos a Fase 2.

Se quiser que eu comece direto pela Fase 2 ou 3, me diz.

## Detalhes técnicos

- **ConfirmDialog**: novo componente em `src/components/ConfirmDialog.tsx` com props `{ open, title, description, confirmLabel, variant: 'default'|'destructive', onConfirm, onClose }`.
- **CardScopeConfirmDialog**: novo componente em `src/components/CardScopeConfirmDialog.tsx` que substitui o uso atual do `CardScopePicker` inline. O `CardScopePicker` antigo será removido.
- **DatePicker**: vou reutilizar o mesmo `<input type="date">` que `AddPurchaseDialog` já usa, derivando `year`/`month` no submit.
- **Drive tokens**: `pgcrypto` para criptografar refresh_token em repouso; chave em `secret('DRIVE_TOKEN_ENCRYPTION_KEY')`.
- **Offline queue**: lib `idb-keyval` (~600B) para fila; `online`/`offline` events do browser para drenar.