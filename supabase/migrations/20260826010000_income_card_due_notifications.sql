-- Estende as notificacoes push de vencimento (ver 20260728000000_due_debit_notifications.sql,
-- hoje so em debits) para recebimentos e faturas de cartao.

ALTER TABLE public.incomes
  ADD COLUMN IF NOT EXISTS notify_days_before integer,
  ADD COLUMN IF NOT EXISTS due_notified_at timestamptz;

COMMENT ON COLUMN public.incomes.notify_days_before IS
  'Quantos dias antes do vencimento (date) o app deve enviar push notification. NULL = desativado para este lancamento.';
COMMENT ON COLUMN public.incomes.due_notified_at IS
  'Timestamp da ultima push notification de vencimento enviada para este recebimento. Usado para nao notificar 2x.';

-- Cartao: aviso de vencimento da fatura. Como o vencimento se repete todo
-- mes (due_day), due_notified_at guarda so a ULTIMA notificacao enviada —
-- o cron compara contra o inicio do mes corrente para saber se already
-- notificou a fatura deste mes (ver /api/cron/notify-due-debits).
ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS notify_days_before integer,
  ADD COLUMN IF NOT EXISTS due_notified_at timestamptz;

COMMENT ON COLUMN public.cards.notify_days_before IS
  'Quantos dias antes do vencimento da fatura (due_day) o app deve enviar push notification. NULL = desativado.';
COMMENT ON COLUMN public.cards.due_notified_at IS
  'Timestamp da ultima notificacao de fatura enviada. Comparado contra o inicio do mes corrente para permitir 1 aviso por fatura/mes.';
