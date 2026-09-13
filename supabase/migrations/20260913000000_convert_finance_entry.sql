-- Move um lançamento (compra/débito/recebimento/investimento) para outro
-- tipo, preservando cada parcela no mês em que já estava cadastrada.
--
-- Assimetria de schema que essa função precisa respeitar: `purchases` SEMPRE
-- tem pelo menos 1 linha em `installments` (mesmo à vista); `debits`/
-- `incomes`/`investments` com installments_count=1 (não recorrente) NÃO têm
-- nenhuma linha em `installments` — o mês vem de reference_year/reference_month
-- na própria linha. Por isso "usa a tabela installments?" = (tipo='purchase'
-- OR installments_count>1), tanto na origem quanto no destino, e isso decide
-- se a gente só RE-APONTA as parcelas existentes (preservando year/month
-- intocados) ou se precisa criar/apagar uma única linha de installments.
--
-- SECURITY DEFINER ignora RLS, então a autorização é refeita manualmente via
-- app_private.has_account_access (mesma função usada nas policies de
-- purchases/debits/incomes/investments/installments), para continuar
-- funcionando quando quem chama está "vendo como" uma conta delegada.
CREATE OR REPLACE FUNCTION public.convert_finance_entry(
  _from_type text,
  _from_id uuid,
  _to_type text,
  _card_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _owner_id uuid;
  _account_id uuid;
  _new_id uuid := gen_random_uuid();
  _description text;
  _amount numeric;
  _date date;
  _installments_count int;
  _ref_year int;
  _ref_month int;
  _paid boolean;
  _payment_method text;
  _from_uses boolean;
  _to_uses boolean;
  _inst RECORD;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _from_type NOT IN ('purchase','debit','income','investment') THEN
    RAISE EXCEPTION 'Tipo de origem inválido: %', _from_type;
  END IF;
  IF _to_type NOT IN ('purchase','debit','income','investment') THEN
    RAISE EXCEPTION 'Tipo de destino inválido: %', _to_type;
  END IF;
  IF _from_type = _to_type THEN
    RAISE EXCEPTION 'Tipo de origem e destino são iguais';
  END IF;

  -- 1) Carrega a origem (recusa recorrentes — defesa em profundidade, a UI
  --    já não permite chegar aqui com um lançamento recorrente).
  IF _from_type = 'purchase' THEN
    SELECT p.user_id, c.account_id, p.description, p.total_amount, p.purchase_date, p.installments_count
      INTO _owner_id, _account_id, _description, _amount, _date, _installments_count
      FROM public.purchases p
      JOIN public.cards c ON c.id = p.card_id
      WHERE p.id = _from_id AND p.recurrence_group_id IS NULL;
  ELSIF _from_type = 'debit' THEN
    SELECT user_id, account_id, description, amount, date, installments_count, reference_year, reference_month, paid, payment_method
      INTO _owner_id, _account_id, _description, _amount, _date, _installments_count, _ref_year, _ref_month, _paid, _payment_method
      FROM public.debits WHERE id = _from_id AND recurrence_group_id IS NULL;
  ELSIF _from_type = 'income' THEN
    SELECT user_id, account_id, description, amount, date, installments_count, reference_year, reference_month, received, payment_method
      INTO _owner_id, _account_id, _description, _amount, _date, _installments_count, _ref_year, _ref_month, _paid, _payment_method
      FROM public.incomes WHERE id = _from_id AND recurrence_group_id IS NULL;
  ELSIF _from_type = 'investment' THEN
    SELECT user_id, account_id, type, amount, date, installments_count, reference_year, reference_month
      INTO _owner_id, _account_id, _description, _amount, _date, _installments_count, _ref_year, _ref_month
      FROM public.investments WHERE id = _from_id AND recurrence_group_id IS NULL;
    _paid := false;
  END IF;

  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Lançamento de origem não encontrado ou é recorrente';
  END IF;

  -- 2) Autorização: dono real OU acesso delegado ativo à conta dona.
  IF NOT app_private.has_account_access(_owner_id) THEN
    RAISE EXCEPTION 'Sem permissão para mover este lançamento';
  END IF;

  -- 3) Destino=compra exige cartão, e só da MESMA conta da origem — esta
  --    ação só troca o tipo, nunca a conta (trocar de conta continua sendo
  --    a troca de cartão já existente, feita à parte).
  IF _to_type = 'purchase' THEN
    IF _card_id IS NULL THEN
      RAISE EXCEPTION 'Selecione um cartão para mover para compra';
    END IF;
    PERFORM 1 FROM public.cards WHERE id = _card_id AND account_id = _account_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cartão inválido para esta conta';
    END IF;
  END IF;

  _from_uses := (_from_type = 'purchase') OR (_installments_count > 1);
  _to_uses := (_to_type = 'purchase') OR (_installments_count > 1);

  -- 4) Cria a linha nova no tipo de destino. reference_year/reference_month
  --    só são preenchidos quando o destino NÃO vai usar `installments`
  --    (mesma regra que useAddDebit/useAddIncome/useAddInvestment já usam
  --    hoje para itens parcelados: ficam NULL quando há installments).
  IF _to_type = 'purchase' THEN
    INSERT INTO public.purchases (id, user_id, card_id, description, total_amount, purchase_date, installments_count)
    VALUES (_new_id, _owner_id, _card_id, _description, _amount, _date, _installments_count);
  ELSIF _to_type = 'debit' THEN
    INSERT INTO public.debits (
      id, user_id, account_id, description, amount, date, required, paid, payment_method,
      installments_count, is_parent, reference_year, reference_month
    ) VALUES (
      _new_id, _owner_id, _account_id, _description, _amount, _date, false, COALESCE(_paid, false),
      CASE WHEN _from_type = 'income' THEN _payment_method ELSE NULL END,
      _installments_count, _installments_count > 1,
      CASE WHEN _to_uses THEN NULL ELSE COALESCE(_ref_year, EXTRACT(YEAR FROM _date)::int) END,
      CASE WHEN _to_uses THEN NULL ELSE COALESCE(_ref_month, EXTRACT(MONTH FROM _date)::int - 1) END
    );
  ELSIF _to_type = 'income' THEN
    INSERT INTO public.incomes (
      id, user_id, account_id, description, amount, date, received, payment_method,
      installments_count, is_parent, reference_year, reference_month
    ) VALUES (
      _new_id, _owner_id, _account_id, _description, _amount, _date, COALESCE(_paid, false),
      CASE WHEN _from_type = 'debit' THEN _payment_method ELSE NULL END,
      _installments_count, _installments_count > 1,
      CASE WHEN _to_uses THEN NULL ELSE COALESCE(_ref_year, EXTRACT(YEAR FROM _date)::int) END,
      CASE WHEN _to_uses THEN NULL ELSE COALESCE(_ref_month, EXTRACT(MONTH FROM _date)::int - 1) END
    );
  ELSIF _to_type = 'investment' THEN
    INSERT INTO public.investments (
      id, user_id, account_id, type, amount, percentage, date,
      installments_count, is_parent, reference_year, reference_month
    ) VALUES (
      _new_id, _owner_id, _account_id, _description, _amount, 0, _date,
      _installments_count, _installments_count > 1,
      CASE WHEN _to_uses THEN NULL ELSE COALESCE(_ref_year, EXTRACT(YEAR FROM _date)::int) END,
      CASE WHEN _to_uses THEN NULL ELSE COALESCE(_ref_month, EXTRACT(MONTH FROM _date)::int - 1) END
    );
  END IF;

  -- 5) Trata `installments`, sempre ANTES de apagar a linha de origem.
  IF _from_uses AND _to_uses THEN
    -- Ambos usam: só re-aponta. Não toca year/month/amount/paid de nenhuma
    -- parcela — é isso que garante que cada uma continua no mês certo.
    UPDATE public.installments
       SET parent_id = _new_id,
           parent_type = _to_type,
           purchase_id = CASE WHEN _to_type = 'purchase' THEN _new_id ELSE NULL END
     WHERE parent_id = _from_id AND parent_type = _from_type;

  ELSIF _from_uses AND NOT _to_uses THEN
    -- Só a origem usava (só ocorre com origem=purchase, count=1): extrai a
    -- única parcela pro novo pai e apaga a linha de installments.
    SELECT * INTO _inst FROM public.installments
      WHERE parent_id = _from_id AND parent_type = _from_type LIMIT 1;
    IF FOUND THEN
      IF _to_type = 'debit' THEN
        UPDATE public.debits SET amount = _inst.amount, date = _inst.due_date, paid = _inst.paid,
               reference_year = _inst.year, reference_month = _inst.month WHERE id = _new_id;
      ELSIF _to_type = 'income' THEN
        UPDATE public.incomes SET amount = _inst.amount, date = _inst.due_date, received = _inst.paid,
               reference_year = _inst.year, reference_month = _inst.month WHERE id = _new_id;
      ELSIF _to_type = 'investment' THEN
        UPDATE public.investments SET amount = _inst.amount, date = _inst.due_date,
               reference_year = _inst.year, reference_month = _inst.month WHERE id = _new_id;
      END IF;
      DELETE FROM public.installments WHERE id = _inst.id;
    END IF;

  ELSIF NOT _from_uses AND _to_uses THEN
    -- Só o destino usa (só ocorre com destino=purchase, count=1): cria
    -- exatamente 1 parcela nova com os dados do pai de origem.
    INSERT INTO public.installments (id, user_id, parent_id, parent_type, purchase_id, number, total, amount, due_date, year, month, paid)
    VALUES (
      gen_random_uuid(), _owner_id, _new_id, 'purchase', _new_id, 1, 1, _amount, _date,
      COALESCE(_ref_year, EXTRACT(YEAR FROM _date)::int),
      COALESCE(_ref_month, EXTRACT(MONTH FROM _date)::int - 1),
      COALESCE(_paid, false)
    );
  END IF;
  -- (nenhum dos dois usa: nada a fazer, já coberto pelos defaults do passo 4)

  -- 6) Apaga a origem.
  IF _from_type = 'purchase' THEN
    DELETE FROM public.purchases WHERE id = _from_id;
  ELSIF _from_type = 'debit' THEN
    DELETE FROM public.debits WHERE id = _from_id;
  ELSIF _from_type = 'income' THEN
    DELETE FROM public.incomes WHERE id = _from_id;
  ELSIF _from_type = 'investment' THEN
    DELETE FROM public.investments WHERE id = _from_id;
  END IF;

  RETURN _new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.convert_finance_entry(text, uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_finance_entry(text, uuid, text, uuid) TO authenticated;
