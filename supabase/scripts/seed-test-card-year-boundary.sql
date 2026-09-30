-- =============================================================================
-- Cartão de teste para validar "mover fatura para outro mês" no cartão inteiro
-- (long-press na fatura → "..." → Mover para outro mês → "O cartão inteiro,
-- sem limite"), sobretudo a passagem de ano.
--
-- NÃO é uma migration — rode manualmente no SQL Editor do Supabase (não fica
-- em supabase/migrations, então `supabase db push` nunca executa isso sozinho).
--
-- Cria 1 cartão, "Cartão Teste (mudança de ano)", com:
--  - 1 compra parcelada em 30x, abr/2025 a set/2027 — atravessa 3 anos
--    (2025 → 2026 → 2027), com "hoje" caindo por volta da parcela 18/30.
--  - 1 assinatura recorrente, jan/2025 a dez/2026 (24 ocorrências).
--  - 2 compras avulsas (à vista), uma passada e uma futura.
--  - Algumas faturas passadas já marcadas como pagas em card_payments.
--
-- Depois de rodar, abra a tela de Lançamentos no mês de abril/2025 (ou
-- setembro/2026, ou setembro/2027) da conta usada, segure a fatura desse
-- cartão, toque em "..." → "Mover para outro mês" → "O cartão inteiro, sem
-- limite" e confira que TODAS as parcelas/ocorrências (passadas e futuras)
-- deslocam juntas pelo mesmo delta, sem furos nem duplicidade — inclusive
-- atravessando virada de ano.
--
-- Ajuste o e-mail abaixo se quiser rodar para outro usuário.
-- =============================================================================

DO $$
DECLARE
  v_user_id UUID;
  v_account_id UUID;
  v_card_id UUID := gen_random_uuid();
  v_purchase_id UUID;
  v_rec_group UUID := gen_random_uuid();
  v_purchase_row UUID;
  v_next_position INT;
  v_i INT;
  v_date DATE;
  v_amount NUMERIC;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'rodrigo.nascim.silva@gmail.com';
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado pelo e-mail informado.';
  END IF;

  SELECT id INTO v_account_id FROM public.accounts WHERE user_id = v_user_id ORDER BY created_at LIMIT 1;
  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'Nenhuma conta encontrada para este usuário — crie uma conta primeiro.';
  END IF;

  SELECT COALESCE(MAX(position), 0) + 1 INTO v_next_position
  FROM public.cards WHERE account_id = v_account_id;

  INSERT INTO public.cards (id, user_id, account_id, name, color, closing_day, due_day, position)
  VALUES (v_card_id, v_user_id, v_account_id, 'Cartão Teste (mudança de ano)', '#f97316', 20, 5, v_next_position);

  -- Parcelamento 30x, abr/2025 a set/2027.
  v_purchase_id := gen_random_uuid();
  v_amount := ROUND(15000.00 / 30, 2);
  INSERT INTO public.purchases (id, user_id, card_id, description, total_amount, purchase_date, installments_count)
  VALUES (v_purchase_id, v_user_id, v_card_id, 'Notebook parcelado 30x', 15000.00, '2025-04-15', 30);

  FOR v_i IN 1..30 LOOP
    v_date := ('2025-04-15'::date + ((v_i - 1) || ' months')::interval)::date;
    INSERT INTO public.installments
      (user_id, parent_id, parent_type, purchase_id, number, total, amount, due_date, year, month, paid)
    VALUES (
      v_user_id, v_purchase_id, 'purchase', v_purchase_id,
      v_i, 30, v_amount, v_date,
      EXTRACT(YEAR FROM v_date)::int, EXTRACT(MONTH FROM v_date)::int - 1,
      v_date < CURRENT_DATE
    );
  END LOOP;

  -- Assinatura recorrente, jan/2025 a dez/2026 (24 ocorrências).
  FOR v_i IN 0..23 LOOP
    v_date := ('2025-01-05'::date + (v_i || ' months')::interval)::date;
    v_purchase_row := gen_random_uuid();
    INSERT INTO public.purchases
      (id, user_id, card_id, description, total_amount, purchase_date, installments_count, recurrence_group_id)
    VALUES (v_purchase_row, v_user_id, v_card_id, 'Assinatura Streaming XPTO', 39.90, v_date, 1, v_rec_group);
    INSERT INTO public.installments
      (user_id, parent_id, parent_type, purchase_id, number, total, amount, due_date, year, month, paid)
    VALUES (
      v_user_id, v_purchase_row, 'purchase', v_purchase_row,
      1, 1, 39.90, v_date,
      EXTRACT(YEAR FROM v_date)::int, EXTRACT(MONTH FROM v_date)::int - 1,
      v_date < CURRENT_DATE
    );
  END LOOP;

  -- Duas compras avulsas (à vista): uma passada, uma futura.
  v_purchase_row := gen_random_uuid();
  INSERT INTO public.purchases (id, user_id, card_id, description, total_amount, purchase_date, installments_count)
  VALUES (v_purchase_row, v_user_id, v_card_id, 'Fone de ouvido', 349.90, '2026-08-10', 1);
  INSERT INTO public.installments
    (user_id, parent_id, parent_type, purchase_id, number, total, amount, due_date, year, month, paid)
  VALUES (v_user_id, v_purchase_row, 'purchase', v_purchase_row, 1, 1, 349.90, '2026-08-10', 2026, 7, true);

  v_purchase_row := gen_random_uuid();
  INSERT INTO public.purchases (id, user_id, card_id, description, total_amount, purchase_date, installments_count)
  VALUES (v_purchase_row, v_user_id, v_card_id, 'Presente de aniversário', 220.00, '2026-11-05', 1);
  INSERT INTO public.installments
    (user_id, parent_id, parent_type, purchase_id, number, total, amount, due_date, year, month, paid)
  VALUES (v_user_id, v_purchase_row, 'purchase', v_purchase_row, 1, 1, 220.00, '2026-11-05', 2026, 10, false);

  -- Marca algumas faturas passadas como pagas, pra ter histórico real em
  -- card_payments (e validar que essas linhas deslocam junto no shift).
  INSERT INTO public.card_payments (user_id, card_id, year, month, paid)
  VALUES
    (v_user_id, v_card_id, 2025, 3, true),
    (v_user_id, v_card_id, 2025, 4, true),
    (v_user_id, v_card_id, 2025, 5, true)
  ON CONFLICT (card_id, year, month) DO UPDATE SET paid = EXCLUDED.paid;

  RAISE NOTICE 'Cartão de teste criado: % (conta %)', v_card_id, v_account_id;
END $$;
