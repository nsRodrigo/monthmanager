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