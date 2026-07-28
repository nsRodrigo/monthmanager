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

-- Guarda a URL do app e o segredo do cron como configuracao do banco, para
-- nao hardcodar segredo em texto plano dentro da migration (fica em
-- ALTER DATABASE ... SET, roda uma vez soh, fora do arquivo versionado).
-- IMPORTANTE (passo manual): antes/depois de aplicar esta migration, rode no
-- SQL editor do Supabase (substituindo pelos valores reais):
--
--   ALTER DATABASE postgres SET app.settings.cron_url = 'https://SEU-DOMINIO/api/cron/notify-due-debits';
--   ALTER DATABASE postgres SET app.settings.cron_secret = 'UM-SEGREDO-LONGO-ALEATORIO';
--
-- E configure a mesma string em CRON_SECRET nas variaveis de ambiente do
-- deploy do app (mesmo lugar onde SUPABASE_SERVICE_ROLE_KEY/VAPID_* estao
-- configurados hoje).

SELECT cron.unschedule('notify-due-debits-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify-due-debits-daily');

SELECT cron.schedule(
  'notify-due-debits-daily',
  '0 12 * * *', -- 12:00 UTC todo dia — ajuste o horario conforme preferir
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.cron_url', true),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.settings.cron_secret', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
