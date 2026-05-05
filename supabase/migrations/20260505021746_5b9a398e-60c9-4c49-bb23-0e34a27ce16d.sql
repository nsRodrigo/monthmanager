DROP EXTENSION IF EXISTS dblink;
CREATE EXTENSION IF NOT EXISTS dblink WITH SCHEMA app_private;

CREATE OR REPLACE FUNCTION app_private.record_pending_signup(_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
  conn_str text;
BEGIN
  conn_str := 'dbname=' || current_database();
  PERFORM app_private.dblink_exec(
    conn_str,
    format(
      'INSERT INTO public.access_requests (email) VALUES (%L) ON CONFLICT DO NOTHING',
      lower(_email)
    )
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'record_pending_signup failed: %', SQLERRM;
END;
$$;