-- 1) Extend installments to support purchase/debit/income parents
ALTER TABLE public.installments
  ADD COLUMN IF NOT EXISTS parent_type text NOT NULL DEFAULT 'purchase',
  ADD COLUMN IF NOT EXISTS parent_id uuid;

-- Backfill parent_id from purchase_id for existing rows
UPDATE public.installments
SET parent_id = purchase_id
WHERE parent_id IS NULL AND purchase_id IS NOT NULL;

-- Make purchase_id nullable (debit/income installments won't have it)
ALTER TABLE public.installments ALTER COLUMN purchase_id DROP NOT NULL;

-- Constraint: parent_id required, parent_type bounded
ALTER TABLE public.installments
  ADD CONSTRAINT installments_parent_id_required CHECK (parent_id IS NOT NULL),
  ADD CONSTRAINT installments_parent_type_check CHECK (parent_type IN ('purchase','debit','income'));

CREATE INDEX IF NOT EXISTS idx_installments_parent ON public.installments(parent_id, parent_type);
CREATE INDEX IF NOT EXISTS idx_installments_year_month ON public.installments(year, month);

-- 2) Extend debits with auto-debit + installment metadata
ALTER TABLE public.debits
  ADD COLUMN IF NOT EXISTS auto_debit boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_debit_day integer,
  ADD COLUMN IF NOT EXISTS installments_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_parent boolean NOT NULL DEFAULT false;

-- 3) Extend incomes with installment metadata
ALTER TABLE public.incomes
  ADD COLUMN IF NOT EXISTS installments_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_parent boolean NOT NULL DEFAULT false;