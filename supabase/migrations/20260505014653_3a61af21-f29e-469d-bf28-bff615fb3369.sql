
DROP FUNCTION IF EXISTS public.is_email_blacklisted(TEXT);

CREATE OR REPLACE FUNCTION app_private.is_email_blacklisted(_email TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.blacklist WHERE lower(email) = lower(_email)) $$;

CREATE OR REPLACE FUNCTION public.enforce_whitelist_on_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','app_private'
AS $function$
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
    INSERT INTO public.access_requests (email)
      VALUES (NEW.email)
      ON CONFLICT DO NOTHING;
    RAISE EXCEPTION 'PENDING_APPROVAL: %', NEW.email USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$function$;
