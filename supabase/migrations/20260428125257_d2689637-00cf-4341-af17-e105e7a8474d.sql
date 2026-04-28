
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
