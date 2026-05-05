REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_email_whitelisted(text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.enforce_whitelist_on_signup() FROM anon, authenticated, public;