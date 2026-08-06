-- ============ ÍNDICES DE PERFORMANCE ============
CREATE INDEX IF NOT EXISTS idx_lessons_track_order ON public.lessons (track_id, order_index);
CREATE INDEX IF NOT EXISTS idx_lesson_materials_lesson ON public.lesson_materials (lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_track ON public.lesson_progress (user_id, track_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_track ON public.lesson_progress (track_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_lastwatched ON public.lesson_progress (user_id, last_watched_at DESC);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_lesson ON public.lesson_progress (lesson_id);

CREATE INDEX IF NOT EXISTS idx_quizzes_track ON public.quizzes (track_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_order ON public.quiz_questions (quiz_id, order_index);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_date ON public.quiz_attempts (user_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz ON public.quiz_attempts (quiz_id);

CREATE INDEX IF NOT EXISTS idx_exam_attempts_user_exam ON public.exam_attempts (user_id, exam_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exam_questions_exam_active ON public.exam_questions (exam_id, is_active, order_index);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_user_exam ON public.exam_sessions (user_id, exam_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_certificates_user ON public.certificates (user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_track ON public.certificates (track_id);

CREATE INDEX IF NOT EXISTS idx_forum_posts_track ON public.forum_posts (track_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_posts_parent ON public.forum_posts (parent_id);
CREATE INDEX IF NOT EXISTS idx_forum_posts_user ON public.forum_posts (user_id);

CREATE INDEX IF NOT EXISTS idx_kb_quiz_questions_module ON public.kb_quiz_questions (module_id, order_index);
CREATE INDEX IF NOT EXISTS idx_kb_quiz_attempts_user ON public.kb_quiz_attempts (user_id, attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_track_favorites_user ON public.track_favorites (user_id);
CREATE INDEX IF NOT EXISTS idx_track_ratings_track ON public.track_ratings (track_id);
CREATE INDEX IF NOT EXISTS idx_reward_redemptions_user ON public.reward_redemptions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_training_requests_user ON public.training_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_badges_user ON public.user_badges (user_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_user ON public.survey_responses (user_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_survey ON public.survey_responses (survey_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_history_rule ON public.alert_history (rule_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracks_active_order ON public.tracks (is_active, order_index);

-- ============ ENVIO DE PROVA IDEMPOTENTE ============
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

  -- Serializa envios concorrentes do mesmo usuário/prova (evita duplicidade)
  PERFORM pg_advisory_xact_lock(hashtextextended(_uid::text || ':' || _exam_id::text, 0));

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

  -- Reivindica a sessão aberta de forma atômica: só um envio consegue
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

    INSERT INTO public.certificates (user_id, track_id, certificate_code, issued_at)
    SELECT _uid, _exam.track_id,
           upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)), now()
    ON CONFLICT (user_id, track_id) DO NOTHING;
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