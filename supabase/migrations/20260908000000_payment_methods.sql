-- Meios de pagamento personalizados — complementam os 6 fixos do código
-- (Pix, Débito automático, Boleto, Transferência, Dinheiro, Cartão de
-- débito). Guardados como texto livre; o campo `debits.payment_method` /
-- `incomes.payment_method` já é TEXT sem CHECK, então armazenar o `id`
-- (uuid) de um meio personalizado ali funciona sem migração adicional —
-- só não ganha o badge/comportamento especial dos fixos (ex.: auto_debit).
CREATE TABLE public.payment_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own payment_methods select" ON public.payment_methods FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own payment_methods insert" ON public.payment_methods FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own payment_methods update" ON public.payment_methods FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own payment_methods delete" ON public.payment_methods FOR DELETE USING (auth.uid() = user_id);
