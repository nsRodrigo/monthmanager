
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
