ALTER FUNCTION public.bulk_insert_finance(jsonb) SECURITY INVOKER;
ALTER FUNCTION public.restore_finance_backup(jsonb, text[], boolean) SECURITY INVOKER;

REVOKE ALL ON FUNCTION public.bulk_insert_finance(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_finance_backup(jsonb, text[], boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_insert_finance(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_finance_backup(jsonb, text[], boolean) TO authenticated;