-- ============================================================
-- BOOTSTRAP COMPLETO DO SCHEMA — monthmanager
-- Gerado em 2026-07-26 concatenando TODAS as migrations de
-- supabase/migrations/, na ordem cronologica, para colar de
-- uma vez so no SQL Editor de um projeto Supabase NOVO/VAZIO.
-- NAO rode isso num projeto que ja tem essas tabelas -- use
-- as migrations individuais (ADD COLUMN IF NOT EXISTS etc.)
-- para um projeto ja existente.
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- Origem: 20260418174541_8ece78c7-72b0-4126-9f26-82a482aa50e6.sql
-- ──────────────────────────────────────────────────────────
-- Cards
CREATE TABLE public.cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#8b5cf6',
  closing_day INT NOT NULL DEFAULT 25,
  due_day INT NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cards select" ON public.cards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own cards insert" ON public.cards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own cards update" ON public.cards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own cards delete" ON public.cards FOR DELETE USING (auth.uid() = user_id);

-- Purchases
CREATE TABLE public.purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL,
  purchase_date DATE NOT NULL,
  installments_count INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own purchases select" ON public.purchases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own purchases insert" ON public.purchases FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own purchases update" ON public.purchases FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own purchases delete" ON public.purchases FOR DELETE USING (auth.uid() = user_id);

-- Installments (independent records)
CREATE TABLE public.installments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  number INT NOT NULL,
  total INT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  due_date DATE NOT NULL,
  year INT NOT NULL,
  month INT NOT NULL,
  paid BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own installments select" ON public.installments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own installments insert" ON public.installments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own installments update" ON public.installments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own installments delete" ON public.installments FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_installments_user_year_month ON public.installments(user_id, year, month);
CREATE INDEX idx_installments_purchase ON public.installments(purchase_id);

-- Debits
CREATE TABLE public.debits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  date DATE NOT NULL,
  required BOOLEAN NOT NULL DEFAULT false,
  paid BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.debits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own debits select" ON public.debits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own debits insert" ON public.debits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own debits update" ON public.debits FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own debits delete" ON public.debits FOR DELETE USING (auth.uid() = user_id);

-- Incomes
CREATE TABLE public.incomes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  date DATE NOT NULL,
  received BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.incomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own incomes select" ON public.incomes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own incomes insert" ON public.incomes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own incomes update" ON public.incomes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own incomes delete" ON public.incomes FOR DELETE USING (auth.uid() = user_id);

-- Investments
CREATE TABLE public.investments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  percentage NUMERIC(6,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own investments select" ON public.investments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own investments insert" ON public.investments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own investments update" ON public.investments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own investments delete" ON public.investments FOR DELETE USING (auth.uid() = user_id);

-- Wallet (1 row per user)
CREATE TABLE public.wallet (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wallet ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own wallet select" ON public.wallet FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own wallet insert" ON public.wallet FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own wallet update" ON public.wallet FOR UPDATE USING (auth.uid() = user_id);

-- Card payments (manual override)
CREATE TABLE public.card_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  year INT NOT NULL,
  month INT NOT NULL,
  paid BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(card_id, year, month)
);
ALTER TABLE public.card_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cp select" ON public.card_payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own cp insert" ON public.card_payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own cp update" ON public.card_payments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own cp delete" ON public.card_payments FOR DELETE USING (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────
-- Origem: 20260419000623_8190d1ac-9a42-49ec-9c4b-117db8995941.sql
-- ──────────────────────────────────────────────────────────
-- 1) Extend installments to support purchase/debit/income parents
ALTER TABLE public.installments
  ADD COLUMN IF NOT EXISTS parent_type text NOT NULL DEFAULT 'purchase',
  ADD COLUMN IF NOT EXISTS parent_id uuid;

-- Backfill parent_id from purchase_id for existing rows
UPDATE public.installments
SET parent_id = purchase_id
WHERE parent_id IS NULL AND purchase_id IS NOT NULL;

-- Make purchase_id nullable (debit/income installments won't have it)
ALTER TABLE public.installments ALTER COLUMN purchase_id DROP NOT NULL;

-- Constraint: parent_id required, parent_type bounded
ALTER TABLE public.installments
  ADD CONSTRAINT installments_parent_id_required CHECK (parent_id IS NOT NULL),
  ADD CONSTRAINT installments_parent_type_check CHECK (parent_type IN ('purchase','debit','income'));

CREATE INDEX IF NOT EXISTS idx_installments_parent ON public.installments(parent_id, parent_type);
CREATE INDEX IF NOT EXISTS idx_installments_year_month ON public.installments(year, month);

-- 2) Extend debits with auto-debit + installment metadata
ALTER TABLE public.debits
  ADD COLUMN IF NOT EXISTS auto_debit boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_debit_day integer,
  ADD COLUMN IF NOT EXISTS installments_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_parent boolean NOT NULL DEFAULT false;

-- 3) Extend incomes with installment metadata
ALTER TABLE public.incomes
  ADD COLUMN IF NOT EXISTS installments_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_parent boolean NOT NULL DEFAULT false;

-- ──────────────────────────────────────────────────────────
-- Origem: 20260420000815_a9d8392e-878e-464a-8060-6626bfde82c4.sql
-- ──────────────────────────────────────────────────────────
-- ============================================================
-- WIPE EXISTING DATA (user chose to start fresh)
-- ============================================================
DELETE FROM public.installments;
DELETE FROM public.card_payments;
DELETE FROM public.purchases;
DELETE FROM public.debits;
DELETE FROM public.incomes;
DELETE FROM public.investments;
DELETE FROM public.cards;
DELETE FROM public.wallet;

-- ============================================================
-- ACCOUNTS TABLE — origem do dinheiro
-- ============================================================
CREATE TABLE public.accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'corrente', -- corrente | digital | carteira | investimento
  color TEXT NOT NULL DEFAULT '#8b5cf6',
  initial_balance NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own accounts select" ON public.accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own accounts insert" ON public.accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own accounts update" ON public.accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own accounts delete" ON public.accounts FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- ADD account_id TO ALL ENTITIES
-- ============================================================
ALTER TABLE public.cards ADD COLUMN account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE public.debits ADD COLUMN account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE public.incomes ADD COLUMN account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE public.investments ADD COLUMN account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE;

CREATE INDEX idx_cards_account ON public.cards(account_id);
CREATE INDEX idx_debits_account ON public.debits(account_id);
CREATE INDEX idx_incomes_account ON public.incomes(account_id);
CREATE INDEX idx_investments_account ON public.investments(account_id);

-- ============================================================
-- DROP wallet (replaced by per-account balance)
-- ============================================================
DROP TABLE public.wallet;

-- ──────────────────────────────────────────────────────────
-- Origem: 20260428014559_1bab3628-4009-44aa-b7ab-4bfc6bf17860.sql
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.investments ADD COLUMN date date NOT NULL DEFAULT CURRENT_DATE;

-- ──────────────────────────────────────────────────────────
-- Origem: 20260428124052_242fcb38-5b7f-42a4-8bf8-7290a7dc271c.sql
-- ──────────────────────────────────────────────────────────

CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own profile select" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own profile delete" ON public.profiles FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.profiles (user_id, display_name, avatar_url)
SELECT
  u.id,
  COALESCE(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    split_part(u.email, '@', 1)
  ),
  u.raw_user_meta_data->>'avatar_url'
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.id IS NULL;


-- ──────────────────────────────────────────────────────────
-- Origem: 20260428124111_39dfd358-e07c-44f1-acef-e4f42c834033.sql
-- ──────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;


-- ──────────────────────────────────────────────────────────
-- Origem: 20260428125257_d2689637-00cf-4341-af17-e105e7a8474d.sql
-- ──────────────────────────────────────────────────────────

CREATE TABLE public.user_passkeys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  transports TEXT[],
  device_name TEXT NOT NULL DEFAULT 'Dispositivo',
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_passkeys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own passkeys select" ON public.user_passkeys FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own passkeys insert" ON public.user_passkeys FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own passkeys update" ON public.user_passkeys FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own passkeys delete" ON public.user_passkeys FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_user_passkeys_user_id ON public.user_passkeys(user_id);
CREATE INDEX idx_user_passkeys_credential_id ON public.user_passkeys(credential_id);

-- Tabela de desafios temporários (gerenciada por server functions, sem RLS user-facing)
CREATE TABLE public.webauthn_challenges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge TEXT NOT NULL,
  user_id UUID,
  email TEXT,
  type TEXT NOT NULL CHECK (type IN ('registration', 'authentication')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '5 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.webauthn_challenges ENABLE ROW LEVEL SECURITY;
-- Sem políticas: acesso apenas via service role no servidor

CREATE INDEX idx_webauthn_challenges_challenge ON public.webauthn_challenges(challenge);
CREATE INDEX idx_webauthn_challenges_expires ON public.webauthn_challenges(expires_at);


-- ──────────────────────────────────────────────────────────
-- Origem: 20260428125317_dd3bf231-0fc9-4761-87a5-4869d69f2026.sql
-- ──────────────────────────────────────────────────────────

CREATE POLICY "no client access" ON public.webauthn_challenges FOR ALL USING (false) WITH CHECK (false);


-- ──────────────────────────────────────────────────────────
-- Origem: 20260505004440_cc01b6aa-1eb1-4470-a1bf-5673f68ddf76.sql
-- ──────────────────────────────────────────────────────────
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

-- ──────────────────────────────────────────────────────────
-- Origem: 20260505004456_fe24e3f2-88e0-4a85-a57f-a1db3f8ca854.sql
-- ──────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_email_whitelisted(text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.enforce_whitelist_on_signup() FROM anon, authenticated, public;

-- ──────────────────────────────────────────────────────────
-- Origem: 20260505011510_fc8b9c84-4592-4436-b588-f22db67fd6b9.sql
-- ──────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon;
GRANT EXECUTE ON FUNCTION public.is_email_whitelisted(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_email_whitelisted(text) TO anon;

-- ──────────────────────────────────────────────────────────
-- Origem: 20260505011554_26cda1e3-2409-4f8e-8618-811bf4b6f083.sql
-- ──────────────────────────────────────────────────────────
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

-- ──────────────────────────────────────────────────────────
-- Origem: 20260505014633_22a80794-0f15-46c0-918c-5b3d63c8888f.sql
-- ──────────────────────────────────────────────────────────

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


-- ──────────────────────────────────────────────────────────
-- Origem: 20260505014653_3a61af21-f29e-469d-bf28-bff615fb3369.sql
-- ──────────────────────────────────────────────────────────

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


-- ──────────────────────────────────────────────────────────
-- Origem: 20260505021730_37be8fb3-f572-4115-ac5c-98ab12fff5e0.sql
-- ──────────────────────────────────────────────────────────
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

-- ──────────────────────────────────────────────────────────
-- Origem: 20260505021746_5b9a398e-60c9-4c49-bb23-0e34a27ce16d.sql
-- ──────────────────────────────────────────────────────────
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

-- ──────────────────────────────────────────────────────────
-- Origem: 20260505122127_307778ff-a6b6-4c49-bdd1-178a64b4866a.sql
-- ──────────────────────────────────────────────────────────

-- IRPF documents
CREATE TABLE public.irpf_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  year integer NOT NULL,
  kind text NOT NULL DEFAULT 'extrato',
  file_path text NOT NULL,
  original_name text NOT NULL,
  mime text,
  size integer,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.irpf_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own irpf_docs select" ON public.irpf_documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own irpf_docs insert" ON public.irpf_documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own irpf_docs update" ON public.irpf_documents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own irpf_docs delete" ON public.irpf_documents FOR DELETE USING (auth.uid() = user_id);

-- IRPF entries (lines extracted from documents)
CREATE TABLE public.irpf_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  document_id uuid REFERENCES public.irpf_documents(id) ON DELETE CASCADE,
  date date,
  description text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  source text,
  category text NOT NULL DEFAULT 'nao_classificado',
  subcategory text,
  year integer NOT NULL,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.irpf_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own irpf_entries select" ON public.irpf_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own irpf_entries insert" ON public.irpf_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own irpf_entries update" ON public.irpf_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own irpf_entries delete" ON public.irpf_entries FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_irpf_entries_user_year ON public.irpf_entries(user_id, year);

-- IRPF year snapshots (saldos em 31/12)
CREATE TABLE public.irpf_year_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  year integer NOT NULL,
  account_id uuid,
  investment_id uuid,
  label text NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.irpf_year_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own irpf_snap select" ON public.irpf_year_snapshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own irpf_snap insert" ON public.irpf_year_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own irpf_snap update" ON public.irpf_year_snapshots FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own irpf_snap delete" ON public.irpf_year_snapshots FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_irpf_snap_updated_at
  BEFORE UPDATE ON public.irpf_year_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket (privado)
INSERT INTO storage.buckets (id, name, public) VALUES ('irpf-docs', 'irpf-docs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "irpf-docs own select" ON storage.objects FOR SELECT
  USING (bucket_id = 'irpf-docs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "irpf-docs own insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'irpf-docs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "irpf-docs own update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'irpf-docs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "irpf-docs own delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'irpf-docs' AND auth.uid()::text = (storage.foldername(name))[1]);


-- ──────────────────────────────────────────────────────────
-- Origem: 20260505212002_b74865d7-9b35-453c-8312-f61da4cacb4c.sql
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.access_requests ADD COLUMN IF NOT EXISTS notified_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_access_requests_pending_notify ON public.access_requests (status, notified_at) WHERE status = 'pending' AND notified_at IS NULL;

-- ──────────────────────────────────────────────────────────
-- Origem: 20260505235313_e404aac5-e7b3-415f-b245-5fb20105bf0c.sql
-- ──────────────────────────────────────────────────────────
-- Remove o trigger que bloqueava o signup antes da validação.
-- A whitelist passa a ser validada pelo app logo após o login (Google ou email/senha),
-- evitando o erro "failed to sign in with vendor" e garantindo que toda tentativa
-- de cadastro registre uma solicitação visível ao admin.
DROP TRIGGER IF EXISTS enforce_whitelist_on_signup ON auth.users;

-- ──────────────────────────────────────────────────────────
-- Origem: 20260505235932_b4b4b395-c0f7-4101-bf7f-b45405c38471.sql
-- ──────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.is_email_whitelisted(text) TO anon, authenticated;

-- ──────────────────────────────────────────────────────────
-- Origem: 20260506005213_0533deb1-1399-4abf-b2b3-3bf060773630.sql
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.access_requests REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.access_requests;

-- ──────────────────────────────────────────────────────────
-- Origem: 20260508031905_cd0519fd-0a71-437a-abbe-8afe0b68bd7b.sql
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.cards 
  ADD COLUMN IF NOT EXISTS start_year integer,
  ADD COLUMN IF NOT EXISTS start_month integer,
  ADD COLUMN IF NOT EXISTS end_year integer,
  ADD COLUMN IF NOT EXISTS end_month integer;

-- ──────────────────────────────────────────────────────────
-- Origem: 20260509012901_d2f999d1-f879-49b6-a2bc-47ad71435945.sql
-- ──────────────────────────────────────────────────────────
-- Snapshots table
CREATE TABLE public.app_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'manual',
  label text NOT NULL DEFAULT '',
  year_month text,
  data jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_app_snapshots_user_created ON public.app_snapshots (user_id, created_at DESC);
CREATE INDEX idx_app_snapshots_user_ym ON public.app_snapshots (user_id, kind, year_month);

ALTER TABLE public.app_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own snapshots select" ON public.app_snapshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own snapshots insert" ON public.app_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own snapshots delete" ON public.app_snapshots FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "own snapshots update" ON public.app_snapshots FOR UPDATE USING (auth.uid() = user_id);

-- Realtime: enable for financial tables
ALTER TABLE public.accounts REPLICA IDENTITY FULL;
ALTER TABLE public.cards REPLICA IDENTITY FULL;
ALTER TABLE public.purchases REPLICA IDENTITY FULL;
ALTER TABLE public.installments REPLICA IDENTITY FULL;
ALTER TABLE public.debits REPLICA IDENTITY FULL;
ALTER TABLE public.incomes REPLICA IDENTITY FULL;
ALTER TABLE public.investments REPLICA IDENTITY FULL;
ALTER TABLE public.card_payments REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.purchases;
ALTER PUBLICATION supabase_realtime ADD TABLE public.installments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.debits;
ALTER PUBLICATION supabase_realtime ADD TABLE public.incomes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.investments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.card_payments;

-- ──────────────────────────────────────────────────────────
-- Origem: 20260512020253_b57ee757-e1bc-40e7-9ede-c804997bf9c0.sql
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bulk_insert_finance(_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _purchases int := 0;
  _installments int := 0;
  _debits int := 0;
  _incomes int := 0;
  _investments int := 0;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  WITH src AS (
    SELECT * FROM jsonb_to_recordset(COALESCE(_payload->'purchases', '[]'::jsonb)) AS r(
      id uuid,
      card_id uuid,
      description text,
      total_amount numeric,
      purchase_date date,
      installments_count int
    )
  ), inserted AS (
    INSERT INTO public.purchases (id, user_id, card_id, description, total_amount, purchase_date, installments_count)
    SELECT
      COALESCE(src.id, gen_random_uuid()),
      _uid,
      src.card_id,
      COALESCE(src.description, ''),
      COALESCE(src.total_amount, 0),
      COALESCE(src.purchase_date, CURRENT_DATE),
      GREATEST(COALESCE(src.installments_count, 1), 1)
    FROM src
    JOIN public.cards c ON c.id = src.card_id AND c.user_id = _uid
    ON CONFLICT (id) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      card_id = EXCLUDED.card_id,
      description = EXCLUDED.description,
      total_amount = EXCLUDED.total_amount,
      purchase_date = EXCLUDED.purchase_date,
      installments_count = EXCLUDED.installments_count
    WHERE public.purchases.user_id = _uid
    RETURNING 1
  )
  SELECT count(*) INTO _purchases FROM inserted;

  WITH src AS (
    SELECT * FROM jsonb_to_recordset(COALESCE(_payload->'debits', '[]'::jsonb)) AS r(
      id uuid,
      account_id uuid,
      description text,
      amount numeric,
      date date,
      required boolean,
      paid boolean,
      auto_debit boolean,
      auto_debit_day int,
      installments_count int,
      is_parent boolean
    )
  ), inserted AS (
    INSERT INTO public.debits (id, user_id, account_id, description, amount, date, required, paid, auto_debit, auto_debit_day, installments_count, is_parent)
    SELECT
      COALESCE(src.id, gen_random_uuid()),
      _uid,
      src.account_id,
      COALESCE(src.description, ''),
      COALESCE(src.amount, 0),
      COALESCE(src.date, CURRENT_DATE),
      COALESCE(src.required, false),
      COALESCE(src.paid, false),
      COALESCE(src.auto_debit, false),
      src.auto_debit_day,
      GREATEST(COALESCE(src.installments_count, 1), 1),
      COALESCE(src.is_parent, false)
    FROM src
    JOIN public.accounts a ON a.id = src.account_id AND a.user_id = _uid
    ON CONFLICT (id) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      account_id = EXCLUDED.account_id,
      description = EXCLUDED.description,
      amount = EXCLUDED.amount,
      date = EXCLUDED.date,
      required = EXCLUDED.required,
      paid = EXCLUDED.paid,
      auto_debit = EXCLUDED.auto_debit,
      auto_debit_day = EXCLUDED.auto_debit_day,
      installments_count = EXCLUDED.installments_count,
      is_parent = EXCLUDED.is_parent
    WHERE public.debits.user_id = _uid
    RETURNING 1
  )
  SELECT count(*) INTO _debits FROM inserted;

  WITH src AS (
    SELECT * FROM jsonb_to_recordset(COALESCE(_payload->'incomes', '[]'::jsonb)) AS r(
      id uuid,
      account_id uuid,
      description text,
      amount numeric,
      date date,
      received boolean,
      installments_count int,
      is_parent boolean
    )
  ), inserted AS (
    INSERT INTO public.incomes (id, user_id, account_id, description, amount, date, received, installments_count, is_parent)
    SELECT
      COALESCE(src.id, gen_random_uuid()),
      _uid,
      src.account_id,
      COALESCE(src.description, ''),
      COALESCE(src.amount, 0),
      COALESCE(src.date, CURRENT_DATE),
      COALESCE(src.received, false),
      GREATEST(COALESCE(src.installments_count, 1), 1),
      COALESCE(src.is_parent, false)
    FROM src
    JOIN public.accounts a ON a.id = src.account_id AND a.user_id = _uid
    ON CONFLICT (id) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      account_id = EXCLUDED.account_id,
      description = EXCLUDED.description,
      amount = EXCLUDED.amount,
      date = EXCLUDED.date,
      received = EXCLUDED.received,
      installments_count = EXCLUDED.installments_count,
      is_parent = EXCLUDED.is_parent
    WHERE public.incomes.user_id = _uid
    RETURNING 1
  )
  SELECT count(*) INTO _incomes FROM inserted;

  WITH src AS (
    SELECT * FROM jsonb_to_recordset(COALESCE(_payload->'investments', '[]'::jsonb)) AS r(
      id uuid,
      account_id uuid,
      type text,
      amount numeric,
      percentage numeric,
      date date
    )
  ), inserted AS (
    INSERT INTO public.investments (id, user_id, account_id, type, amount, percentage, date)
    SELECT
      COALESCE(src.id, gen_random_uuid()),
      _uid,
      src.account_id,
      COALESCE(src.type, ''),
      COALESCE(src.amount, 0),
      COALESCE(src.percentage, 0),
      src.date
    FROM src
    JOIN public.accounts a ON a.id = src.account_id AND a.user_id = _uid
    ON CONFLICT (id) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      account_id = EXCLUDED.account_id,
      type = EXCLUDED.type,
      amount = EXCLUDED.amount,
      percentage = EXCLUDED.percentage,
      date = EXCLUDED.date
    WHERE public.investments.user_id = _uid
    RETURNING 1
  )
  SELECT count(*) INTO _investments FROM inserted;

  WITH src AS (
    SELECT * FROM jsonb_to_recordset(COALESCE(_payload->'installments', '[]'::jsonb)) AS r(
      id uuid,
      parent_id uuid,
      parent_type text,
      purchase_id uuid,
      number int,
      total int,
      amount numeric,
      due_date date,
      year int,
      month int,
      paid boolean
    )
  ), normalized AS (
    SELECT
      COALESCE(src.id, gen_random_uuid()) AS id,
      COALESCE(NULLIF(src.parent_type, ''), 'purchase') AS parent_type,
      src.parent_id,
      CASE WHEN COALESCE(NULLIF(src.parent_type, ''), 'purchase') = 'purchase'
        THEN COALESCE(src.purchase_id, src.parent_id)
        ELSE NULL
      END AS purchase_id,
      src.number,
      src.total,
      src.amount,
      src.due_date,
      src.year,
      src.month,
      src.paid
    FROM src
  ), valid AS (
    SELECT n.*
    FROM normalized n
    WHERE CASE
      WHEN n.parent_type = 'purchase' THEN EXISTS (
        SELECT 1 FROM public.purchases p WHERE p.id = n.purchase_id AND p.user_id = _uid
      )
      WHEN n.parent_type = 'debit' THEN n.parent_id IS NULL OR EXISTS (
        SELECT 1 FROM public.debits d WHERE d.id = n.parent_id AND d.user_id = _uid
      )
      WHEN n.parent_type = 'income' THEN n.parent_id IS NULL OR EXISTS (
        SELECT 1 FROM public.incomes i WHERE i.id = n.parent_id AND i.user_id = _uid
      )
      WHEN n.parent_type = 'investment' THEN n.parent_id IS NULL OR EXISTS (
        SELECT 1 FROM public.investments v WHERE v.id = n.parent_id AND v.user_id = _uid
      )
      ELSE false
    END
  ), inserted AS (
    INSERT INTO public.installments (id, user_id, parent_id, parent_type, purchase_id, number, total, amount, due_date, year, month, paid)
    SELECT
      valid.id,
      _uid,
      CASE WHEN valid.parent_type = 'purchase' THEN COALESCE(valid.parent_id, valid.purchase_id) ELSE valid.parent_id END,
      valid.parent_type,
      valid.purchase_id,
      GREATEST(COALESCE(valid.number, 1), 1),
      GREATEST(COALESCE(valid.total, 1), 1),
      COALESCE(valid.amount, 0),
      COALESCE(valid.due_date, CURRENT_DATE),
      COALESCE(valid.year, EXTRACT(YEAR FROM COALESCE(valid.due_date, CURRENT_DATE))::int),
      COALESCE(valid.month, EXTRACT(MONTH FROM COALESCE(valid.due_date, CURRENT_DATE))::int - 1),
      COALESCE(valid.paid, false)
    FROM valid
    ON CONFLICT (id) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      parent_id = EXCLUDED.parent_id,
      parent_type = EXCLUDED.parent_type,
      purchase_id = EXCLUDED.purchase_id,
      number = EXCLUDED.number,
      total = EXCLUDED.total,
      amount = EXCLUDED.amount,
      due_date = EXCLUDED.due_date,
      year = EXCLUDED.year,
      month = EXCLUDED.month,
      paid = EXCLUDED.paid
    WHERE public.installments.user_id = _uid
    RETURNING 1
  )
  SELECT count(*) INTO _installments FROM inserted;

  RETURN jsonb_build_object(
    'purchases', _purchases,
    'installments', _installments,
    'debits', _debits,
    'incomes', _incomes,
    'investments', _investments
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_finance_backup(_payload jsonb, _selected text[], _wipe_before_insert boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _data jsonb := COALESCE(_payload->'data', _payload);
  _accounts int := 0;
  _cards int := 0;
  _purchases int := 0;
  _installments int := 0;
  _debits int := 0;
  _incomes int := 0;
  _investments int := 0;
  _card_payments int := 0;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _wipe_before_insert THEN
    IF 'installments' = ANY(_selected) THEN
      DELETE FROM public.installments WHERE user_id = _uid;
    END IF;
    IF 'card_payments' = ANY(_selected) THEN
      DELETE FROM public.card_payments WHERE user_id = _uid;
    END IF;
    IF 'purchases' = ANY(_selected) THEN
      DELETE FROM public.installments WHERE user_id = _uid AND parent_type = 'purchase';
      DELETE FROM public.purchases WHERE user_id = _uid;
    END IF;
    IF 'debits' = ANY(_selected) THEN
      DELETE FROM public.installments WHERE user_id = _uid AND parent_type = 'debit';
      DELETE FROM public.debits WHERE user_id = _uid;
    END IF;
    IF 'incomes' = ANY(_selected) THEN
      DELETE FROM public.installments WHERE user_id = _uid AND parent_type = 'income';
      DELETE FROM public.incomes WHERE user_id = _uid;
    END IF;
    IF 'investments' = ANY(_selected) THEN
      DELETE FROM public.installments WHERE user_id = _uid AND parent_type = 'investment';
      DELETE FROM public.investments WHERE user_id = _uid;
    END IF;
    IF 'cards' = ANY(_selected) THEN
      DELETE FROM public.card_payments WHERE user_id = _uid;
      DELETE FROM public.installments WHERE user_id = _uid AND parent_type = 'purchase';
      DELETE FROM public.purchases WHERE user_id = _uid;
      DELETE FROM public.cards WHERE user_id = _uid;
    END IF;
    IF 'accounts' = ANY(_selected) THEN
      DELETE FROM public.installments WHERE user_id = _uid;
      DELETE FROM public.card_payments WHERE user_id = _uid;
      DELETE FROM public.purchases WHERE user_id = _uid;
      DELETE FROM public.debits WHERE user_id = _uid;
      DELETE FROM public.incomes WHERE user_id = _uid;
      DELETE FROM public.investments WHERE user_id = _uid;
      DELETE FROM public.cards WHERE user_id = _uid;
      DELETE FROM public.accounts WHERE user_id = _uid;
    END IF;
  END IF;

  IF 'accounts' = ANY(_selected) THEN
    WITH src AS (
      SELECT * FROM jsonb_to_recordset(COALESCE(_data->'accounts', '[]'::jsonb)) AS r(
        id uuid,
        name text,
        type text,
        color text,
        initial_balance numeric,
        created_at timestamptz
      )
    ), inserted AS (
      INSERT INTO public.accounts (id, user_id, name, type, color, initial_balance, created_at)
      SELECT COALESCE(id, gen_random_uuid()), _uid, COALESCE(name, 'Conta'), COALESCE(type, 'corrente'), COALESCE(color, '#8b5cf6'), COALESCE(initial_balance, 0), COALESCE(created_at, now())
      FROM src
      ON CONFLICT (id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        name = EXCLUDED.name,
        type = EXCLUDED.type,
        color = EXCLUDED.color,
        initial_balance = EXCLUDED.initial_balance
      WHERE public.accounts.user_id = _uid
      RETURNING 1
    ) SELECT count(*) INTO _accounts FROM inserted;
  END IF;

  IF 'cards' = ANY(_selected) THEN
    WITH src AS (
      SELECT * FROM jsonb_to_recordset(COALESCE(_data->'cards', '[]'::jsonb)) AS r(
        id uuid,
        account_id uuid,
        name text,
        color text,
        closing_day int,
        due_day int,
        start_year int,
        start_month int,
        end_year int,
        end_month int,
        created_at timestamptz
      )
    ), inserted AS (
      INSERT INTO public.cards (id, user_id, account_id, name, color, closing_day, due_day, start_year, start_month, end_year, end_month, created_at)
      SELECT COALESCE(src.id, gen_random_uuid()), _uid, src.account_id, COALESCE(src.name, 'Cartão'), COALESCE(src.color, '#8b5cf6'), COALESCE(src.closing_day, 25), COALESCE(src.due_day, 5), src.start_year, src.start_month, src.end_year, src.end_month, COALESCE(src.created_at, now())
      FROM src
      JOIN public.accounts a ON a.id = src.account_id AND a.user_id = _uid
      ON CONFLICT (id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        account_id = EXCLUDED.account_id,
        name = EXCLUDED.name,
        color = EXCLUDED.color,
        closing_day = EXCLUDED.closing_day,
        due_day = EXCLUDED.due_day,
        start_year = EXCLUDED.start_year,
        start_month = EXCLUDED.start_month,
        end_year = EXCLUDED.end_year,
        end_month = EXCLUDED.end_month
      WHERE public.cards.user_id = _uid
      RETURNING 1
    ) SELECT count(*) INTO _cards FROM inserted;
  END IF;

  IF 'purchases' = ANY(_selected) THEN
    WITH src AS (
      SELECT * FROM jsonb_to_recordset(COALESCE(_data->'purchases', '[]'::jsonb)) AS r(
        id uuid,
        card_id uuid,
        description text,
        total_amount numeric,
        purchase_date date,
        installments_count int,
        created_at timestamptz
      )
    ), inserted AS (
      INSERT INTO public.purchases (id, user_id, card_id, description, total_amount, purchase_date, installments_count, created_at)
      SELECT COALESCE(src.id, gen_random_uuid()), _uid, src.card_id, COALESCE(src.description, ''), COALESCE(src.total_amount, 0), COALESCE(src.purchase_date, CURRENT_DATE), GREATEST(COALESCE(src.installments_count, 1), 1), COALESCE(src.created_at, now())
      FROM src
      JOIN public.cards c ON c.id = src.card_id AND c.user_id = _uid
      ON CONFLICT (id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        card_id = EXCLUDED.card_id,
        description = EXCLUDED.description,
        total_amount = EXCLUDED.total_amount,
        purchase_date = EXCLUDED.purchase_date,
        installments_count = EXCLUDED.installments_count
      WHERE public.purchases.user_id = _uid
      RETURNING 1
    ) SELECT count(*) INTO _purchases FROM inserted;
  END IF;

  IF 'debits' = ANY(_selected) THEN
    WITH src AS (
      SELECT * FROM jsonb_to_recordset(COALESCE(_data->'debits', '[]'::jsonb)) AS r(
        id uuid,
        account_id uuid,
        description text,
        amount numeric,
        date date,
        required boolean,
        paid boolean,
        auto_debit boolean,
        auto_debit_day int,
        installments_count int,
        is_parent boolean,
        created_at timestamptz
      )
    ), inserted AS (
      INSERT INTO public.debits (id, user_id, account_id, description, amount, date, required, paid, auto_debit, auto_debit_day, installments_count, is_parent, created_at)
      SELECT COALESCE(src.id, gen_random_uuid()), _uid, src.account_id, COALESCE(src.description, ''), COALESCE(src.amount, 0), COALESCE(src.date, CURRENT_DATE), COALESCE(src.required, false), COALESCE(src.paid, false), COALESCE(src.auto_debit, false), src.auto_debit_day, GREATEST(COALESCE(src.installments_count, 1), 1), COALESCE(src.is_parent, false), COALESCE(src.created_at, now())
      FROM src
      JOIN public.accounts a ON a.id = src.account_id AND a.user_id = _uid
      ON CONFLICT (id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        account_id = EXCLUDED.account_id,
        description = EXCLUDED.description,
        amount = EXCLUDED.amount,
        date = EXCLUDED.date,
        required = EXCLUDED.required,
        paid = EXCLUDED.paid,
        auto_debit = EXCLUDED.auto_debit,
        auto_debit_day = EXCLUDED.auto_debit_day,
        installments_count = EXCLUDED.installments_count,
        is_parent = EXCLUDED.is_parent
      WHERE public.debits.user_id = _uid
      RETURNING 1
    ) SELECT count(*) INTO _debits FROM inserted;
  END IF;

  IF 'incomes' = ANY(_selected) THEN
    WITH src AS (
      SELECT * FROM jsonb_to_recordset(COALESCE(_data->'incomes', '[]'::jsonb)) AS r(
        id uuid,
        account_id uuid,
        description text,
        amount numeric,
        date date,
        received boolean,
        installments_count int,
        is_parent boolean,
        created_at timestamptz
      )
    ), inserted AS (
      INSERT INTO public.incomes (id, user_id, account_id, description, amount, date, received, installments_count, is_parent, created_at)
      SELECT COALESCE(src.id, gen_random_uuid()), _uid, src.account_id, COALESCE(src.description, ''), COALESCE(src.amount, 0), COALESCE(src.date, CURRENT_DATE), COALESCE(src.received, false), GREATEST(COALESCE(src.installments_count, 1), 1), COALESCE(src.is_parent, false), COALESCE(src.created_at, now())
      FROM src
      JOIN public.accounts a ON a.id = src.account_id AND a.user_id = _uid
      ON CONFLICT (id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        account_id = EXCLUDED.account_id,
        description = EXCLUDED.description,
        amount = EXCLUDED.amount,
        date = EXCLUDED.date,
        received = EXCLUDED.received,
        installments_count = EXCLUDED.installments_count,
        is_parent = EXCLUDED.is_parent
      WHERE public.incomes.user_id = _uid
      RETURNING 1
    ) SELECT count(*) INTO _incomes FROM inserted;
  END IF;

  IF 'investments' = ANY(_selected) THEN
    WITH src AS (
      SELECT * FROM jsonb_to_recordset(COALESCE(_data->'investments', '[]'::jsonb)) AS r(
        id uuid,
        account_id uuid,
        type text,
        amount numeric,
        percentage numeric,
        date date,
        created_at timestamptz
      )
    ), inserted AS (
      INSERT INTO public.investments (id, user_id, account_id, type, amount, percentage, date, created_at)
      SELECT COALESCE(src.id, gen_random_uuid()), _uid, src.account_id, COALESCE(src.type, ''), COALESCE(src.amount, 0), COALESCE(src.percentage, 0), src.date, COALESCE(src.created_at, now())
      FROM src
      JOIN public.accounts a ON a.id = src.account_id AND a.user_id = _uid
      ON CONFLICT (id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        account_id = EXCLUDED.account_id,
        type = EXCLUDED.type,
        amount = EXCLUDED.amount,
        percentage = EXCLUDED.percentage,
        date = EXCLUDED.date
      WHERE public.investments.user_id = _uid
      RETURNING 1
    ) SELECT count(*) INTO _investments FROM inserted;
  END IF;

  IF 'installments' = ANY(_selected) THEN
    WITH src AS (
      SELECT * FROM jsonb_to_recordset(COALESCE(_data->'installments', '[]'::jsonb)) AS r(
        id uuid,
        parent_id uuid,
        parent_type text,
        purchase_id uuid,
        number int,
        total int,
        amount numeric,
        due_date date,
        year int,
        month int,
        paid boolean,
        created_at timestamptz
      )
    ), normalized AS (
      SELECT
        COALESCE(src.id, gen_random_uuid()) AS id,
        COALESCE(NULLIF(src.parent_type, ''), 'purchase') AS parent_type,
        src.parent_id,
        CASE WHEN COALESCE(NULLIF(src.parent_type, ''), 'purchase') = 'purchase'
          THEN COALESCE(src.purchase_id, src.parent_id)
          ELSE NULL
        END AS purchase_id,
        src.number,
        src.total,
        src.amount,
        src.due_date,
        src.year,
        src.month,
        src.paid,
        src.created_at
      FROM src
    ), valid AS (
      SELECT n.*
      FROM normalized n
      WHERE CASE
        WHEN n.parent_type = 'purchase' THEN EXISTS (SELECT 1 FROM public.purchases p WHERE p.id = n.purchase_id AND p.user_id = _uid)
        WHEN n.parent_type = 'debit' THEN n.parent_id IS NULL OR EXISTS (SELECT 1 FROM public.debits d WHERE d.id = n.parent_id AND d.user_id = _uid)
        WHEN n.parent_type = 'income' THEN n.parent_id IS NULL OR EXISTS (SELECT 1 FROM public.incomes i WHERE i.id = n.parent_id AND i.user_id = _uid)
        WHEN n.parent_type = 'investment' THEN n.parent_id IS NULL OR EXISTS (SELECT 1 FROM public.investments v WHERE v.id = n.parent_id AND v.user_id = _uid)
        ELSE false
      END
    ), inserted AS (
      INSERT INTO public.installments (id, user_id, parent_id, parent_type, purchase_id, number, total, amount, due_date, year, month, paid, created_at)
      SELECT valid.id, _uid, CASE WHEN valid.parent_type = 'purchase' THEN COALESCE(valid.parent_id, valid.purchase_id) ELSE valid.parent_id END, valid.parent_type, valid.purchase_id, GREATEST(COALESCE(valid.number, 1), 1), GREATEST(COALESCE(valid.total, 1), 1), COALESCE(valid.amount, 0), COALESCE(valid.due_date, CURRENT_DATE), COALESCE(valid.year, EXTRACT(YEAR FROM COALESCE(valid.due_date, CURRENT_DATE))::int), COALESCE(valid.month, EXTRACT(MONTH FROM COALESCE(valid.due_date, CURRENT_DATE))::int - 1), COALESCE(valid.paid, false), COALESCE(valid.created_at, now())
      FROM valid
      ON CONFLICT (id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        parent_id = EXCLUDED.parent_id,
        parent_type = EXCLUDED.parent_type,
        purchase_id = EXCLUDED.purchase_id,
        number = EXCLUDED.number,
        total = EXCLUDED.total,
        amount = EXCLUDED.amount,
        due_date = EXCLUDED.due_date,
        year = EXCLUDED.year,
        month = EXCLUDED.month,
        paid = EXCLUDED.paid
      WHERE public.installments.user_id = _uid
      RETURNING 1
    ) SELECT count(*) INTO _installments FROM inserted;
  END IF;

  IF 'card_payments' = ANY(_selected) THEN
    WITH src AS (
      SELECT * FROM jsonb_to_recordset(COALESCE(_data->'card_payments', '[]'::jsonb)) AS r(
        id uuid,
        card_id uuid,
        year int,
        month int,
        paid boolean
      )
    ), inserted AS (
      INSERT INTO public.card_payments (id, user_id, card_id, year, month, paid)
      SELECT COALESCE(src.id, gen_random_uuid()), _uid, src.card_id, COALESCE(src.year, EXTRACT(YEAR FROM CURRENT_DATE)::int), COALESCE(src.month, EXTRACT(MONTH FROM CURRENT_DATE)::int - 1), COALESCE(src.paid, false)
      FROM src
      JOIN public.cards c ON c.id = src.card_id AND c.user_id = _uid
      ON CONFLICT (id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        card_id = EXCLUDED.card_id,
        year = EXCLUDED.year,
        month = EXCLUDED.month,
        paid = EXCLUDED.paid
      WHERE public.card_payments.user_id = _uid
      RETURNING 1
    ) SELECT count(*) INTO _card_payments FROM inserted;
  END IF;

  RETURN jsonb_build_object(
    'accounts', _accounts,
    'cards', _cards,
    'purchases', _purchases,
    'installments', _installments,
    'debits', _debits,
    'incomes', _incomes,
    'investments', _investments,
    'card_payments', _card_payments
  );
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_insert_finance(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_finance_backup(jsonb, text[], boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_insert_finance(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_finance_backup(jsonb, text[], boolean) TO authenticated;

-- ──────────────────────────────────────────────────────────
-- Origem: 20260512020320_cef71a3a-b121-4c08-8dc1-0e2cbb974299.sql
-- ──────────────────────────────────────────────────────────
ALTER FUNCTION public.bulk_insert_finance(jsonb) SECURITY INVOKER;
ALTER FUNCTION public.restore_finance_backup(jsonb, text[], boolean) SECURITY INVOKER;

REVOKE ALL ON FUNCTION public.bulk_insert_finance(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_finance_backup(jsonb, text[], boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_insert_finance(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_finance_backup(jsonb, text[], boolean) TO authenticated;

-- ──────────────────────────────────────────────────────────
-- Origem: 20260514122428_0e2310f0-4820-4a2e-82d8-55c406a2d591.sql
-- ──────────────────────────────────────────────────────────

ALTER TABLE public.debits ADD COLUMN IF NOT EXISTS recurrence_group_id uuid;
ALTER TABLE public.incomes ADD COLUMN IF NOT EXISTS recurrence_group_id uuid;
CREATE INDEX IF NOT EXISTS idx_debits_recurrence_group ON public.debits(user_id, recurrence_group_id) WHERE recurrence_group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_incomes_recurrence_group ON public.incomes(user_id, recurrence_group_id) WHERE recurrence_group_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.bulk_insert_finance(_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _purchases int := 0;
  _installments int := 0;
  _debits int := 0;
  _incomes int := 0;
  _investments int := 0;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  WITH src AS (
    SELECT * FROM jsonb_to_recordset(COALESCE(_payload->'purchases', '[]'::jsonb)) AS r(
      id uuid, card_id uuid, description text, total_amount numeric,
      purchase_date date, installments_count int
    )
  ), inserted AS (
    INSERT INTO public.purchases (id, user_id, card_id, description, total_amount, purchase_date, installments_count)
    SELECT COALESCE(src.id, gen_random_uuid()), _uid, src.card_id, COALESCE(src.description, ''),
      COALESCE(src.total_amount, 0), COALESCE(src.purchase_date, CURRENT_DATE),
      GREATEST(COALESCE(src.installments_count, 1), 1)
    FROM src JOIN public.cards c ON c.id = src.card_id AND c.user_id = _uid
    ON CONFLICT (id) DO UPDATE SET user_id=EXCLUDED.user_id, card_id=EXCLUDED.card_id,
      description=EXCLUDED.description, total_amount=EXCLUDED.total_amount,
      purchase_date=EXCLUDED.purchase_date, installments_count=EXCLUDED.installments_count
    WHERE public.purchases.user_id = _uid RETURNING 1
  ) SELECT count(*) INTO _purchases FROM inserted;

  WITH src AS (
    SELECT * FROM jsonb_to_recordset(COALESCE(_payload->'debits', '[]'::jsonb)) AS r(
      id uuid, account_id uuid, description text, amount numeric, date date,
      required boolean, paid boolean, auto_debit boolean, auto_debit_day int,
      installments_count int, is_parent boolean, recurrence_group_id uuid
    )
  ), inserted AS (
    INSERT INTO public.debits (id, user_id, account_id, description, amount, date, required, paid, auto_debit, auto_debit_day, installments_count, is_parent, recurrence_group_id)
    SELECT COALESCE(src.id, gen_random_uuid()), _uid, src.account_id, COALESCE(src.description, ''),
      COALESCE(src.amount, 0), COALESCE(src.date, CURRENT_DATE), COALESCE(src.required, false),
      COALESCE(src.paid, false), COALESCE(src.auto_debit, false), src.auto_debit_day,
      GREATEST(COALESCE(src.installments_count, 1), 1), COALESCE(src.is_parent, false), src.recurrence_group_id
    FROM src JOIN public.accounts a ON a.id = src.account_id AND a.user_id = _uid
    ON CONFLICT (id) DO UPDATE SET user_id=EXCLUDED.user_id, account_id=EXCLUDED.account_id,
      description=EXCLUDED.description, amount=EXCLUDED.amount, date=EXCLUDED.date,
      required=EXCLUDED.required, paid=EXCLUDED.paid, auto_debit=EXCLUDED.auto_debit,
      auto_debit_day=EXCLUDED.auto_debit_day, installments_count=EXCLUDED.installments_count,
      is_parent=EXCLUDED.is_parent, recurrence_group_id=EXCLUDED.recurrence_group_id
    WHERE public.debits.user_id = _uid RETURNING 1
  ) SELECT count(*) INTO _debits FROM inserted;

  WITH src AS (
    SELECT * FROM jsonb_to_recordset(COALESCE(_payload->'incomes', '[]'::jsonb)) AS r(
      id uuid, account_id uuid, description text, amount numeric, date date,
      received boolean, installments_count int, is_parent boolean, recurrence_group_id uuid
    )
  ), inserted AS (
    INSERT INTO public.incomes (id, user_id, account_id, description, amount, date, received, installments_count, is_parent, recurrence_group_id)
    SELECT COALESCE(src.id, gen_random_uuid()), _uid, src.account_id, COALESCE(src.description, ''),
      COALESCE(src.amount, 0), COALESCE(src.date, CURRENT_DATE), COALESCE(src.received, false),
      GREATEST(COALESCE(src.installments_count, 1), 1), COALESCE(src.is_parent, false), src.recurrence_group_id
    FROM src JOIN public.accounts a ON a.id = src.account_id AND a.user_id = _uid
    ON CONFLICT (id) DO UPDATE SET user_id=EXCLUDED.user_id, account_id=EXCLUDED.account_id,
      description=EXCLUDED.description, amount=EXCLUDED.amount, date=EXCLUDED.date,
      received=EXCLUDED.received, installments_count=EXCLUDED.installments_count,
      is_parent=EXCLUDED.is_parent, recurrence_group_id=EXCLUDED.recurrence_group_id
    WHERE public.incomes.user_id = _uid RETURNING 1
  ) SELECT count(*) INTO _incomes FROM inserted;

  WITH src AS (
    SELECT * FROM jsonb_to_recordset(COALESCE(_payload->'investments', '[]'::jsonb)) AS r(
      id uuid, account_id uuid, type text, amount numeric, percentage numeric, date date
    )
  ), inserted AS (
    INSERT INTO public.investments (id, user_id, account_id, type, amount, percentage, date)
    SELECT COALESCE(src.id, gen_random_uuid()), _uid, src.account_id, COALESCE(src.type, ''),
      COALESCE(src.amount, 0), COALESCE(src.percentage, 0), src.date
    FROM src JOIN public.accounts a ON a.id = src.account_id AND a.user_id = _uid
    ON CONFLICT (id) DO UPDATE SET user_id=EXCLUDED.user_id, account_id=EXCLUDED.account_id,
      type=EXCLUDED.type, amount=EXCLUDED.amount, percentage=EXCLUDED.percentage, date=EXCLUDED.date
    WHERE public.investments.user_id = _uid RETURNING 1
  ) SELECT count(*) INTO _investments FROM inserted;

  WITH src AS (
    SELECT * FROM jsonb_to_recordset(COALESCE(_payload->'installments', '[]'::jsonb)) AS r(
      id uuid, parent_id uuid, parent_type text, purchase_id uuid, number int, total int,
      amount numeric, due_date date, year int, month int, paid boolean
    )
  ), normalized AS (
    SELECT COALESCE(src.id, gen_random_uuid()) AS id,
      COALESCE(NULLIF(src.parent_type, ''), 'purchase') AS parent_type,
      src.parent_id,
      CASE WHEN COALESCE(NULLIF(src.parent_type, ''), 'purchase') = 'purchase'
        THEN COALESCE(src.purchase_id, src.parent_id) ELSE NULL END AS purchase_id,
      src.number, src.total, src.amount, src.due_date, src.year, src.month, src.paid
    FROM src
  ), valid AS (
    SELECT n.* FROM normalized n WHERE CASE
      WHEN n.parent_type = 'purchase' THEN EXISTS (SELECT 1 FROM public.purchases p WHERE p.id = n.purchase_id AND p.user_id = _uid)
      WHEN n.parent_type = 'debit' THEN n.parent_id IS NULL OR EXISTS (SELECT 1 FROM public.debits d WHERE d.id = n.parent_id AND d.user_id = _uid)
      WHEN n.parent_type = 'income' THEN n.parent_id IS NULL OR EXISTS (SELECT 1 FROM public.incomes i WHERE i.id = n.parent_id AND i.user_id = _uid)
      WHEN n.parent_type = 'investment' THEN n.parent_id IS NULL OR EXISTS (SELECT 1 FROM public.investments v WHERE v.id = n.parent_id AND v.user_id = _uid)
      ELSE false END
  ), inserted AS (
    INSERT INTO public.installments (id, user_id, parent_id, parent_type, purchase_id, number, total, amount, due_date, year, month, paid)
    SELECT valid.id, _uid,
      CASE WHEN valid.parent_type = 'purchase' THEN COALESCE(valid.parent_id, valid.purchase_id) ELSE valid.parent_id END,
      valid.parent_type, valid.purchase_id, GREATEST(COALESCE(valid.number, 1), 1),
      GREATEST(COALESCE(valid.total, 1), 1), COALESCE(valid.amount, 0),
      COALESCE(valid.due_date, CURRENT_DATE),
      COALESCE(valid.year, EXTRACT(YEAR FROM COALESCE(valid.due_date, CURRENT_DATE))::int),
      COALESCE(valid.month, EXTRACT(MONTH FROM COALESCE(valid.due_date, CURRENT_DATE))::int - 1),
      COALESCE(valid.paid, false)
    FROM valid
    ON CONFLICT (id) DO UPDATE SET user_id=EXCLUDED.user_id, parent_id=EXCLUDED.parent_id,
      parent_type=EXCLUDED.parent_type, purchase_id=EXCLUDED.purchase_id, number=EXCLUDED.number,
      total=EXCLUDED.total, amount=EXCLUDED.amount, due_date=EXCLUDED.due_date,
      year=EXCLUDED.year, month=EXCLUDED.month, paid=EXCLUDED.paid
    WHERE public.installments.user_id = _uid RETURNING 1
  ) SELECT count(*) INTO _installments FROM inserted;

  RETURN jsonb_build_object('purchases', _purchases, 'installments', _installments,
    'debits', _debits, 'incomes', _incomes, 'investments', _investments);
END;
$function$;


-- ──────────────────────────────────────────────────────────
-- Origem: 20260524165322_2288a6d2-5420-48f9-99c7-dfe61cb1a59d.sql
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS excluded_months text[] NOT NULL DEFAULT '{}';

-- ──────────────────────────────────────────────────────────
-- Origem: 20260524192915_5568ebae-6daf-4d8f-8be0-337837cb70e6.sql
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS position integer;

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY account_id ORDER BY created_at) AS rn
  FROM public.cards
)
UPDATE public.cards c SET position = r.rn FROM ranked r WHERE c.id = r.id AND c.position IS NULL;

ALTER TABLE public.cards ALTER COLUMN position SET DEFAULT 0;
ALTER TABLE public.cards ALTER COLUMN position SET NOT NULL;
CREATE INDEX IF NOT EXISTS cards_account_position_idx ON public.cards(account_id, position);

-- ──────────────────────────────────────────────────────────
-- Origem: 20260528101649_14038491-8771-4d47-9456-c2777c52f9ff.sql
-- ──────────────────────────────────────────────────────────
-- Revoke direct EXECUTE on internal SECURITY DEFINER helpers in public schema.
-- They are used by RLS policies (via app_private equivalents) and by auth triggers,
-- never called directly by client code. Removing public EXECUTE eliminates the
-- "anon/authenticated can execute SECURITY DEFINER function" surface and reduces
-- the privilege-escalation blast radius if user_roles INSERT is ever misconfigured.

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_email_whitelisted(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_whitelist_on_signup() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ──────────────────────────────────────────────────────────
-- Origem: 20260610003741_8209a7cc-1ba7-4c6c-aa2a-52ccf758a015.sql
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS recurrence_group_id uuid;
CREATE INDEX IF NOT EXISTS purchases_recurrence_group_id_idx ON public.purchases(recurrence_group_id);

-- ──────────────────────────────────────────────────────────
-- Origem: 20260703220202_4178a31e-331d-45e6-8010-455d30137c4c.sql
-- ──────────────────────────────────────────────────────────

CREATE TABLE public.recurring_deletions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  recurrence_group_id uuid NOT NULL,
  year int NOT NULL,
  month int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, recurrence_group_id, year, month)
);

CREATE INDEX idx_recurring_deletions_lookup
  ON public.recurring_deletions (user_id, recurrence_group_id, year, month);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_deletions TO authenticated;
GRANT ALL ON public.recurring_deletions TO service_role;

ALTER TABLE public.recurring_deletions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own recurring deletions"
  ON public.recurring_deletions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own recurring deletions"
  ON public.recurring_deletions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recurring deletions"
  ON public.recurring_deletions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recurring deletions"
  ON public.recurring_deletions FOR DELETE
  USING (auth.uid() = user_id);


-- ──────────────────────────────────────────────────────────
-- Origem: 20260704125533_c8510561-26ac-4fd9-8cc7-9c082e4d80f0.sql
-- ──────────────────────────────────────────────────────────

ALTER TABLE public.debits ADD COLUMN IF NOT EXISTS reference_year int;
ALTER TABLE public.debits ADD COLUMN IF NOT EXISTS reference_month int;
ALTER TABLE public.incomes ADD COLUMN IF NOT EXISTS reference_year int;
ALTER TABLE public.incomes ADD COLUMN IF NOT EXISTS reference_month int;

-- Backfill existing rows from the date field (month is 0-11 to match app convention).
UPDATE public.debits
SET reference_year = EXTRACT(YEAR FROM date)::int,
    reference_month = EXTRACT(MONTH FROM date)::int - 1
WHERE reference_year IS NULL OR reference_month IS NULL;

UPDATE public.incomes
SET reference_year = EXTRACT(YEAR FROM date)::int,
    reference_month = EXTRACT(MONTH FROM date)::int - 1
WHERE reference_year IS NULL OR reference_month IS NULL;

CREATE INDEX IF NOT EXISTS idx_debits_ref_ym ON public.debits(user_id, reference_year, reference_month);
CREATE INDEX IF NOT EXISTS idx_incomes_ref_ym ON public.incomes(user_id, reference_year, reference_month);


-- ──────────────────────────────────────────────────────────
-- Origem: 20260726120000_add_reference_date_and_amount_adjustments.sql
-- ──────────────────────────────────────────────────────────
-- Per-installment visual date override (P7-P9 scope: "só esta" / "esta e as
-- próximas" / "toda a conta"). NULL means "use the parent's shared date"
-- (purchases.purchase_date / debits.date / incomes.date) — the existing,
-- default behavior for every row created before this migration.
-- IMPORTANT: this column is a VISUAL reference only, same as due_date is
-- for month grouping — it must never be read as determining which month an
-- installment belongs to (that stays due_date/year/month).
ALTER TABLE public.installments ADD COLUMN IF NOT EXISTS reference_date date;

-- User-facing audit trail for scoped value adjustments on parcelados
-- (P10-P12): "valor original -> ajustado para". Distinct from the
-- session-only undo/redo history in src/store/history.ts.
CREATE TABLE IF NOT EXISTS public.amount_adjustments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  parent_type text NOT NULL,
  parent_id uuid NOT NULL,
  previous_total numeric(12,2) NOT NULL,
  new_total numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_amount_adjustments_parent
  ON public.amount_adjustments (parent_type, parent_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.amount_adjustments TO authenticated;
GRANT ALL ON public.amount_adjustments TO service_role;

ALTER TABLE public.amount_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own amount adjustments"
  ON public.amount_adjustments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own amount adjustments"
  ON public.amount_adjustments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own amount adjustments"
  ON public.amount_adjustments FOR DELETE
  USING (auth.uid() = user_id);



-- ──────────────────────────────────────────────────────────
-- Origem: 20260727000000_grant_whitelist_function_execute.sql
-- ──────────────────────────────────────────────────────────
-- Bug encontrado ao provisionar um projeto Supabase NOVO (fora do Lovable):
-- `is_email_whitelisted` e `has_role` nunca tiveram GRANT EXECUTE explicito
-- em nenhuma migration anterior. No projeto antigo (provisionado pelo
-- Lovable) isso nunca deu problema porque o Postgres/Supabase concedia
-- EXECUTE em funcoes novas a PUBLIC por padrao; projetos Supabase criados
-- mais recentemente vem com esse padrao revogado, entao qualquer chamada
-- do client autenticado a essas funcoes falha com
-- "permission denied for function ...".
--
-- `is_email_whitelisted` e chamada diretamente pelo client via
-- supabase.rpc(...) em src/store/auth.tsx logo apos o login -- sem esse
-- grant, TODO login falha silenciosamente (o app trata o erro da RPC como
-- "usuario nao autorizado" e desloga).
-- `has_role` e usada dentro das policies de RLS de user_roles/whitelist.
GRANT EXECUTE ON FUNCTION public.is_email_whitelisted(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;



-- ──────────────────────────────────────────────────────────
-- Origem: 20260728000000_due_debit_notifications.sql
-- ──────────────────────────────────────────────────────────
-- Notificacoes push de debitos a vencer. Cada debito pode ter sua propria
-- antecedencia de aviso (em dias), definida pelo usuario ao criar/editar o
-- lancamento. NULL = sem notificacao para esse item. `due_notified_at` evita
-- reenviar a mesma notificacao todo dia enquanto o debito continuar nao pago
-- dentro da janela.
ALTER TABLE public.debits
  ADD COLUMN IF NOT EXISTS notify_days_before integer,
  ADD COLUMN IF NOT EXISTS due_notified_at timestamptz;

COMMENT ON COLUMN public.debits.notify_days_before IS
  'Quantos dias antes do vencimento (date) o app deve enviar push notification. NULL = desativado para este lancamento.';
COMMENT ON COLUMN public.debits.due_notified_at IS
  'Timestamp da ultima push notification de vencimento enviada para este debito. Usado para nao notificar 2x.';

-- Extensoes necessarias para o cron chamar o endpoint HTTP do app. Em alguns
-- planos/projetos Supabase, pg_cron so pode ser habilitado pelo Dashboard
-- (Database > Extensions) -- se o CREATE EXTENSION abaixo falhar com
-- "permission denied", habilite por la e rode soh a parte do cron.schedule.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Passo manual (fora deste arquivo): projetos Supabase gerenciados nao
-- permitem ALTER DATABASE ... SET app.settings.*, entao a URL/segredo do
-- cron nao dao pra guardar como configuracao do banco. Rode o
-- cron.schedule com os valores reais direto no SQL editor (nao commitar
-- com os valores reais). Ver comentario completo em
-- supabase/migrations/20260728000000_due_debit_notifications.sql.



-- ──────────────────────────────────────────────────────────
-- Origem: 20260728010000_backfill_orphan_recurring_debits.sql
-- ──────────────────────────────────────────────────────────
-- Corrige débitos "recorrentes órfãos": required = true (tag "REC" na
-- lista) mas sem recurrence_group_id. Agrupa por (user_id, account_id,
-- description) e atribui um group id novo compartilhado. Em um projeto
-- recém-provisionado (sem dados) isso é um no-op.
WITH orphan_groups AS (
  SELECT DISTINCT user_id, account_id, description, gen_random_uuid() AS new_gid
  FROM public.debits
  WHERE required = true AND recurrence_group_id IS NULL
)
UPDATE public.debits d
SET recurrence_group_id = og.new_gid
FROM orphan_groups og
WHERE d.required = true
  AND d.recurrence_group_id IS NULL
  AND d.user_id = og.user_id
  AND d.account_id = og.account_id
  AND d.description = og.description;
