-- Guarda o refresh token do Google (escopo drive.file) por usuário, pra
-- permitir renovar o access token no servidor sem precisar de login de novo.
-- O client_secret usado pra renovar fica só em variável de ambiente do
-- servidor (nunca nesta tabela) — aqui só o refresh token do usuário.
CREATE TABLE public.google_drive_tokens (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  refresh_token TEXT NOT NULL,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at TIMESTAMPTZ
);

ALTER TABLE public.google_drive_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own google drive token select" ON public.google_drive_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own google drive token insert" ON public.google_drive_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own google drive token update" ON public.google_drive_tokens FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own google drive token delete" ON public.google_drive_tokens FOR DELETE USING (auth.uid() = user_id);
