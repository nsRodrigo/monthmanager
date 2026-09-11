-- Central de notificações: além do push (efêmero — só chega se o
-- dispositivo já tiver permitido e estiver online), toda notificação agora
-- também vira uma linha aqui, durável, pra ser vista dentro do app a
-- qualquer momento (ex.: pedido de acesso a outra conta, conta a vencer,
-- pedido de cadastro pendente para admins). `kind`/`related_id` permitem um
-- botão de ação direto no item (ex.: Permitir/Recusar), quando aplicável.
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  url text,
  kind text NOT NULL DEFAULT 'generic',
  related_id uuid,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON public.notifications (user_id, created_at DESC);

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Só o dono lê/marca como lida/apaga. Inserção é sempre via service role
-- (server functions), por isso não existe policy de INSERT pra authenticated.
CREATE POLICY "own notifications select" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own notifications update" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own notifications delete" ON public.notifications
  FOR DELETE USING (auth.uid() = user_id);
