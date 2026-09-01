-- Bucket de fotos de perfil (avatar). Público — a URL vai direto pra
-- <img src>, sem signed URL — mas a escrita fica restrita ao próprio dono
-- via prefixo de pasta (auth.uid()/arquivo), mesmo padrão do bucket
-- "irpf-docs" (20260505122127_...sql). É lido/gravado por
-- src/routes/perfil.tsx (upload manual) e já populado automaticamente no
-- login com Google via handle_new_user() -> profiles.avatar_url.
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "avatars public select" ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');
CREATE POLICY "avatars own insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "avatars own update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "avatars own delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
