-- "Meio de pagamento" — campo independente da frequencia (a vista/parcelado/
-- recorrente). Substitui o antigo booleano debits.auto_debit, que era so uma
-- etiqueta (nao gerava serie recorrente) — agora vira mais um valor de
-- payment_method, junto com 'pix'.

ALTER TABLE public.debits
  ADD COLUMN IF NOT EXISTS payment_method text;

UPDATE public.debits SET payment_method = 'auto_debit' WHERE auto_debit = true;

ALTER TABLE public.debits DROP COLUMN IF EXISTS auto_debit;

COMMENT ON COLUMN public.debits.payment_method IS
  'Meio de pagamento opcional: ''pix'' | ''auto_debit'' | NULL (padrao/cartao de debito/dinheiro).';

ALTER TABLE public.incomes
  ADD COLUMN IF NOT EXISTS payment_method text;

COMMENT ON COLUMN public.incomes.payment_method IS
  'Meio de pagamento opcional: ''pix'' | NULL (padrao).';
