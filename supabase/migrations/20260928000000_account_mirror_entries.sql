-- Contas como produtos + lançamentos espelhados entre contas.
--
-- 1) Cada conta vira um item do catálogo "Locais e Produtos" (catalog_items.account_id).
--    Escolher esse item na descrição de um débito/recebimento cria o
--    lançamento nas DUAS contas (débito de um lado, recebimento do outro).
-- 2) Os dois lados ficam ligados por `mirror_id` (debits, incomes e
--    installments). Editar valor/data/mês/status ou excluir um dos lados
--    reflete no outro, feito por trigger — assim vale para qualquer tela ou
--    função do app que mexa nessas tabelas.
--
-- Os triggers só propagam quando a operação vem do usuário (pg_trigger_depth() = 0),
-- então o UPDATE/DELETE que eles mesmos fazem no lado espelhado não volta em loop,
-- e cascatas do banco não apagam a outra conta por engano.

-- ───────────────────────── 1) catálogo ─────────────────────────
ALTER TABLE public.catalog_items
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_catalog_items_account
  ON public.catalog_items(account_id) WHERE account_id IS NOT NULL;

-- Mesma normalização usada pelo app (trim + minúsculas + espaços colapsados).
CREATE OR REPLACE FUNCTION public.catalog_normalize(p TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(regexp_replace(btrim(p, E' \t\r\n'), '\s+', ' ', 'g'))
$$;

CREATE OR REPLACE FUNCTION public.sync_account_catalog_item() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_norm TEXT := public.catalog_normalize(NEW.name);
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.name IS NOT DISTINCT FROM OLD.name THEN
      RETURN NEW;
    END IF;
    BEGIN
      UPDATE public.catalog_items
         SET name = NEW.name, name_normalized = v_norm
       WHERE account_id = NEW.id;
      IF FOUND THEN
        RETURN NEW;
      END IF;
    EXCEPTION WHEN unique_violation THEN
      -- Já existe outro item com esse nome: mantém o antigo em vez de travar
      -- a renomeação da conta.
      RETURN NEW;
    END;
  END IF;

  -- Conta nova (ou sem item ainda): aproveita um item solto com o mesmo nome
  -- ou cria um novo.
  UPDATE public.catalog_items
     SET account_id = NEW.id, name = NEW.name
   WHERE user_id = NEW.user_id AND name_normalized = v_norm AND account_id IS NULL;
  IF NOT FOUND THEN
    INSERT INTO public.catalog_items (user_id, name, name_normalized, usage_count, account_id)
    VALUES (NEW.user_id, NEW.name, v_norm, 0, NEW.id)
    ON CONFLICT (user_id, name_normalized) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_accounts_catalog_item ON public.accounts;
CREATE TRIGGER trg_accounts_catalog_item
  AFTER INSERT OR UPDATE OF name ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.sync_account_catalog_item();

-- Contas que já existem.
UPDATE public.catalog_items c
   SET account_id = a.id, name = a.name
  FROM public.accounts a
 WHERE c.user_id = a.user_id
   AND c.name_normalized = public.catalog_normalize(a.name)
   AND c.account_id IS NULL
   AND NOT EXISTS (SELECT 1 FROM public.catalog_items x WHERE x.account_id = a.id);

INSERT INTO public.catalog_items (user_id, name, name_normalized, usage_count, account_id)
SELECT a.user_id, a.name, public.catalog_normalize(a.name), 0, a.id
  FROM public.accounts a
 WHERE NOT EXISTS (SELECT 1 FROM public.catalog_items x WHERE x.account_id = a.id)
ON CONFLICT (user_id, name_normalized) DO NOTHING;

-- ───────────────────────── 2) colunas de espelho ─────────────────────────
ALTER TABLE public.debits       ADD COLUMN IF NOT EXISTS mirror_id UUID;
ALTER TABLE public.incomes      ADD COLUMN IF NOT EXISTS mirror_id UUID;
ALTER TABLE public.installments ADD COLUMN IF NOT EXISTS mirror_id UUID;

CREATE INDEX IF NOT EXISTS idx_debits_mirror       ON public.debits(mirror_id)       WHERE mirror_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_incomes_mirror      ON public.incomes(mirror_id)      WHERE mirror_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_installments_mirror ON public.installments(mirror_id) WHERE mirror_id IS NOT NULL;

-- ───────────────────────── 3) edição espelhada ─────────────────────────
-- Espelha valor, data, mês de referência, status e nº de parcelas. A
-- descrição e o meio de pagamento ficam livres em cada lado.
CREATE OR REPLACE FUNCTION public.sync_debit_to_income() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.incomes SET
    amount = NEW.amount, date = NEW.date,
    reference_year = NEW.reference_year, reference_month = NEW.reference_month,
    received = NEW.paid,
    installments_count = NEW.installments_count, is_parent = NEW.is_parent
  WHERE id = NEW.mirror_id AND user_id = NEW.user_id;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.sync_income_to_debit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.debits SET
    amount = NEW.amount, date = NEW.date,
    reference_year = NEW.reference_year, reference_month = NEW.reference_month,
    paid = NEW.received,
    installments_count = NEW.installments_count, is_parent = NEW.is_parent
  WHERE id = NEW.mirror_id AND user_id = NEW.user_id;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.sync_installment_mirror() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.installments SET
    amount = NEW.amount, due_date = NEW.due_date,
    month = NEW.month, year = NEW.year, number = NEW.number,
    paid = NEW.paid, total = NEW.total
  WHERE id = NEW.mirror_id AND user_id = NEW.user_id;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_debits_mirror_update ON public.debits;
CREATE TRIGGER trg_debits_mirror_update
  AFTER UPDATE ON public.debits
  FOR EACH ROW
  WHEN (
    pg_trigger_depth() = 0
    AND NEW.mirror_id IS NOT NULL
    AND OLD.mirror_id IS NOT DISTINCT FROM NEW.mirror_id
    AND (OLD.amount, OLD.date, OLD.reference_year, OLD.reference_month, OLD.paid, OLD.installments_count, OLD.is_parent)
        IS DISTINCT FROM
        (NEW.amount, NEW.date, NEW.reference_year, NEW.reference_month, NEW.paid, NEW.installments_count, NEW.is_parent)
  )
  EXECUTE FUNCTION public.sync_debit_to_income();

DROP TRIGGER IF EXISTS trg_incomes_mirror_update ON public.incomes;
CREATE TRIGGER trg_incomes_mirror_update
  AFTER UPDATE ON public.incomes
  FOR EACH ROW
  WHEN (
    pg_trigger_depth() = 0
    AND NEW.mirror_id IS NOT NULL
    AND OLD.mirror_id IS NOT DISTINCT FROM NEW.mirror_id
    AND (OLD.amount, OLD.date, OLD.reference_year, OLD.reference_month, OLD.received, OLD.installments_count, OLD.is_parent)
        IS DISTINCT FROM
        (NEW.amount, NEW.date, NEW.reference_year, NEW.reference_month, NEW.received, NEW.installments_count, NEW.is_parent)
  )
  EXECUTE FUNCTION public.sync_income_to_debit();

DROP TRIGGER IF EXISTS trg_installments_mirror_update ON public.installments;
CREATE TRIGGER trg_installments_mirror_update
  AFTER UPDATE ON public.installments
  FOR EACH ROW
  WHEN (
    pg_trigger_depth() = 0
    AND NEW.mirror_id IS NOT NULL
    AND OLD.mirror_id IS NOT DISTINCT FROM NEW.mirror_id
    AND (OLD.amount, OLD.due_date, OLD.month, OLD.year, OLD.number, OLD.paid, OLD.total)
        IS DISTINCT FROM
        (NEW.amount, NEW.due_date, NEW.month, NEW.year, NEW.number, NEW.paid, NEW.total)
  )
  EXECUTE FUNCTION public.sync_installment_mirror();

-- ───────────────────────── 4) exclusão espelhada ─────────────────────────
CREATE OR REPLACE FUNCTION public.delete_debit_mirror() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.installments
   WHERE parent_id = OLD.mirror_id AND parent_type = 'income' AND user_id = OLD.user_id;
  DELETE FROM public.incomes WHERE id = OLD.mirror_id AND user_id = OLD.user_id;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.delete_income_mirror() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.installments
   WHERE parent_id = OLD.mirror_id AND parent_type = 'debit' AND user_id = OLD.user_id;
  DELETE FROM public.debits WHERE id = OLD.mirror_id AND user_id = OLD.user_id;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.delete_installment_mirror() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.installments WHERE id = OLD.mirror_id AND user_id = OLD.user_id;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_debits_mirror_delete ON public.debits;
CREATE TRIGGER trg_debits_mirror_delete
  AFTER DELETE ON public.debits
  FOR EACH ROW
  WHEN (pg_trigger_depth() = 0 AND OLD.mirror_id IS NOT NULL)
  EXECUTE FUNCTION public.delete_debit_mirror();

DROP TRIGGER IF EXISTS trg_incomes_mirror_delete ON public.incomes;
CREATE TRIGGER trg_incomes_mirror_delete
  AFTER DELETE ON public.incomes
  FOR EACH ROW
  WHEN (pg_trigger_depth() = 0 AND OLD.mirror_id IS NOT NULL)
  EXECUTE FUNCTION public.delete_income_mirror();

DROP TRIGGER IF EXISTS trg_installments_mirror_delete ON public.installments;
CREATE TRIGGER trg_installments_mirror_delete
  AFTER DELETE ON public.installments
  FOR EACH ROW
  WHEN (pg_trigger_depth() = 0 AND OLD.mirror_id IS NOT NULL)
  EXECUTE FUNCTION public.delete_installment_mirror();

-- ───────────────────────── 5) ligar os dois lados ─────────────────────────
-- Chamada pelo app logo depois de criar o débito e o recebimento. Liga os
-- registros pai, as parcelas (pelo número) e, em séries recorrentes, cada
-- mês (pelo ano/mês). Se algum mês existir só de um lado, cria o outro.
-- SECURITY INVOKER de propósito: respeita as políticas de acesso de quem chama.
CREATE OR REPLACE FUNCTION public.link_mirror_entries(p_debit_id UUID, p_income_id UUID)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  d public.debits%ROWTYPE;
  i public.incomes%ROWTYPE;
BEGIN
  SELECT * INTO d FROM public.debits  WHERE id = p_debit_id;
  SELECT * INTO i FROM public.incomes WHERE id = p_income_id;
  IF d.id IS NULL OR i.id IS NULL THEN
    RAISE EXCEPTION 'link_mirror_entries: lançamento não encontrado';
  END IF;
  IF d.user_id <> i.user_id THEN
    RAISE EXCEPTION 'link_mirror_entries: lançamentos de donos diferentes';
  END IF;
  IF d.account_id = i.account_id THEN
    RAISE EXCEPTION 'link_mirror_entries: as duas pontas são a mesma conta';
  END IF;

  IF d.recurrence_group_id IS NOT NULL AND i.recurrence_group_id IS NOT NULL THEN
    -- Série recorrente: pareia mês a mês.
    UPDATE public.debits x SET mirror_id = y.id
      FROM public.incomes y
     WHERE x.recurrence_group_id = d.recurrence_group_id AND x.account_id = d.account_id
       AND y.recurrence_group_id = i.recurrence_group_id AND y.account_id = i.account_id
       AND x.reference_year = y.reference_year AND x.reference_month = y.reference_month
       AND x.mirror_id IS NULL AND y.mirror_id IS NULL;
    UPDATE public.incomes y SET mirror_id = x.id
      FROM public.debits x
     WHERE x.mirror_id = y.id
       AND y.recurrence_group_id = i.recurrence_group_id AND y.account_id = i.account_id
       AND y.mirror_id IS NULL;

    -- Mês que só existe no débito: cria o recebimento correspondente.
    WITH ins AS (
      INSERT INTO public.incomes (id, user_id, account_id, description, amount, date, received,
                                  installments_count, is_parent, recurrence_group_id,
                                  reference_year, reference_month, mirror_id)
      SELECT gen_random_uuid(), x.user_id, i.account_id, i.description, x.amount, x.date, x.paid,
             1, false, i.recurrence_group_id, x.reference_year, x.reference_month, x.id
        FROM public.debits x
       WHERE x.recurrence_group_id = d.recurrence_group_id AND x.account_id = d.account_id
         AND x.mirror_id IS NULL
      RETURNING id, mirror_id
    )
    UPDATE public.debits x SET mirror_id = ins.id FROM ins WHERE x.id = ins.mirror_id;

    -- Mês que só existe no recebimento: cria o débito correspondente.
    WITH ins AS (
      INSERT INTO public.debits (id, user_id, account_id, description, amount, date, required, paid,
                                 installments_count, is_parent, recurrence_group_id,
                                 reference_year, reference_month, mirror_id)
      SELECT gen_random_uuid(), y.user_id, d.account_id, d.description, y.amount, y.date, true, y.received,
             1, false, d.recurrence_group_id, y.reference_year, y.reference_month, y.id
        FROM public.incomes y
       WHERE y.recurrence_group_id = i.recurrence_group_id AND y.account_id = i.account_id
         AND y.mirror_id IS NULL
      RETURNING id, mirror_id
    )
    UPDATE public.incomes y SET mirror_id = ins.id FROM ins WHERE y.id = ins.mirror_id;
  ELSE
    -- Único ou parcelado: liga o registro pai e as parcelas de mesmo número.
    UPDATE public.debits  SET mirror_id = p_income_id WHERE id = p_debit_id;
    UPDATE public.incomes SET mirror_id = p_debit_id  WHERE id = p_income_id;

    UPDATE public.installments a SET mirror_id = b.id
      FROM public.installments b
     WHERE a.parent_type = 'debit'  AND a.parent_id = p_debit_id
       AND b.parent_type = 'income' AND b.parent_id = p_income_id
       AND a.number = b.number;
    UPDATE public.installments b SET mirror_id = a.id
      FROM public.installments a
     WHERE b.parent_type = 'income' AND b.parent_id = p_income_id
       AND a.mirror_id = b.id;
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.link_mirror_entries(UUID, UUID) TO authenticated;
