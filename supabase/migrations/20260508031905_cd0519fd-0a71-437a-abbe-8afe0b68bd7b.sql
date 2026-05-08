ALTER TABLE public.cards 
  ADD COLUMN IF NOT EXISTS start_year integer,
  ADD COLUMN IF NOT EXISTS start_month integer,
  ADD COLUMN IF NOT EXISTS end_year integer,
  ADD COLUMN IF NOT EXISTS end_month integer;