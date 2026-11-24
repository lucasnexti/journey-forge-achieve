ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS module_id uuid REFERENCES public.course_modules(id) ON DELETE CASCADE;
ALTER TABLE public.exam_attempts ADD COLUMN IF NOT EXISTS module_id uuid;
ALTER TABLE public.exams DROP CONSTRAINT IF EXISTS exams_track_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS exams_final_per_track ON public.exams(track_id) WHERE module_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS exams_one_per_module ON public.exams(module_id) WHERE module_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS exam_attempts_module_idx ON public.exam_attempts(module_id) WHERE module_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.has_completed_module_lessons(_user_id uuid, _module_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $f$
  SELECT (SELECT count(*) FROM public.lessons WHERE module_id = _module_id AND is_published) > 0
     AND NOT EXISTS (
       SELECT 1 FROM public.lessons l
       LEFT JOIN public.lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = _user_id
       WHERE l.module_id = _module_id AND l.is_published
         AND COALESCE(lp.completed, false) = false
         AND NOT (COALESCE(l.duration, 0) > 0
                  AND COALESCE(lp.watched_seconds, 0) >= CEIL(l.duration * 0.9))
     )
$f$;
REVOKE EXECUTE ON FUNCTION public.has_completed_module_lessons(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_completed_module_lessons(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.track_has_exam(_track_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $f$
  SELECT EXISTS (
    SELECT 1 FROM exams e
    WHERE e.track_id = _track_id AND e.module_id IS NULL AND e.is_active
      AND EXISTS (SELECT 1 FROM exam_questions q WHERE q.exam_id = e.id AND q.is_active)
  )
$f$;

DROP FUNCTION IF EXISTS public.start_exam_attempt(uuid);
CREATE OR REPLACE FUNCTION public.start_exam_attempt(_track_id uuid, _module_id uuid DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _exam record;
  _questions jsonb;
  _used integer := 0;
  _cycle integer := 1;
  _session record;
BEGIN
IF NOT public.can_access_learning_course(_track_id) THEN RAISE EXCEPTION 'Curso não autorizado ou anterior pendente'; END IF;
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthenticated');
  END IF;

  SELECT * INTO _exam FROM public.exams
   WHERE track_id = _track_id AND is_active = true
     AND module_id IS NOT DISTINCT FROM _module_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'no_exam');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.enrollments WHERE user_id = _uid AND track_id = _track_id) THEN
    RETURN jsonb_build_object('error', 'not_enrolled');
  END IF;

  IF (_module_id IS NULL AND NOT public.has_completed_all_lessons(_uid, _track_id))
     OR (_module_id IS NOT NULL AND NOT public.has_completed_module_lessons(_uid, _module_id)) THEN
    RETURN jsonb_build_object('error', 'lessons_incomplete');
  END IF;

  _cycle := public.exam_current_cycle(_uid, _exam.id, _exam.max_attempts);
  SELECT count(*) INTO _used FROM public.exam_attempts
   WHERE user_id = _uid AND exam_id = _exam.id AND cycle = _cycle;

  IF COALESCE(_exam.max_attempts, 0) > 0 AND _used >= _exam.max_attempts THEN
    RETURN jsonb_build_object(
      'error', 'attempt_limit_reached',
      'attempts_used', _used,
      'max_attempts', _exam.max_attempts
    );
  END IF;

  SELECT * INTO _session FROM public.exam_sessions
   WHERE user_id = _uid AND exam_id = _exam.id AND submitted_at IS NULL
     AND (expires_at IS NULL OR expires_at > now())
   ORDER BY started_at DESC LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.exam_sessions (user_id, exam_id, track_id, started_at, expires_at)
    VALUES (
      _uid, _exam.id, _track_id, now(),
      CASE WHEN _exam.time_limit_minutes IS NOT NULL
           THEN now() + make_interval(mins => _exam.time_limit_minutes)
           ELSE NULL END
    )
    RETURNING * INTO _session;
  END IF;

  SELECT COALESCE(jsonb_agg(q), '[]'::jsonb) INTO _questions
  FROM (
    SELECT jsonb_build_object(
      'id', id,
      'type', type,
      'question', question,
      'options', CASE
        WHEN type = 'essay' THEN '[]'::jsonb
        WHEN _exam.shuffle_options THEN (
          SELECT COALESCE(jsonb_agg(jsonb_build_object('index', ord - 1, 'text', val) ORDER BY random()), '[]'::jsonb)
          FROM jsonb_array_elements_text(options) WITH ORDINALITY AS t(val, ord)
        )
        ELSE (
          SELECT COALESCE(jsonb_agg(jsonb_build_object('index', ord - 1, 'text', val) ORDER BY ord), '[]'::jsonb)
          FROM jsonb_array_elements_text(options) WITH ORDINALITY AS t(val, ord)
        )
      END,
      'points', points
    ) AS q
    FROM public.exam_questions
    WHERE exam_id = _exam.id AND is_active = true
    ORDER BY CASE WHEN _exam.shuffle_questions THEN random() END, order_index
    LIMIT GREATEST(_exam.question_count, 1)
  ) sub;

  RETURN jsonb_build_object(
    'exam_id', _exam.id,
    'module_id', _exam.module_id,
    'title', _exam.title,
    'description', _exam.description,
    'passing_score', _exam.passing_score,
    'time_limit_minutes', _exam.time_limit_minutes,
    'max_attempts', _exam.max_attempts,
    'attempts_used', _used,
    'attempts_left', CASE WHEN COALESCE(_exam.max_attempts, 0) > 0
                          THEN GREATEST(_exam.max_attempts - _used, 0) ELSE NULL END,
    'session_id', _session.id,
    'server_now', now(),
    'started_at', _session.started_at,
    'expires_at', _session.expires_at,
    'elapsed_seconds', GREATEST(floor(extract(epoch FROM now() - _session.started_at))::integer, 0),
    'questions', _questions
  );
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.start_exam_attempt(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.start_exam_attempt(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_exam_attempt(_exam_id uuid, _answers jsonb, _duration_seconds integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _exam record;
  _q record;
  _ans text;
  _is_correct boolean;
  _gradable integer := 0;
  _correct integer := 0;
  _details jsonb := '[]'::jsonb;
  _percent numeric := 0;
  _passed boolean := false;
  _attempt_no integer;
  _used integer := 0;
  _cycle integer := 1;
  _session record;
  _duration integer := 0;
  _timed_out boolean := false;
  _course_reset boolean := false;
BEGIN
IF NOT EXISTS(SELECT 1 FROM public.exams WHERE id=_exam_id AND public.can_access_learning_course(track_id)) THEN RAISE EXCEPTION 'Curso não autorizado ou anterior pendente'; END IF;
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthenticated');
  END IF;

  SELECT * INTO _exam FROM public.exams WHERE id = _exam_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'no_exam');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_uid::text || ':' || _exam_id::text, 0));

  IF (_exam.module_id IS NULL AND NOT public.has_completed_all_lessons(_uid, _exam.track_id))
     OR (_exam.module_id IS NOT NULL AND NOT public.has_completed_module_lessons(_uid, _exam.module_id)) THEN
    RETURN jsonb_build_object('error', 'lessons_incomplete');
  END IF;

  _cycle := public.exam_current_cycle(_uid, _exam_id, _exam.max_attempts);
  SELECT count(*) INTO _used FROM public.exam_attempts
   WHERE user_id = _uid AND exam_id = _exam_id AND cycle = _cycle;

  IF COALESCE(_exam.max_attempts, 0) > 0 AND _used >= _exam.max_attempts THEN
    RETURN jsonb_build_object(
      'error', 'attempt_limit_reached',
      'attempts_used', _used,
      'max_attempts', _exam.max_attempts
    );
  END IF;

  UPDATE public.exam_sessions
     SET submitted_at = now()
   WHERE id = (
     SELECT id FROM public.exam_sessions
      WHERE user_id = _uid AND exam_id = _exam_id AND submitted_at IS NULL
      ORDER BY started_at DESC LIMIT 1
   )
  RETURNING * INTO _session;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'no_active_session');
  END IF;

  _duration := GREATEST(floor(extract(epoch FROM now() - _session.started_at))::integer, 0);

  IF _exam.time_limit_minutes IS NOT NULL THEN
    IF _duration > _exam.time_limit_minutes * 60 THEN
      _timed_out := true;
    END IF;
    _duration := LEAST(_duration, _exam.time_limit_minutes * 60);
  END IF;

  FOR _q IN
    SELECT * FROM public.exam_questions
     WHERE exam_id = _exam_id AND is_active = true
       AND _answers ? (id::text)
  LOOP
    _ans := _answers->>(_q.id::text);
    IF _q.type = 'essay' THEN
      _details := _details || jsonb_build_object(
        'question_id', _q.id, 'type', _q.type, 'question', _q.question,
        'user_answer', _ans, 'expected_answer', _q.expected_answer,
        'is_correct', null, 'pending_review', true, 'explanation', _q.explanation
      );
    ELSE
      _gradable := _gradable + 1;
      _is_correct := (_ans IS NOT NULL AND _ans ~ '^[0-9]+$' AND _ans::integer = _q.correct_answer);
      IF _is_correct THEN _correct := _correct + 1; END IF;
      _details := _details || jsonb_build_object(
        'question_id', _q.id, 'type', _q.type, 'question', _q.question,
        'options', _q.options,
        'user_answer', CASE WHEN _ans ~ '^[0-9]+$' THEN to_jsonb(_ans::integer) ELSE 'null'::jsonb END,
        'correct_answer', _q.correct_answer,
        'is_correct', _is_correct, 'pending_review', false, 'explanation', _q.explanation
      );
    END IF;
  END LOOP;

  IF _gradable > 0 THEN
    _percent := round((_correct::numeric / _gradable) * 100);
  END IF;
  _passed := _gradable > 0 AND _percent >= _exam.passing_score;

  SELECT COALESCE(max(attempt_number), 0) + 1 INTO _attempt_no
    FROM public.exam_attempts WHERE user_id = _uid AND exam_id = _exam_id AND cycle = _cycle;

  INSERT INTO public.exam_attempts (
    user_id, exam_id, track_id, attempt_number, score, percent, correct_count,
    total_questions, passing_score, passed, duration_seconds, answers, details, cycle, module_id
  ) VALUES (
    _uid, _exam_id, _exam.track_id, _attempt_no, _percent::integer, _percent, _correct,
    _gradable, _exam.passing_score, _passed, _duration, _answers, _details, _cycle, _exam.module_id
  );

  IF _exam.module_id IS NOT NULL THEN
    IF NOT _passed AND COALESCE(_exam.max_attempts, 0) > 0 AND (_used + 1) >= _exam.max_attempts THEN
      _course_reset := true;
      DELETE FROM public.lesson_progress lp USING public.lessons l
       WHERE lp.lesson_id = l.id AND l.module_id = _exam.module_id AND lp.user_id = _uid;
    END IF;
  ELSIF _passed THEN
    UPDATE public.enrollments
       SET status = 'completed', completed_at = now()
     WHERE user_id = _uid AND track_id = _exam.track_id;

    INSERT INTO public.certificates (user_id, track_id, certificate_code, issued_at)
    SELECT _uid, _exam.track_id,
           upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)), now()
    ON CONFLICT (user_id, track_id) DO NOTHING;
  ELSE
    -- Só reinicia o curso quando esgotar as tentativas do ciclo atual
    IF COALESCE(_exam.max_attempts, 0) > 0 AND (_used + 1) >= _exam.max_attempts THEN
      _course_reset := true;
      DELETE FROM public.lesson_progress
       WHERE user_id = _uid AND track_id = _exam.track_id;

      UPDATE public.enrollments
         SET status = 'active', completed_at = NULL
       WHERE user_id = _uid AND track_id = _exam.track_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'percent', _percent,
    'score', _percent::integer,
    'correct', _correct,
    'total', _gradable,
    'passing_score', _exam.passing_score,
    'passed', _passed,
    'attempt_number', _attempt_no,
    'duration_seconds', _duration,
    'timed_out', _timed_out,
    'max_attempts', _exam.max_attempts,
    'attempts_used', _used + 1,
    'attempts_left', CASE WHEN COALESCE(_exam.max_attempts, 0) > 0
                          THEN GREATEST(_exam.max_attempts - (_used + 1), 0) ELSE NULL END,
    'course_reset', _course_reset,
    'details', CASE WHEN _passed THEN _details ELSE '[]'::jsonb END
  );
END;
$function$;