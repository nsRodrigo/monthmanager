
CREATE TABLE public.recurring_deletions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  recurrence_group_id uuid NOT NULL,
  year int NOT NULL,
  month int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, recurrence_group_id, year, month)
);

CREATE INDEX idx_recurring_deletions_lookup
  ON public.recurring_deletions (user_id, recurrence_group_id, year, month);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_deletions TO authenticated;
GRANT ALL ON public.recurring_deletions TO service_role;

ALTER TABLE public.recurring_deletions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own recurring deletions"
  ON public.recurring_deletions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own recurring deletions"
  ON public.recurring_deletions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recurring deletions"
  ON public.recurring_deletions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recurring deletions"
  ON public.recurring_deletions FOR DELETE
  USING (auth.uid() = user_id);
