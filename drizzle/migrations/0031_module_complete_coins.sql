DO $mig$
DECLARE _def text;
BEGIN
  _def := pg_get_functiondef('public.coin_evidence_ok(uuid,text,text)'::regprocedure);
  IF position('module_complete' in _def) = 0 THEN
    _def := replace(_def, $r$    WHEN 'daily_login' THEN$r$,
      $r$    WHEN 'module_complete' THEN
      RETURN EXISTS (
        SELECT 1 FROM public.exam_attempts a
        WHERE a.user_id = _user_id AND a.module_id::text = _reference_id AND a.passed
      ) AND public.has_completed_module_lessons(_user_id, _reference_id::uuid);

    WHEN 'daily_login' THEN$r$);
    EXECUTE _def;
  END IF;
END $mig$;