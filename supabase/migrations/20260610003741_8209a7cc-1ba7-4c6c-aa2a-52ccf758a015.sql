ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS recurrence_group_id uuid;
CREATE INDEX IF NOT EXISTS purchases_recurrence_group_id_idx ON public.purchases(recurrence_group_id);