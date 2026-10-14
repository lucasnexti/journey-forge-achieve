CREATE OR REPLACE FUNCTION public.track_has_exam(_track_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM exams e
    WHERE e.track_id = _track_id AND e.is_active
      AND EXISTS (SELECT 1 FROM exam_questions q WHERE q.exam_id = e.id AND q.is_active)
  )
$$;

CREATE OR REPLACE FUNCTION public.complete_track_without_exam(_track_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _at timestamptz;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF public.track_has_exam(_track_id) THEN
    RETURN jsonb_build_object('completed', false, 'reason', 'has_exam');
  END IF;
  IF NOT public.has_completed_all_lessons(_uid, _track_id) THEN
    RETURN jsonb_build_object('completed', false, 'reason', 'lessons_pending');
  END IF;
  INSERT INTO enrollments (user_id, track_id, status, completed_at)
  VALUES (_uid, _track_id, 'completed', now())
  ON CONFLICT (user_id, track_id) DO UPDATE
    SET status = 'completed', completed_at = COALESCE(enrollments.completed_at, now())
  RETURNING completed_at INTO _at;
  RETURN jsonb_build_object('completed', true, 'completed_at', _at);
END $$;

REVOKE EXECUTE ON FUNCTION public.complete_track_without_exam(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.complete_track_without_exam(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.track_has_exam(uuid) TO authenticated;