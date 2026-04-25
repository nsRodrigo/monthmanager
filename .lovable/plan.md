
## Objetivo

Cada linha do CSV com `numero_parcela` preenchido vira **uma compra completa** com **todas as N parcelas** distribuídas mês a mês, onde:
- A parcela `numero_parcela` cai no mês de `data_vencimento` (ou `data_compra` se ausente).
- Parcelas anteriores (1 até `numero_parcela - 1`) são geradas em meses anteriores e marcadas como **pagas**.
- Parcelas posteriores são geradas em meses futuros, não pagas.
- Status pode ser ajustado manualmente depois pelo usuário (toggle de pago já existe).

---

## Mudanças

### 1. `src/store/finance.ts`

**Adicionar função `buildInstallmentsAnchored`** (após `buildInstallmentsForPurchase`, linha ~229):

```typescript
export function buildInstallmentsAnchored(
  purchaseId: string,
  userId: string,
  totalAmount: number,
  installmentsCount: number,
  anchorNumber: number,
  anchorDate: string, // data_vencimento OU data_compra
) {
  const count = Math.max(1, installmentsCount);
  const anchor = Math.min(Math.max(1, anchorNumber), count);
  const base = round2(totalAmount / count);
  const anchorD = new Date(anchorDate);
  const anchorYear = anchorD.getFullYear();
  const anchorMonth = anchorD.getMonth();
  const anchorDay = anchorD.getDate();
  let accum = 0;
  const items = [];
  for (let i = 1; i <= count; i++) {
    const monthOffset = i - anchor;
    const target = new Date(anchorYear, anchorMonth + monthOffset, 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    const day = Math.min(anchorDay, lastDay);
    const d = new Date(target.getFullYear(), target.getMonth(), day);
    const amount = i === count ? round2(totalAmount - accum) : base;
    accum += amount;
    items.push({
      user_id: userId,
      parent_id: purchaseId,
      parent_type: "purchase" as const,
      purchase_id: purchaseId,
      number: i,
      total: count,
      amount,
      due_date: d.toISOString().slice(0, 10),
      year: d.getFullYear(),
      month: d.getMonth(),
      paid: i < anchor, // anteriores = pagas automaticamente
    });
  }
  return items;
}
```

**Reescrever `useImportPurchases`** (linhas 900-975) — remove agrupamento; cada linha = 1 compra:

```typescript
export function useImportPurchases() {
  const { user } = useAuth();
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (rows: ImportedRow[]) => {
      for (const r of rows) {
        const { data: pIns, error: e1 } = await supabase
          .from("purchases")
          .insert({
            user_id: user!.id,
            card_id: r.cardId,
            description: r.description,
            total_amount: r.totalAmount,
            purchase_date: r.purchaseDate,
            installments_count: r.installmentsCount,
          })
          .select("id")
          .single();
        if (e1) throw e1;
        const purchaseId = (pIns as { id: string }).id;

        if (r.installmentNumber && r.installmentsCount > 1) {
          // Modo âncora: data_vencimento (preferida) ou data_compra
          const anchorDate = r.installmentDueDate ?? r.purchaseDate;
          const inst = buildInstallmentsAnchored(
            purchaseId,
            user!.id,
            r.totalAmount,
            r.installmentsCount,
            r.installmentNumber,
            anchorDate,
          );
          // Status do CSV aplica-se à parcela âncora (sobrescreve default não-pago)
          if (r.paid) {
            const a = inst.find((x) => x.number === r.installmentNumber);
            if (a) a.paid = true;
          }
          const { error: e2 } = await supabase.from("installments").insert(inst);
          if (e2) throw e2;
        } else {
          // Sem numero_parcela ou parcela única: usa cálculo clássico por fechamento/vencimento do cartão
          const { data: cardRow } = await supabase
            .from("cards")
            .select("closing_day,due_day")
            .eq("id", r.cardId)
            .single();
          const closingDay = (cardRow as { closing_day?: number } | null)?.closing_day ?? 25;
          const dueDay = (cardRow as { due_day?: number } | null)?.due_day ?? 5;
          const inst = buildInstallmentsForPurchase(
            purchaseId,
            user!.id,
            r.totalAmount,
            r.installmentsCount,
            r.purchaseDate,
            closingDay,
            dueDay,
          );
          if (r.paid) inst.forEach((i) => (i.paid = true));
          const { error: e2 } = await supabase.from("installments").insert(inst);
          if (e2) throw e2;
        }
      }
    },
    onSuccess: () => inv(["purchases", "installments", "card_payments"]),
  });
}
```

### 2. `src/routes/importar.tsx`

- **Atualizar bloco "Formato esperado"** explicando o modo linha-âncora:
  - 1 linha = 1 compra completa.
  - `numero_parcela` = posição da parcela atual no calendário (anteriores marcadas como pagas).
  - `data_vencimento` ancora o mês da parcela atual; se ausente, usa `data_compra`.
  - Status do CSV aplica-se à parcela âncora; demais ajustáveis manualmente.
- **Atualizar `downloadSample`** com 1 linha por compra (não mais várias linhas para a mesma compra).
- **Atualizar badge** "Modo: parcelas detalhadas" → "Modo: linha-âncora (gera N parcelas por linha)".

### 3. Tipo `ImportedRow`

Permanece igual — `installmentAmount` deixa de ser usado (sempre dividimos `total / count`), mas mantemos o campo no tipo para não quebrar o parse atual.

---

## Validação esperada

Para o CSV enviado pelo usuário (parcela 5/12 de "Shopee - Bestway Piscina", `data_vencimento=2026-05-01`):
- Parcela 5 → maio/2026 (não paga)
- Parcelas 1-4 → jan, fev, mar, abr/2026 (pagas automaticamente)
- Parcelas 6-12 → jun/2026 a dez/2026 (não pagas)

Para "Entrada Sem Juros | Zontes" (10/10, `data_vencimento=2026-05-01`):
- Parcela 10 → maio/2026
- Parcelas 1-9 → ago/2025 a abr/2026 (pagas)

---

## Dados existentes

Conforme escolhido (Opção A): **não tocamos em dados anteriores**. Antes de re-importar o mesmo CSV, apague manualmente as compras incompletas dos imports anteriores (nas telas de cartão/mês) para evitar duplicatas.
