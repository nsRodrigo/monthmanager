-- ============================================================
-- WIPE EXISTING DATA (user chose to start fresh)
-- ============================================================
DELETE FROM public.installments;
DELETE FROM public.card_payments;
DELETE FROM public.purchases;
DELETE FROM public.debits;
DELETE FROM public.incomes;
DELETE FROM public.investments;
DELETE FROM public.cards;
DELETE FROM public.wallet;

-- ============================================================
-- ACCOUNTS TABLE — origem do dinheiro
-- ============================================================
CREATE TABLE public.accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'corrente', -- corrente | digital | carteira | investimento
  color TEXT NOT NULL DEFAULT '#8b5cf6',
  initial_balance NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own accounts select" ON public.accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own accounts insert" ON public.accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own accounts update" ON public.accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own accounts delete" ON public.accounts FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- ADD account_id TO ALL ENTITIES
-- ============================================================
ALTER TABLE public.cards ADD COLUMN account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE public.debits ADD COLUMN account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE public.incomes ADD COLUMN account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE public.investments ADD COLUMN account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE;

CREATE INDEX idx_cards_account ON public.cards(account_id);
CREATE INDEX idx_debits_account ON public.debits(account_id);
CREATE INDEX idx_incomes_account ON public.incomes(account_id);
CREATE INDEX idx_investments_account ON public.investments(account_id);

-- ============================================================
-- DROP wallet (replaced by per-account balance)
-- ============================================================
DROP TABLE public.wallet;