-- account_access_grants e notifications ficaram de fora da publicação de
-- Realtime nas migrations anteriores — sem isso, mudanças (aprovar um
-- pedido, chegar uma notificação) só apareciam depois de recarregar a
-- página inteira, já que a assinatura via `.channel(...).on("postgres_changes", ...)`
-- nunca recebia nada. Mesmo padrão já usado em `access_requests`/`accounts`/etc.
ALTER TABLE public.account_access_grants REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.account_access_grants;

ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
