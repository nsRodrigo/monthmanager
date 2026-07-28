-- Corrige débitos "recorrentes órfãos": lançamentos com required = true (o
-- que faz a tag "REC" aparecer na lista) mas sem recurrence_group_id
-- preenchido. Sem o group id, o app não consegue tratá-los como série de
-- verdade — ao editar, cai no editor de item avulso (com checkbox
-- "Recorrente" pra *criar* uma série nova) em vez do editor de série
-- recorrente (com escopo de edição, antecipar pagamentos etc).
--
-- Provável causa: dado criado antes de recurrence_group_id existir no
-- schema, ou inserido por fora do fluxo normal do app.
--
-- Estratégia: agrupa por (user_id, account_id, description) — todos os
-- débitos "required" órfãos com a mesma descrição na mesma conta viram uma
-- única série, recebendo um recurrence_group_id novo compartilhado.
WITH orphan_groups AS (
  SELECT DISTINCT user_id, account_id, description, gen_random_uuid() AS new_gid
  FROM public.debits
  WHERE required = true AND recurrence_group_id IS NULL
)
UPDATE public.debits d
SET recurrence_group_id = og.new_gid
FROM orphan_groups og
WHERE d.required = true
  AND d.recurrence_group_id IS NULL
  AND d.user_id = og.user_id
  AND d.account_id = og.account_id
  AND d.description = og.description;
