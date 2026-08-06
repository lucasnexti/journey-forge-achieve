REVOKE EXECUTE ON FUNCTION public.start_exam_attempt(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.submit_exam_attempt(uuid, jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_exam_attempt(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_exam_attempt(uuid, jsonb, integer) TO authenticated;