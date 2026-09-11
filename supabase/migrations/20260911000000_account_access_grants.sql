-- Acesso administrativo/entre usuários: uma conta pode conceder acesso de
-- leitura+escrita completo a outra (admin pedindo pela Whitelist, ou
-- qualquer usuário pedindo por e-mail). Uma linha = um pedido/concessão.
CREATE TABLE public.account_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_email text NOT NULL,
  owner_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'revoked', 'rejected')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  UNIQUE (requester_id, owner_id)
);

CREATE INDEX idx_account_access_grants_owner ON public.account_access_grants (owner_id, status);
CREATE INDEX idx_account_access_grants_requester ON public.account_access_grants (requester_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_access_grants TO authenticated;
GRANT ALL ON public.account_access_grants TO service_role;

ALTER TABLE public.account_access_grants ENABLE ROW LEVEL SECURITY;

-- Requester vê seus pedidos enviados; owner vê os recebidos.
CREATE POLICY "grants select own side" ON public.account_access_grants
  FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = owner_id);

-- Só é possível criar um pedido pendente em nome de si mesmo (como requester).
CREATE POLICY "grants insert as requester" ON public.account_access_grants
  FOR INSERT WITH CHECK (auth.uid() = requester_id AND status = 'pending');

-- Dono aprova/recusa/revoga a qualquer momento; quem pediu também pode
-- abrir mão do próprio acesso (revogar a si mesmo).
CREATE POLICY "grants update own side" ON public.account_access_grants
  FOR UPDATE USING (auth.uid() = requester_id OR auth.uid() = owner_id)
  WITH CHECK (auth.uid() = requester_id OR auth.uid() = owner_id);

-- Quem pediu pode cancelar o próprio pedido enquanto pendente.
CREATE POLICY "grants delete own pending" ON public.account_access_grants
  FOR DELETE USING (auth.uid() = requester_id AND status = 'pending');

-- ──────────────────────────────────────────────────────────
-- Helper de RLS: mesmo padrão de app_private.has_role — usado dentro das
-- policies das tabelas de dado financeiro para permitir acesso tanto ao
-- dono quanto a quem tenha uma concessão ativa.
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION app_private.has_account_access(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() = target_user_id
    OR EXISTS (
      SELECT 1 FROM public.account_access_grants
      WHERE requester_id = auth.uid()
        AND owner_id = target_user_id
        AND status = 'active'
    )
$$;

REVOKE ALL ON FUNCTION app_private.has_account_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.has_account_access(uuid) TO authenticated;

-- ──────────────────────────────────────────────────────────
-- Troca as policies de "auth.uid() = user_id" para
-- "app_private.has_account_access(user_id)" nas tabelas de dado de conta.
-- Ficam de fora (nunca delegadas): user_passkeys, push_subscriptions,
-- webauthn_challenges (segurança/dispositivo) e as tabelas de governança
-- do app (user_roles, whitelist, blacklist, access_requests).
-- ──────────────────────────────────────────────────────────

-- accounts
DROP POLICY IF EXISTS "own accounts select" ON public.accounts;
DROP POLICY IF EXISTS "own accounts insert" ON public.accounts;
DROP POLICY IF EXISTS "own accounts update" ON public.accounts;
DROP POLICY IF EXISTS "own accounts delete" ON public.accounts;
CREATE POLICY "own accounts select" ON public.accounts FOR SELECT USING (app_private.has_account_access(user_id));
CREATE POLICY "own accounts insert" ON public.accounts FOR INSERT WITH CHECK (app_private.has_account_access(user_id));
CREATE POLICY "own accounts update" ON public.accounts FOR UPDATE USING (app_private.has_account_access(user_id));
CREATE POLICY "own accounts delete" ON public.accounts FOR DELETE USING (app_private.has_account_access(user_id));

-- cards
DROP POLICY IF EXISTS "own cards select" ON public.cards;
DROP POLICY IF EXISTS "own cards insert" ON public.cards;
DROP POLICY IF EXISTS "own cards update" ON public.cards;
DROP POLICY IF EXISTS "own cards delete" ON public.cards;
CREATE POLICY "own cards select" ON public.cards FOR SELECT USING (app_private.has_account_access(user_id));
CREATE POLICY "own cards insert" ON public.cards FOR INSERT WITH CHECK (app_private.has_account_access(user_id));
CREATE POLICY "own cards update" ON public.cards FOR UPDATE USING (app_private.has_account_access(user_id));
CREATE POLICY "own cards delete" ON public.cards FOR DELETE USING (app_private.has_account_access(user_id));

-- purchases
DROP POLICY IF EXISTS "own purchases select" ON public.purchases;
DROP POLICY IF EXISTS "own purchases insert" ON public.purchases;
DROP POLICY IF EXISTS "own purchases update" ON public.purchases;
DROP POLICY IF EXISTS "own purchases delete" ON public.purchases;
CREATE POLICY "own purchases select" ON public.purchases FOR SELECT USING (app_private.has_account_access(user_id));
CREATE POLICY "own purchases insert" ON public.purchases FOR INSERT WITH CHECK (app_private.has_account_access(user_id));
CREATE POLICY "own purchases update" ON public.purchases FOR UPDATE USING (app_private.has_account_access(user_id));
CREATE POLICY "own purchases delete" ON public.purchases FOR DELETE USING (app_private.has_account_access(user_id));

-- installments
DROP POLICY IF EXISTS "own installments select" ON public.installments;
DROP POLICY IF EXISTS "own installments insert" ON public.installments;
DROP POLICY IF EXISTS "own installments update" ON public.installments;
DROP POLICY IF EXISTS "own installments delete" ON public.installments;
CREATE POLICY "own installments select" ON public.installments FOR SELECT USING (app_private.has_account_access(user_id));
CREATE POLICY "own installments insert" ON public.installments FOR INSERT WITH CHECK (app_private.has_account_access(user_id));
CREATE POLICY "own installments update" ON public.installments FOR UPDATE USING (app_private.has_account_access(user_id));
CREATE POLICY "own installments delete" ON public.installments FOR DELETE USING (app_private.has_account_access(user_id));

-- debits
DROP POLICY IF EXISTS "own debits select" ON public.debits;
DROP POLICY IF EXISTS "own debits insert" ON public.debits;
DROP POLICY IF EXISTS "own debits update" ON public.debits;
DROP POLICY IF EXISTS "own debits delete" ON public.debits;
CREATE POLICY "own debits select" ON public.debits FOR SELECT USING (app_private.has_account_access(user_id));
CREATE POLICY "own debits insert" ON public.debits FOR INSERT WITH CHECK (app_private.has_account_access(user_id));
CREATE POLICY "own debits update" ON public.debits FOR UPDATE USING (app_private.has_account_access(user_id));
CREATE POLICY "own debits delete" ON public.debits FOR DELETE USING (app_private.has_account_access(user_id));

-- incomes
DROP POLICY IF EXISTS "own incomes select" ON public.incomes;
DROP POLICY IF EXISTS "own incomes insert" ON public.incomes;
DROP POLICY IF EXISTS "own incomes update" ON public.incomes;
DROP POLICY IF EXISTS "own incomes delete" ON public.incomes;
CREATE POLICY "own incomes select" ON public.incomes FOR SELECT USING (app_private.has_account_access(user_id));
CREATE POLICY "own incomes insert" ON public.incomes FOR INSERT WITH CHECK (app_private.has_account_access(user_id));
CREATE POLICY "own incomes update" ON public.incomes FOR UPDATE USING (app_private.has_account_access(user_id));
CREATE POLICY "own incomes delete" ON public.incomes FOR DELETE USING (app_private.has_account_access(user_id));

-- investments
DROP POLICY IF EXISTS "own investments select" ON public.investments;
DROP POLICY IF EXISTS "own investments insert" ON public.investments;
DROP POLICY IF EXISTS "own investments update" ON public.investments;
DROP POLICY IF EXISTS "own investments delete" ON public.investments;
CREATE POLICY "own investments select" ON public.investments FOR SELECT USING (app_private.has_account_access(user_id));
CREATE POLICY "own investments insert" ON public.investments FOR INSERT WITH CHECK (app_private.has_account_access(user_id));
CREATE POLICY "own investments update" ON public.investments FOR UPDATE USING (app_private.has_account_access(user_id));
CREATE POLICY "own investments delete" ON public.investments FOR DELETE USING (app_private.has_account_access(user_id));

-- card_payments
DROP POLICY IF EXISTS "own cp select" ON public.card_payments;
DROP POLICY IF EXISTS "own cp insert" ON public.card_payments;
DROP POLICY IF EXISTS "own cp update" ON public.card_payments;
DROP POLICY IF EXISTS "own cp delete" ON public.card_payments;
CREATE POLICY "own cp select" ON public.card_payments FOR SELECT USING (app_private.has_account_access(user_id));
CREATE POLICY "own cp insert" ON public.card_payments FOR INSERT WITH CHECK (app_private.has_account_access(user_id));
CREATE POLICY "own cp update" ON public.card_payments FOR UPDATE USING (app_private.has_account_access(user_id));
CREATE POLICY "own cp delete" ON public.card_payments FOR DELETE USING (app_private.has_account_access(user_id));

-- catalog_items
DROP POLICY IF EXISTS "own catalog_items select" ON public.catalog_items;
DROP POLICY IF EXISTS "own catalog_items insert" ON public.catalog_items;
DROP POLICY IF EXISTS "own catalog_items update" ON public.catalog_items;
DROP POLICY IF EXISTS "own catalog_items delete" ON public.catalog_items;
CREATE POLICY "own catalog_items select" ON public.catalog_items FOR SELECT USING (app_private.has_account_access(user_id));
CREATE POLICY "own catalog_items insert" ON public.catalog_items FOR INSERT WITH CHECK (app_private.has_account_access(user_id));
CREATE POLICY "own catalog_items update" ON public.catalog_items FOR UPDATE USING (app_private.has_account_access(user_id));
CREATE POLICY "own catalog_items delete" ON public.catalog_items FOR DELETE USING (app_private.has_account_access(user_id));

-- payment_methods
DROP POLICY IF EXISTS "own payment_methods select" ON public.payment_methods;
DROP POLICY IF EXISTS "own payment_methods insert" ON public.payment_methods;
DROP POLICY IF EXISTS "own payment_methods update" ON public.payment_methods;
DROP POLICY IF EXISTS "own payment_methods delete" ON public.payment_methods;
CREATE POLICY "own payment_methods select" ON public.payment_methods FOR SELECT USING (app_private.has_account_access(user_id));
CREATE POLICY "own payment_methods insert" ON public.payment_methods FOR INSERT WITH CHECK (app_private.has_account_access(user_id));
CREATE POLICY "own payment_methods update" ON public.payment_methods FOR UPDATE USING (app_private.has_account_access(user_id));
CREATE POLICY "own payment_methods delete" ON public.payment_methods FOR DELETE USING (app_private.has_account_access(user_id));

-- profiles (nome/avatar exibidos ao "ver como" outra conta)
DROP POLICY IF EXISTS "own profile select" ON public.profiles;
DROP POLICY IF EXISTS "own profile insert" ON public.profiles;
DROP POLICY IF EXISTS "own profile update" ON public.profiles;
DROP POLICY IF EXISTS "own profile delete" ON public.profiles;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT USING (app_private.has_account_access(user_id));
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT WITH CHECK (app_private.has_account_access(user_id));
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE USING (app_private.has_account_access(user_id));
CREATE POLICY "own profile delete" ON public.profiles FOR DELETE USING (app_private.has_account_access(user_id));

-- irpf_documents
DROP POLICY IF EXISTS "own irpf_docs select" ON public.irpf_documents;
DROP POLICY IF EXISTS "own irpf_docs insert" ON public.irpf_documents;
DROP POLICY IF EXISTS "own irpf_docs update" ON public.irpf_documents;
DROP POLICY IF EXISTS "own irpf_docs delete" ON public.irpf_documents;
CREATE POLICY "own irpf_docs select" ON public.irpf_documents FOR SELECT USING (app_private.has_account_access(user_id));
CREATE POLICY "own irpf_docs insert" ON public.irpf_documents FOR INSERT WITH CHECK (app_private.has_account_access(user_id));
CREATE POLICY "own irpf_docs update" ON public.irpf_documents FOR UPDATE USING (app_private.has_account_access(user_id));
CREATE POLICY "own irpf_docs delete" ON public.irpf_documents FOR DELETE USING (app_private.has_account_access(user_id));

-- irpf_entries
DROP POLICY IF EXISTS "own irpf_entries select" ON public.irpf_entries;
DROP POLICY IF EXISTS "own irpf_entries insert" ON public.irpf_entries;
DROP POLICY IF EXISTS "own irpf_entries update" ON public.irpf_entries;
DROP POLICY IF EXISTS "own irpf_entries delete" ON public.irpf_entries;
CREATE POLICY "own irpf_entries select" ON public.irpf_entries FOR SELECT USING (app_private.has_account_access(user_id));
CREATE POLICY "own irpf_entries insert" ON public.irpf_entries FOR INSERT WITH CHECK (app_private.has_account_access(user_id));
CREATE POLICY "own irpf_entries update" ON public.irpf_entries FOR UPDATE USING (app_private.has_account_access(user_id));
CREATE POLICY "own irpf_entries delete" ON public.irpf_entries FOR DELETE USING (app_private.has_account_access(user_id));

-- irpf_year_snapshots
DROP POLICY IF EXISTS "own irpf_snap select" ON public.irpf_year_snapshots;
DROP POLICY IF EXISTS "own irpf_snap insert" ON public.irpf_year_snapshots;
DROP POLICY IF EXISTS "own irpf_snap update" ON public.irpf_year_snapshots;
DROP POLICY IF EXISTS "own irpf_snap delete" ON public.irpf_year_snapshots;
CREATE POLICY "own irpf_snap select" ON public.irpf_year_snapshots FOR SELECT USING (app_private.has_account_access(user_id));
CREATE POLICY "own irpf_snap insert" ON public.irpf_year_snapshots FOR INSERT WITH CHECK (app_private.has_account_access(user_id));
CREATE POLICY "own irpf_snap update" ON public.irpf_year_snapshots FOR UPDATE USING (app_private.has_account_access(user_id));
CREATE POLICY "own irpf_snap delete" ON public.irpf_year_snapshots FOR DELETE USING (app_private.has_account_access(user_id));

-- app_snapshots
DROP POLICY IF EXISTS "own snapshots select" ON public.app_snapshots;
DROP POLICY IF EXISTS "own snapshots insert" ON public.app_snapshots;
DROP POLICY IF EXISTS "own snapshots update" ON public.app_snapshots;
DROP POLICY IF EXISTS "own snapshots delete" ON public.app_snapshots;
CREATE POLICY "own snapshots select" ON public.app_snapshots FOR SELECT USING (app_private.has_account_access(user_id));
CREATE POLICY "own snapshots insert" ON public.app_snapshots FOR INSERT WITH CHECK (app_private.has_account_access(user_id));
CREATE POLICY "own snapshots update" ON public.app_snapshots FOR UPDATE USING (app_private.has_account_access(user_id));
CREATE POLICY "own snapshots delete" ON public.app_snapshots FOR DELETE USING (app_private.has_account_access(user_id));

-- recurring_deletions
DROP POLICY IF EXISTS "Users can view their own recurring deletions" ON public.recurring_deletions;
DROP POLICY IF EXISTS "Users can insert their own recurring deletions" ON public.recurring_deletions;
DROP POLICY IF EXISTS "Users can update their own recurring deletions" ON public.recurring_deletions;
DROP POLICY IF EXISTS "Users can delete their own recurring deletions" ON public.recurring_deletions;
CREATE POLICY "Users can view their own recurring deletions" ON public.recurring_deletions FOR SELECT USING (app_private.has_account_access(user_id));
CREATE POLICY "Users can insert their own recurring deletions" ON public.recurring_deletions FOR INSERT WITH CHECK (app_private.has_account_access(user_id));
CREATE POLICY "Users can update their own recurring deletions" ON public.recurring_deletions FOR UPDATE USING (app_private.has_account_access(user_id));
CREATE POLICY "Users can delete their own recurring deletions" ON public.recurring_deletions FOR DELETE USING (app_private.has_account_access(user_id));

-- amount_adjustments (sem policy de update no original)
DROP POLICY IF EXISTS "Users can view their own amount adjustments" ON public.amount_adjustments;
DROP POLICY IF EXISTS "Users can insert their own amount adjustments" ON public.amount_adjustments;
DROP POLICY IF EXISTS "Users can delete their own amount adjustments" ON public.amount_adjustments;
CREATE POLICY "Users can view their own amount adjustments" ON public.amount_adjustments FOR SELECT USING (app_private.has_account_access(user_id));
CREATE POLICY "Users can insert their own amount adjustments" ON public.amount_adjustments FOR INSERT WITH CHECK (app_private.has_account_access(user_id));
CREATE POLICY "Users can delete their own amount adjustments" ON public.amount_adjustments FOR DELETE USING (app_private.has_account_access(user_id));
