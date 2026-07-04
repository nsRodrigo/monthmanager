
ALTER TABLE public.debits ADD COLUMN IF NOT EXISTS reference_year int;
ALTER TABLE public.debits ADD COLUMN IF NOT EXISTS reference_month int;
ALTER TABLE public.incomes ADD COLUMN IF NOT EXISTS reference_year int;
ALTER TABLE public.incomes ADD COLUMN IF NOT EXISTS reference_month int;

-- Backfill existing rows from the date field (month is 0-11 to match app convention).
UPDATE public.debits
SET reference_year = EXTRACT(YEAR FROM date)::int,
    reference_month = EXTRACT(MONTH FROM date)::int - 1
WHERE reference_year IS NULL OR reference_month IS NULL;

UPDATE public.incomes
SET reference_year = EXTRACT(YEAR FROM date)::int,
    reference_month = EXTRACT(MONTH FROM date)::int - 1
WHERE reference_year IS NULL OR reference_month IS NULL;

CREATE INDEX IF NOT EXISTS idx_debits_ref_ym ON public.debits(user_id, reference_year, reference_month);
CREATE INDEX IF NOT EXISTS idx_incomes_ref_ym ON public.incomes(user_id, reference_year, reference_month);
