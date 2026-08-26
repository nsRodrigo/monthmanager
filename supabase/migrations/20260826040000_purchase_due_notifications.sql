-- Notificacao de vencimento tambem para compras recorrentes no cartao
-- (assinaturas). Nao se aplica a compras parceladas nem a vista — so faz
-- sentido pra quem se repete todo mes sem data de vencimento fixa previa.

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS notify_days_before integer,
  ADD COLUMN IF NOT EXISTS due_notified_at timestamptz;

COMMENT ON COLUMN public.purchases.notify_days_before IS
  'Quantos dias antes do vencimento (purchase_date) o app deve enviar push notification. So usado em compras recorrentes. NULL = desativado.';
COMMENT ON COLUMN public.purchases.due_notified_at IS
  'Timestamp da ultima notificacao de vencimento enviada para esta compra. Usado para nao notificar 2x.';
