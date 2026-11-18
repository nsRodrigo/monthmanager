-- Posição manual (arrastar na lista) para débitos, recebimentos,
-- investimentos e compras — igual ao que "cards" já tem. Nullable: NULL
-- significa "nunca reordenado manualmente", caindo na ordem padrão por data
-- (ver `debitsDefaultOrder`/`incomesDefaultOrder`/`investmentsDefaultOrder`
-- em contas.$contaId_.$ano.$mes.tsx). Ao primeiro drag numa lista, todos os
-- itens dessa lista recebem uma posição definitiva (ver useReorderEntries).
ALTER TABLE public.debits ADD COLUMN IF NOT EXISTS position integer;
ALTER TABLE public.incomes ADD COLUMN IF NOT EXISTS position integer;
ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS position integer;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS position integer;
