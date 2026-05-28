-- Revoke direct EXECUTE on internal SECURITY DEFINER helpers in public schema.
-- They are used by RLS policies (via app_private equivalents) and by auth triggers,
-- never called directly by client code. Removing public EXECUTE eliminates the
-- "anon/authenticated can execute SECURITY DEFINER function" surface and reduces
-- the privilege-escalation blast radius if user_roles INSERT is ever misconfigured.

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_email_whitelisted(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_whitelist_on_signup() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;