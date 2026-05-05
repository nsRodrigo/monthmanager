-- Whitelist + roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.whitelist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
ALTER TABLE public.whitelist ENABLE ROW LEVEL SECURITY;

-- Security definer to check role without recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
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

CREATE OR REPLACE FUNCTION public.is_email_whitelisted(_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.whitelist WHERE lower(email) = lower(_email))
$$;

-- RLS user_roles: usuário lê suas próprias roles; admin lê/gerencia tudo
CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manage roles insert" ON public.user_roles
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manage roles update" ON public.user_roles
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manage roles delete" ON public.user_roles
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- RLS whitelist: somente admin
CREATE POLICY "admin select whitelist" ON public.whitelist
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin insert whitelist" ON public.whitelist
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin update whitelist" ON public.whitelist
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete whitelist" ON public.whitelist
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Trigger: bloqueia signup se email não estiver na whitelist;
-- primeiro usuário registrado vira admin automaticamente.
CREATE OR REPLACE FUNCTION public.enforce_whitelist_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_users int;
BEGIN
  SELECT count(*) INTO total_users FROM auth.users;
  -- primeiro usuário sempre permitido (vira admin)
  IF total_users <= 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
      ON CONFLICT DO NOTHING;
    INSERT INTO public.whitelist (email, created_by) VALUES (NEW.email, NEW.id)
      ON CONFLICT DO NOTHING;
    RETURN NEW;
  END IF;

  IF NOT public.is_email_whitelisted(NEW.email) THEN
    RAISE EXCEPTION 'Email % não está autorizado a se cadastrar.', NEW.email
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
    ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_whitelist_on_signup ON auth.users;
CREATE TRIGGER enforce_whitelist_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_whitelist_on_signup();