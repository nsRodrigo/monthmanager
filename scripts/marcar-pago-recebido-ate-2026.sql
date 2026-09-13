-- Script manual de atualização em massa — NÃO é uma migration, não roda
-- automaticamente via `supabase db push`. Rode direto no SQL Editor do
-- Supabase Dashboard, um bloco de cada vez.
--
-- Objetivo: marcar como pago/recebido tudo com data/vencimento ANTES de
-- 01/01/2026, pra não precisar ir lançamento por lançamento desde 2014.

-- ============================================================
-- 1) Descubra seu user_id (rode sozinho e copie o resultado)
-- ============================================================
select id, email from auth.users where email = 'rodrigo.nascim.silva@gmail.com';

-- ============================================================
-- 2) Prévia — NÃO altera nada, só conta quantos registros seriam afetados.
-- Substitua 'b8e6bc2d-45d0-4ff4-a5d3-804153d667ca' pelo UUID do passo 1 antes de rodar.
-- ============================================================
select
  (select count(*) from public.debits where user_id='b8e6bc2d-45d0-4ff4-a5d3-804153d667ca' and is_parent=false and paid=false and date<'2026-01-01') as debitos_a_marcar,
  (select count(*) from public.incomes where user_id='b8e6bc2d-45d0-4ff4-a5d3-804153d667ca' and is_parent=false and received=false and date<'2026-01-01') as recebimentos_a_marcar,
  (select count(*) from public.installments where user_id='b8e6bc2d-45d0-4ff4-a5d3-804153d667ca' and paid=false and due_date<'2026-01-01') as parcelas_a_marcar;

-- ============================================================
-- 3) Atualização em massa (substitua 'b8e6bc2d-45d0-4ff4-a5d3-804153d667ca' antes de rodar)
-- ============================================================
begin;

-- Débitos avulsos (não parcelados/recorrentes)
update public.debits
set paid = true
where user_id = 'b8e6bc2d-45d0-4ff4-a5d3-804153d667ca'
  and is_parent = false
  and paid = false
  and date < '2026-01-01';

-- Recebimentos avulsos (não parcelados/recorrentes)
update public.incomes
set received = true
where user_id = 'b8e6bc2d-45d0-4ff4-a5d3-804153d667ca'
  and is_parent = false
  and received = false
  and date < '2026-01-01';

-- Parcelas/recorrências: compras de cartão, débitos, recebimentos e investimentos parcelados
update public.installments
set paid = true
where user_id = 'b8e6bc2d-45d0-4ff4-a5d3-804153d667ca'
  and paid = false
  and due_date < '2026-01-01';

-- Faturas de cartão (fonte de verdade própria, separada das parcelas)
insert into public.card_payments (user_id, card_id, year, month, paid)
select distinct i.user_id, p.card_id, i.year, i.month, true
from public.installments i
join public.purchases p on p.id = i.parent_id
where i.parent_type = 'purchase'
  and i.user_id = 'b8e6bc2d-45d0-4ff4-a5d3-804153d667ca'
  and i.due_date < '2026-01-01'
on conflict (card_id, year, month) do update set paid = true;

commit;

-- ============================================================
-- 4) Verificação — rode de novo a query do passo 2.
-- Os três contadores devem voltar zerados.
-- ============================================================
