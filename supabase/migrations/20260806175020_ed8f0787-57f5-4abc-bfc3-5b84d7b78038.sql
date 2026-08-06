
REVOKE EXECUTE ON FUNCTION public.start_exam_attempt(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.submit_exam_attempt(uuid, jsonb, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_completed_all_lessons(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.start_exam_attempt(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_exam_attempt(uuid, jsonb, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_completed_all_lessons(uuid, uuid) TO authenticated;
