-- Traz Investimento para paridade com Debito/Recebimento: parcelado e
-- recorrente, usando o mesmo mecanismo (installments_count/is_parent/
-- recurrence_group_id/reference_year/reference_month + linhas em
-- `installments` com parent_type = 'investment').

ALTER TABLE public.investments
  ADD COLUMN IF NOT EXISTS installments_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_parent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_group_id uuid,
  ADD COLUMN IF NOT EXISTS reference_year integer,
  ADD COLUMN IF NOT EXISTS reference_month integer;

-- A funcao de restauracao de backup (20260512020253) ja tratava 'investment'
-- como parent_type valido, mas a constraint original (20260419000623) nunca
-- foi atualizada para permitir esse valor — corrige a inconsistencia.
ALTER TABLE public.installments DROP CONSTRAINT IF EXISTS installments_parent_type_check;
ALTER TABLE public.installments
  ADD CONSTRAINT installments_parent_type_check CHECK (parent_type IN ('purchase','debit','income','investment'));
