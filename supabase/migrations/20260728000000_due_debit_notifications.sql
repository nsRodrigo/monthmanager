-- Notificacoes push de debitos a vencer.
--
-- Cada debito pode ter sua propria antecedencia de aviso (em dias), definida
-- pelo usuario no momento de criar/editar o lancamento. NULL = sem
-- notificacao para esse item. `due_notified_at` evita reenviar a mesma
-- notificacao todo dia enquanto o debito continuar nao pago dentro da janela.
ALTER TABLE public.debits
  ADD COLUMN IF NOT EXISTS notify_days_before integer,
  ADD COLUMN IF NOT EXISTS due_notified_at timestamptz;

COMMENT ON COLUMN public.debits.notify_days_before IS
  'Quantos dias antes do vencimento (date) o app deve enviar push notification. NULL = desativado para este lancamento.';
COMMENT ON COLUMN public.debits.due_notified_at IS
  'Timestamp da ultima push notification de vencimento enviada para este debito. Usado para nao notificar 2x.';

-- Extensoes necessarias para o cron chamar o endpoint HTTP do app.
-- Em alguns planos/projetos Supabase, pg_cron so pode ser habilitado pelo
-- Dashboard (Database > Extensions) -- se o CREATE EXTENSION abaixo falhar
-- com "permission denied", habilite por la e rode soh a parte do cron.schedule.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- IMPORTANTE (passo manual, fora deste arquivo): projetos Supabase
-- gerenciados NAO permitem "ALTER DATABASE ... SET app.settings.*"
-- (permission denied to set parameter), entao a URL/segredo do cron nao dao
-- pra guardar como configuracao do banco. Em vez disso, rode o
-- cron.schedule abaixo direto no SQL editor, com os valores reais
-- (URL de producao e o mesmo CRON_SECRET configurado nas env vars do
-- deploy) substituindo os placeholders — NAO commite essa versao com os
-- valores reais.
--
--   SELECT cron.unschedule('notify-due-debits-daily')
--   WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify-due-debits-daily');
--
--   SELECT cron.schedule(
--     'notify-due-debits-daily',
--     '0 12 * * *', -- 12:00 UTC todo dia — ajuste o horario conforme preferir
--     $cron$
--     SELECT net.http_post(
--       url := 'https://SEU-DOMINIO/api/cron/notify-due-debits',
--       headers := jsonb_build_object(
--         'Content-Type', 'application/json',
--         'x-cron-secret', 'MESMO-VALOR-DO-CRON_SECRET'
--       ),
--       body := '{}'::jsonb
--     );
--     $cron$
--   );
