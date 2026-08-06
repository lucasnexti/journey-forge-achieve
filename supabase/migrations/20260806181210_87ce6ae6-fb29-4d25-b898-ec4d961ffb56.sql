CREATE TABLE IF NOT EXISTS public.exam_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  track_id uuid NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.exam_sessions TO authenticated;
GRANT ALL ON public.exam_sessions TO service_role;

ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own exam sessions" ON public.exam_sessions;
CREATE POLICY "Users view own exam sessions"
  ON public.exam_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins view all exam sessions" ON public.exam_sessions;
CREATE POLICY "Admins view all exam sessions"
  ON public.exam_sessions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS exam_sessions_open_idx
  ON public.exam_sessions (user_id, exam_id) WHERE submitted_at IS NULL;

-- start_exam_attempt: agora VOLATILE, cria/reutiliza a sessão com horário do servidor
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

  SELECT count(*) INTO _used FROM public.exam_attempts
   WHERE user_id = _uid AND exam_id = _exam.id;

  IF COALESCE(_exam.max_attempts, 0) > 0 AND _used >= _exam.max_attempts THEN
    RETURN jsonb_build_object(
      'error', 'attempt_limit_reached',
      'attempts_used', _used,
      'max_attempts', _exam.max_attempts
    );
  END IF;

  -- reutiliza sessão aberta (recuperação após queda/atualização) ou cria uma nova
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

-- submit_exam_attempt: duração calculada pelo servidor (cliente não influencia)
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
  _code text;
  _used integer := 0;
  _session record;
  _duration integer := 0;
  _timed_out boolean := false;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthenticated');
  END IF;

  SELECT * INTO _exam FROM public.exams WHERE id = _exam_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'no_exam');
  END IF;

  IF NOT public.has_completed_all_lessons(_uid, _exam.track_id) THEN
    RETURN jsonb_build_object('error', 'lessons_incomplete');
  END IF;

  SELECT count(*) INTO _used FROM public.exam_attempts
   WHERE user_id = _uid AND exam_id = _exam_id;

  IF COALESCE(_exam.max_attempts, 0) > 0 AND _used >= _exam.max_attempts THEN
    RETURN jsonb_build_object(
      'error', 'attempt_limit_reached',
      'attempts_used', _used,
      'max_attempts', _exam.max_attempts
    );
  END IF;

  -- sessão oficial iniciada no servidor
  SELECT * INTO _session FROM public.exam_sessions
   WHERE user_id = _uid AND exam_id = _exam_id AND submitted_at IS NULL
   ORDER BY started_at DESC LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'no_active_session');
  END IF;

  -- tempo real decorrido, medido pelo servidor (ignora _duration_seconds do cliente)
  _duration := GREATEST(floor(extract(epoch FROM now() - _session.started_at))::integer, 0);

  IF _exam.time_limit_minutes IS NOT NULL THEN
    IF _duration > _exam.time_limit_minutes * 60 THEN
      _timed_out := true;
    END IF;
    _duration := LEAST(_duration, _exam.time_limit_minutes * 60);
  END IF;

  UPDATE public.exam_sessions SET submitted_at = now() WHERE id = _session.id;

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
    FROM public.exam_attempts WHERE user_id = _uid AND exam_id = _exam_id;

  INSERT INTO public.exam_attempts (
    user_id, exam_id, track_id, attempt_number, score, percent, correct_count,
    total_questions, passing_score, passed, duration_seconds, answers, details
  ) VALUES (
    _uid, _exam_id, _exam.track_id, _attempt_no, _percent::integer, _percent, _correct,
    _gradable, _exam.passing_score, _passed, _duration, _answers, _details
  );

  IF _passed THEN
    UPDATE public.enrollments
       SET status = 'completed', completed_at = now()
     WHERE user_id = _uid AND track_id = _exam.track_id;

    IF NOT EXISTS (SELECT 1 FROM public.certificates WHERE user_id = _uid AND track_id = _exam.track_id) THEN
      _code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
      INSERT INTO public.certificates (user_id, track_id, certificate_code, issued_at)
      VALUES (_uid, _exam.track_id, _code, now());
    END IF;
  ELSE
    DELETE FROM public.lesson_progress
     WHERE user_id = _uid AND track_id = _exam.track_id;

    UPDATE public.enrollments
       SET status = 'in_progress', completed_at = NULL
     WHERE user_id = _uid AND track_id = _exam.track_id;
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
    'details', _details
  );
END;
$function$;