
CREATE POLICY "no client access" ON public.webauthn_challenges FOR ALL USING (false) WITH CHECK (false);
