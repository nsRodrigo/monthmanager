-- Preferência pessoal de UI: qual ícone e quais atalhos aparecem no menu
-- flutuante de cada tela. Não é dado financeiro de conta, então segue o
-- mesmo padrão de `profiles`/`wallet` — RLS por `auth.uid() = user_id` puro,
-- sem `app_private.has_account_access` (nunca visível/editável por quem tem
-- acesso delegado a uma conta; é sempre da pessoa autenticada de verdade).
--
-- `config.actions` é um array ordenado de strings — ids do catálogo (ex.
-- "perfil") ou "folder:<id>". `config.folders` é um mapa
-- { [id]: { label, icon, actionIds: string[] } }. Uma pasta não pode conter
-- outra pasta (nível único). Ausência de linha para um (user_id, screen_id)
-- = usa o default hard-coded daquela tela no client — é isso que garante que
-- ninguém vê o FAB mudar até customizar de propósito.
CREATE TABLE public.fab_menu_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  screen_id text NOT NULL,
  icon text NOT NULL DEFAULT 'apps',
  config jsonb NOT NULL DEFAULT '{"actions":[],"folders":{}}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, screen_id)
);

ALTER TABLE public.fab_menu_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own fab config select" ON public.fab_menu_configs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own fab config insert" ON public.fab_menu_configs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own fab config update" ON public.fab_menu_configs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own fab config delete" ON public.fab_menu_configs FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_fab_menu_configs_updated_at
  BEFORE UPDATE ON public.fab_menu_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fab_menu_configs TO authenticated;
GRANT ALL ON public.fab_menu_configs TO service_role;
