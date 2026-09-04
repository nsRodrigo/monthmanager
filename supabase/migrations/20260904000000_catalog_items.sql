-- "Locais e Produtos" — catálogo de descrições reutilizáveis (mercados,
-- postos, serviços, produtos) compartilhado entre débitos, recebimentos,
-- compras e investimentos. Objetivo: sugerir descrições já usadas em
-- QUALQUER tipo de lançamento (ao contrário do histórico por tipo que já
-- existia) e nunca duplicar o mesmo item por causa de maiúsculas/espaços.
--
-- `name_normalized` (trim + lower) é o que garante a não-duplicação — via
-- UNIQUE(user_id, name_normalized) — enquanto `name` guarda a grafia
-- original escolhida/exibida.
--
-- `kind` é opcional: quando o usuário cadastra manualmente na tela "Locais
-- e Produtos" ele escolhe 'local' ou 'produto'; quando o item é criado
-- automaticamente a partir da descrição de um lançamento (sem esse passo
-- extra), fica NULL ("não classificado") até alguém organizar depois.
CREATE TABLE public.catalog_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_normalized TEXT NOT NULL,
  kind TEXT CHECK (kind IN ('local', 'produto')),
  usage_count INTEGER NOT NULL DEFAULT 1,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name_normalized)
);

ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own catalog_items select" ON public.catalog_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own catalog_items insert" ON public.catalog_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own catalog_items update" ON public.catalog_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own catalog_items delete" ON public.catalog_items FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_catalog_items_user_name ON public.catalog_items(user_id, name_normalized);
