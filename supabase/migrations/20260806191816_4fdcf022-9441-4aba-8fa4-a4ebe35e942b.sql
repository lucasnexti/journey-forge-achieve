CREATE OR REPLACE FUNCTION public.admin_enrollment_report(_track_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'total_users', (SELECT count(*) FROM public.profiles),
    'total_tracks', (SELECT count(*) FROM public.tracks WHERE is_active),
    'certificates', (SELECT count(*) FROM public.certificates),
    'total_enrollments', (SELECT count(*) FROM public.enrollments e WHERE _track_id IS NULL OR e.track_id = _track_id),
    'by_status', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('status', s.status, 'value', s.value))
      FROM (
        SELECT COALESCE(e.status, 'unknown') AS status, count(*)::int AS value
        FROM public.enrollments e
        WHERE _track_id IS NULL OR e.track_id = _track_id
        GROUP BY 1
      ) s
    ), '[]'::jsonb),
    'by_track', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', t.name, 'value', t.value) ORDER BY t.value DESC)
      FROM (
        SELECT COALESCE(tr.title, 'Sem trilha') AS name, count(*)::int AS value
        FROM public.enrollments e
        LEFT JOIN public.tracks tr ON tr.id = e.track_id
        WHERE _track_id IS NULL OR e.track_id = _track_id
        GROUP BY 1
        ORDER BY 2 DESC
        LIMIT 30
      ) t
    ), '[]'::jsonb)
  ) INTO _result;

  RETURN _result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_enrollment_report(uuid) TO authenticated;