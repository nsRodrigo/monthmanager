-- Bug encontrado ao provisionar um projeto Supabase NOVO (fora do Lovable):
-- `is_email_whitelisted` e `has_role` nunca tiveram GRANT EXECUTE explicito
-- em nenhuma migration anterior. No projeto antigo (provisionado pelo
-- Lovable) isso nunca deu problema porque o Postgres/Supabase concedia
-- EXECUTE em funcoes novas a PUBLIC por padrao; projetos Supabase criados
-- mais recentemente vem com esse padrao revogado, entao qualquer chamada
-- do client autenticado a essas funcoes falha com
-- "permission denied for function ...".
--
-- `is_email_whitelisted` e chamada diretamente pelo client via
-- supabase.rpc(...) em src/store/auth.tsx logo apos o login -- sem esse
-- grant, TODO login falha silenciosamente (o app trata o erro da RPC como
-- "usuario nao autorizado" e desloga).
-- `has_role` e usada dentro das policies de RLS de user_roles/whitelist.
GRANT EXECUTE ON FUNCTION public.is_email_whitelisted(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
