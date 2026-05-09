-- Snapshots table
CREATE TABLE public.app_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'manual',
  label text NOT NULL DEFAULT '',
  year_month text,
  data jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_app_snapshots_user_created ON public.app_snapshots (user_id, created_at DESC);
CREATE INDEX idx_app_snapshots_user_ym ON public.app_snapshots (user_id, kind, year_month);

ALTER TABLE public.app_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own snapshots select" ON public.app_snapshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own snapshots insert" ON public.app_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own snapshots delete" ON public.app_snapshots FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "own snapshots update" ON public.app_snapshots FOR UPDATE USING (auth.uid() = user_id);

-- Realtime: enable for financial tables
ALTER TABLE public.accounts REPLICA IDENTITY FULL;
ALTER TABLE public.cards REPLICA IDENTITY FULL;
ALTER TABLE public.purchases REPLICA IDENTITY FULL;
ALTER TABLE public.installments REPLICA IDENTITY FULL;
ALTER TABLE public.debits REPLICA IDENTITY FULL;
ALTER TABLE public.incomes REPLICA IDENTITY FULL;
ALTER TABLE public.investments REPLICA IDENTITY FULL;
ALTER TABLE public.card_payments REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.purchases;
ALTER PUBLICATION supabase_realtime ADD TABLE public.installments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.debits;
ALTER PUBLICATION supabase_realtime ADD TABLE public.incomes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.investments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.card_payments;