ALTER TABLE public.exam_attempts ADD COLUMN IF NOT EXISTS cycle integer NOT NULL DEFAULT 1;
ALTER TABLE public.exams ALTER COLUMN max_attempts SET DEFAULT 2;
UPDATE public.exams SET max_attempts = 2 WHERE max_attempts IS DISTINCT FROM 2;

CREATE OR REPLACE FUNCTION public.exam_current_cycle(_user_id uuid, _exam_id uuid, _max_attempts integer)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cycle integer;
  _n integer;
BEGIN
  SELECT COALESCE(max(cycle), 1) INTO _cycle FROM public.exam_attempts
   WHERE user_id = _user_id AND exam_id = _exam_id;
  SELECT count(*) INTO _n FROM public.exam_attempts
   WHERE user_id = _user_id AND exam_id = _exam_id AND cycle = _cycle;
  IF COALESCE(_max_attempts, 0) > 0 AND _n >= _max_attempts THEN
    RETURN _cycle + 1;
  END IF;
  RETURN _cycle;
END;
$$;

CREATE OR REPLACE FUNCTION public.start_exam_attempt(_track_id uuid)
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
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthenticated');
  END IF;

  SELECT * INTO _exam FROM public.exams
   WHERE track_id = _track_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'no_exam');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.enrollments WHERE user_id = _uid AND track_id = _track_id) THEN
    RETURN jsonb_build_object('error', 'not_enrolled');
  END IF;

  IF NOT public.has_completed_all_lessons(_uid, _track_id) THEN
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
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthenticated');
  END IF;

  SELECT * INTO _exam FROM public.exams WHERE id = _exam_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'no_exam');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_uid::text || ':' || _exam_id::text, 0));

  IF NOT public.has_completed_all_lessons(_uid, _exam.track_id) THEN
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
    total_questions, passing_score, passed, duration_seconds, answers, details, cycle
  ) VALUES (
    _uid, _exam_id, _exam.track_id, _attempt_no, _percent::integer, _percent, _correct,
    _gradable, _exam.passing_score, _passed, _duration, _answers, _details, _cycle
  );

  IF _passed THEN
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
    -- gabarito só é revelado em caso de aprovação
    'details', CASE WHEN _passed THEN _details ELSE '[]'::jsonb END
  );
END;
$function$;