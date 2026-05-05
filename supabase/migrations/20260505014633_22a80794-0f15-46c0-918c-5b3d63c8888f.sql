
-- access_requests
CREATE TABLE public.access_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  CONSTRAINT access_requests_status_check CHECK (status IN ('pending','approved','rejected'))
);
CREATE UNIQUE INDEX access_requests_email_pending_uidx
  ON public.access_requests (lower(email)) WHERE status = 'pending';

ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin select access_requests" ON public.access_requests
  FOR SELECT USING (app_private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin update access_requests" ON public.access_requests
  FOR UPDATE USING (app_private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin delete access_requests" ON public.access_requests
  FOR DELETE USING (app_private.has_role(auth.uid(), 'admin'::app_role));

-- blacklist
CREATE TABLE public.blacklist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);
ALTER TABLE public.blacklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all blacklist" ON public.blacklist
  FOR ALL USING (app_private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.is_email_blacklisted(_email TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.blacklist WHERE lower(email) = lower(_email)) $$;

-- push_subscriptions (admin devices)
CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own push select" ON public.push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own push insert" ON public.push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own push delete" ON public.push_subscriptions
  FOR DELETE USING (auth.uid() = user_id);

-- Update signup trigger: pending request flow
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

  IF public.is_email_blacklisted(NEW.email) THEN
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
