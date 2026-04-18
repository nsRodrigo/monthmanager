-- Cards
CREATE TABLE public.cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#8b5cf6',
  closing_day INT NOT NULL DEFAULT 25,
  due_day INT NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cards select" ON public.cards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own cards insert" ON public.cards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own cards update" ON public.cards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own cards delete" ON public.cards FOR DELETE USING (auth.uid() = user_id);

-- Purchases
CREATE TABLE public.purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL,
  purchase_date DATE NOT NULL,
  installments_count INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own purchases select" ON public.purchases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own purchases insert" ON public.purchases FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own purchases update" ON public.purchases FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own purchases delete" ON public.purchases FOR DELETE USING (auth.uid() = user_id);

-- Installments (independent records)
CREATE TABLE public.installments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  number INT NOT NULL,
  total INT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  due_date DATE NOT NULL,
  year INT NOT NULL,
  month INT NOT NULL,
  paid BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own installments select" ON public.installments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own installments insert" ON public.installments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own installments update" ON public.installments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own installments delete" ON public.installments FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_installments_user_year_month ON public.installments(user_id, year, month);
CREATE INDEX idx_installments_purchase ON public.installments(purchase_id);

-- Debits
CREATE TABLE public.debits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  date DATE NOT NULL,
  required BOOLEAN NOT NULL DEFAULT false,
  paid BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.debits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own debits select" ON public.debits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own debits insert" ON public.debits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own debits update" ON public.debits FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own debits delete" ON public.debits FOR DELETE USING (auth.uid() = user_id);

-- Incomes
CREATE TABLE public.incomes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  date DATE NOT NULL,
  received BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.incomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own incomes select" ON public.incomes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own incomes insert" ON public.incomes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own incomes update" ON public.incomes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own incomes delete" ON public.incomes FOR DELETE USING (auth.uid() = user_id);

-- Investments
CREATE TABLE public.investments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  percentage NUMERIC(6,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own investments select" ON public.investments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own investments insert" ON public.investments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own investments update" ON public.investments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own investments delete" ON public.investments FOR DELETE USING (auth.uid() = user_id);

-- Wallet (1 row per user)
CREATE TABLE public.wallet (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wallet ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own wallet select" ON public.wallet FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own wallet insert" ON public.wallet FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own wallet update" ON public.wallet FOR UPDATE USING (auth.uid() = user_id);

-- Card payments (manual override)
CREATE TABLE public.card_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  year INT NOT NULL,
  month INT NOT NULL,
  paid BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(card_id, year, month)
);
ALTER TABLE public.card_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cp select" ON public.card_payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own cp insert" ON public.card_payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own cp update" ON public.card_payments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own cp delete" ON public.card_payments FOR DELETE USING (auth.uid() = user_id);