# Módulo de Análise de IRPF

Novo módulo dentro do app atual (sem quebrar nada). MVP focado em CSV/XLSX + cruzamento com os dados já existentes (contas, débitos, recebimentos, investimentos, parcelas, cartões). PDF/OCR fica para fase 2.

## Arquitetura

- Rota nova: `src/routes/irpf.tsx` (índice com tabs) usando `createFileRoute`, mobile-first, mesmos tokens do app.
- Acesso restrito ao usuário logado (já protegido por whitelist + RLS).
- Toda a lógica pesada roda no client (parsing CSV/XLSX) — seguindo o padrão do app (sem edge functions).
- Storage privado para arquivos enviados (bucket `irpf-docs`, RLS por `user_id`, não público).

## Schema (migrations)

1. `irpf_documents` — `id, user_id, year, kind ('informe'|'extrato'|'planilha'|'outro'), file_path, original_name, mime, size, uploaded_at`. RLS own.
2. `irpf_entries` — itens extraídos/normalizados de cada documento: `id, user_id, document_id, date, description, amount, source, category ('tributavel'|'isento'|'exclusiva'|'bens_direitos'|'dividas'|'nao_classificado'), subcategory, year, raw jsonb, created_at`. RLS own.
3. `irpf_overrides` — ajustes manuais do usuário (reclassificação): `id, user_id, entry_id, category, subcategory, note`. RLS own.
4. `irpf_year_snapshots` — saldos em 31/12 por conta/investimento congelados pelo usuário: `id, user_id, year, account_id (nullable), investment_id (nullable), label, value`. RLS own.
5. Storage bucket `irpf-docs` privado + policies (`auth.uid()::text = (storage.foldername(name))[1]`).

## Telas (`src/routes/irpf.tsx` + sub-rotas dot-separated)

- `/irpf` — seletor de ano + 4 tabs:
  1. **Documentos** — upload (drag-drop), lista, excluir, ver origem.
  2. **Resumo IRPF** — cards com totais por categoria, comparativo com dados do app.
  3. **Itens para declarar** — lista agrupada por ficha da Receita, com botão "Copiar" em cada bloco (Ficha/Grupo/Código/Descrição/Valor).
  4. **Alertas & Checklist** — inconsistências detectadas + checklist do que falta.

## Componentes novos (`src/components/irpf/`)

- `UploadDropzone.tsx` — aceita `.csv,.xlsx,.xls,.pdf` (PDF aceito mas marcado "processamento manual" no MVP).
- `DocumentList.tsx`
- `EntriesTable.tsx` — com reclassificação inline (dropdown de categoria; salva em `irpf_overrides`).
- `IrpfSummaryCards.tsx`
- `DeclarationBlock.tsx` — formato copiável.
- `AlertsList.tsx`, `Checklist.tsx`.
- `YearSnapshotDialog.tsx` — usuário confirma/edita saldos em 31/12.

## Data layer (`src/store/irpf.ts`)

Mesmo padrão de `finance.ts`: hooks `useIrpfDocuments`, `useIrpfEntries(year)`, `useIrpfSummary(year)`, `useUploadIrpfDoc`, `useDeleteIrpfDoc`, `useReclassifyEntry` (optimistic update obrigatório), `useYearSnapshot`.

## Parsing (`src/lib/irpf/`)

- `parseCsv.ts` — usa `papaparse` (já presente via `xlsxParser`? confirmar; senão `bun add papaparse`).
- `parseXlsx.ts` — reaproveita `src/lib/xlsxParser.ts`.
- `parsePdf.ts` — stub no MVP (extrai texto bruto se possível com `pdfjs-dist`; senão registra documento sem entries e avisa).
- `classify.ts` — heurísticas por descrição/regex (palavras-chave: SALARIO/PROVENTOS/PIX RECEBIDO/CDB/IOF/RENDIMENTOS POUPANCA/TED/DOC/transferência entre contas próprias por nome do titular). Saída: `{category, subcategory, confidence}`.
- `crossCheck.ts` — compara `irpf_entries` do ano com `incomes`, `debits`, `installments` do app e gera alertas.

## Cálculo do Resumo

Para o ano selecionado:
- **Tributáveis**: soma de `incomes` recebidos no ano + entries classificadas como `tributavel`.
- **Isentos**: entries `isento` + transferências entre contas próprias detectadas.
- **Exclusiva**: entries `exclusiva` (CDB, LCI/LCA marcados).
- **Bens e Direitos**: para cada `account` → saldo em 31/12 (calculado via `computeAccountBalance` projetado até 31/12 do ano) + cada `investment` (snapshot do ano) + cada item classificado como `bens_direitos`.
- **Dívidas**: parcelas em aberto em 31/12 + entries `dividas`.

## Instruções de Declaração

Mapa estático em `src/lib/irpf/fichas.ts` traduzindo cada subcategoria → `{ficha, grupo, codigo, descricaoTemplate}`. Renderizado por `DeclarationBlock` com botão copiar (clipboard API).

## Alertas (exemplos)

- Recebimento no app sem entry correspondente importada.
- Entry tributável sem `incomes` equivalente.
- Conta sem snapshot de 31/12.
- Investimento sem classificação fiscal.
- Soma divergente entre extrato e movimentações.

## Segurança

- Bucket `irpf-docs` privado, paths `${user_id}/${year}/${uuid}-${filename}`.
- RLS em todas as tabelas (`auth.uid() = user_id`).
- Sem logs de conteúdo de arquivo (só metadata).
- Avisos visíveis: "análise não substitui contador, dados não enviados à Receita".

## Navegação

- Adicionar item "Imposto de Renda" no menu/header existente (verificar `__root.tsx` / index) — só aparece para usuário logado.

## Fora do MVP (fase 2)

- OCR de PDF de informes (Lovable AI vision).
- Importação direta de informes oficiais por banco.
- Simulação de imposto devido / restituição.
- Score de malha fina.

## Entregáveis do MVP

1. Migrations (tabelas + bucket + policies).
2. Rota `/irpf` com 4 tabs funcionais.
3. Upload + listagem + exclusão de documentos.
4. Parser CSV/XLSX + classificação heurística.
5. Resumo com totais por categoria.
6. Blocos de instrução copiáveis.
7. Alertas + checklist baseados em cruzamento com dados do app.
8. Snapshot de saldos 31/12 editável.

Posso seguir com a implementação assim?