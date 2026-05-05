-- Habilita dblink para gravar access_requests fora da transação do signup
CREATE EXTENSION IF NOT EXISTS dblink;

-- Função auxiliar: registra a solicitação numa conexão separada (sobrevive ao rollback)
CREATE OR REPLACE FUNCTION app_private.record_pending_signup(_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
  conn_str text;
BEGIN
  -- Conexão local via socket unix do próprio Postgres
  conn_str := 'dbname=' || current_database();
  PERFORM dblink_exec(
    conn_str,
    format(
      'INSERT INTO public.access_requests (email) VALUES (%L) ON CONFLICT DO NOTHING',
      lower(_email)
    )
  );
EXCEPTION WHEN OTHERS THEN
  -- Não queremos que falha de log atrapalhe o bloqueio do signup
  RAISE NOTICE 'record_pending_signup failed: %', SQLERRM;
END;
$$;

-- Atualiza o trigger para usar a função autônoma
CREATE OR REPLACE FUNCTION public.enforce_whitelist_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
  total_users int;
BEGIN
  SELECT count(*) INTO total_users FROM auth.users;
  IF total_users <= 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
    INSERT INTO public.whitelist (email, created_by) VALUES (NEW.email, NEW.id) ON CONFLICT DO NOTHING;
    RETURN NEW;
  END IF;

  IF app_private.is_email_blacklisted(NEW.email) THEN
    RAISE EXCEPTION 'Email % bloqueado.', NEW.email USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT app_private.is_email_whitelisted(NEW.email) THEN
    -- Persiste fora da transação para sobreviver ao rollback do RAISE
    PERFORM app_private.record_pending_signup(NEW.email);
    RAISE EXCEPTION 'PENDING_APPROVAL: %', NEW.email USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;