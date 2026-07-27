-- Per-installment visual date override (P7-P9 scope: "só esta" / "esta e as
-- próximas" / "toda a conta"). NULL means "use the parent's shared date"
-- (purchases.purchase_date / debits.date / incomes.date) — the existing,
-- default behavior for every row created before this migration.
-- IMPORTANT: this column is a VISUAL reference only, same as due_date is
-- for month grouping — it must never be read as determining which month an
-- installment belongs to (that stays due_date/year/month).
ALTER TABLE public.installments ADD COLUMN IF NOT EXISTS reference_date date;

-- User-facing audit trail for scoped value adjustments on parcelados
-- (P10-P12): "valor original -> ajustado para". Distinct from the
-- session-only undo/redo history in src/store/history.ts.
CREATE TABLE IF NOT EXISTS public.amount_adjustments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  parent_type text NOT NULL,
  parent_id uuid NOT NULL,
  previous_total numeric(12,2) NOT NULL,
  new_total numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_amount_adjustments_parent
  ON public.amount_adjustments (parent_type, parent_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.amount_adjustments TO authenticated;
GRANT ALL ON public.amount_adjustments TO service_role;

ALTER TABLE public.amount_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own amount adjustments"
  ON public.amount_adjustments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own amount adjustments"
  ON public.amount_adjustments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own amount adjustments"
  ON public.amount_adjustments FOR DELETE
  USING (auth.uid() = user_id);
