GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon;
GRANT EXECUTE ON FUNCTION public.is_email_whitelisted(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_email_whitelisted(text) TO anon;