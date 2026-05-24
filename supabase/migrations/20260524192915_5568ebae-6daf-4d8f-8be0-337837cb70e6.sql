ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS position integer;

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY account_id ORDER BY created_at) AS rn
  FROM public.cards
)
UPDATE public.cards c SET position = r.rn FROM ranked r WHERE c.id = r.id AND c.position IS NULL;

ALTER TABLE public.cards ALTER COLUMN position SET DEFAULT 0;
ALTER TABLE public.cards ALTER COLUMN position SET NOT NULL;
CREATE INDEX IF NOT EXISTS cards_account_position_idx ON public.cards(account_id, position);