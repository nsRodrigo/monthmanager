CREATE SCHEMA IF NOT EXISTS app_private;

REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
GRANT USAGE ON SCHEMA app_private TO authenticated;

CREATE OR REPLACE FUNCTION app_private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION app_private.is_email_whitelisted(_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.whitelist WHERE lower(email) = lower(_email))
$$;

REVOKE ALL ON FUNCTION app_private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.has_role(uuid, public.app_role) TO authenticated;

REVOKE ALL ON FUNCTION app_private.is_email_whitelisted(text) FROM PUBLIC;

DROP POLICY IF EXISTS "users read own roles" ON public.user_roles;
DROP POLICY IF EXISTS "admin manage roles insert" ON public.user_roles;
DROP POLICY IF EXISTS "admin manage roles update" ON public.user_roles;
DROP POLICY IF EXISTS "admin manage roles delete" ON public.user_roles;

CREATE POLICY "users read own roles"
ON public.user_roles
FOR SELECT
USING ((auth.uid() = user_id) OR app_private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admin manage roles insert"
ON public.user_roles
FOR INSERT
WITH CHECK (app_private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admin manage roles update"
ON public.user_roles
FOR UPDATE
USING (app_private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admin manage roles delete"
ON public.user_roles
FOR DELETE
USING (app_private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admin select whitelist" ON public.whitelist;
DROP POLICY IF EXISTS "admin insert whitelist" ON public.whitelist;
DROP POLICY IF EXISTS "admin update whitelist" ON public.whitelist;
DROP POLICY IF EXISTS "admin delete whitelist" ON public.whitelist;

CREATE POLICY "admin select whitelist"
ON public.whitelist
FOR SELECT
USING (app_private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admin insert whitelist"
ON public.whitelist
FOR INSERT
WITH CHECK (app_private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admin update whitelist"
ON public.whitelist
FOR UPDATE
USING (app_private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admin delete whitelist"
ON public.whitelist
FOR DELETE
USING (app_private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.enforce_whitelist_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $function$
DECLARE
  total_users int;
BEGIN
  SELECT count(*) INTO total_users FROM auth.users;
  IF total_users <= 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
      ON CONFLICT DO NOTHING;
    INSERT INTO public.whitelist (email, created_by) VALUES (NEW.email, NEW.id)
      ON CONFLICT DO NOTHING;
    RETURN NEW;
  END IF;

  IF NOT app_private.is_email_whitelisted(NEW.email) THEN
    RAISE EXCEPTION 'Email % não está autorizado a se cadastrar.', NEW.email
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
    ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;
REVOKE ALL ON FUNCTION public.is_email_whitelisted(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_email_whitelisted(text) FROM anon;
REVOKE ALL ON FUNCTION public.is_email_whitelisted(text) FROM authenticated;