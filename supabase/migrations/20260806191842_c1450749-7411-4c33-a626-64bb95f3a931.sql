REVOKE EXECUTE ON FUNCTION public.admin_enrollment_report(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_enrollment_report(uuid) TO authenticated;