
-- ── EXAMS ─────────────────────────────────────────────────────────
CREATE TABLE public.exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id uuid NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Avaliação Final',
  description text,
  passing_score integer NOT NULL DEFAULT 70,
  question_count integer NOT NULL DEFAULT 10,
  time_limit_minutes integer,
  shuffle_questions boolean NOT NULL DEFAULT true,
  shuffle_options boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (track_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exams TO authenticated;
GRANT ALL ON public.exams TO service_role;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage exams" ON public.exams
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view active exams" ON public.exams
  FOR SELECT TO authenticated
  USING (is_active = true);

CREATE TRIGGER update_exams_updated_at BEFORE UPDATE ON public.exams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── EXAM QUESTIONS (banco de questões por curso) ──────────────────
CREATE TABLE public.exam_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'multiple_choice',
  question text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_answer integer,
  expected_answer text,
  explanation text,
  points integer NOT NULL DEFAULT 1,
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exam_questions_type_check CHECK (type IN ('multiple_choice','true_false','essay'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_questions TO authenticated;
GRANT ALL ON public.exam_questions TO service_role;
ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;

-- somente admins acessam diretamente (alunos recebem via RPC sem gabarito)
CREATE POLICY "Admins manage exam questions" ON public.exam_questions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_exam_questions_updated_at BEFORE UPDATE ON public.exam_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_exam_questions_exam ON public.exam_questions(exam_id);

-- ── EXAM ATTEMPTS (histórico) ─────────────────────────────────────
CREATE TABLE public.exam_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  track_id uuid NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  attempt_number integer NOT NULL DEFAULT 1,
  score integer NOT NULL DEFAULT 0,
  percent numeric NOT NULL DEFAULT 0,
  correct_count integer NOT NULL DEFAULT 0,
  total_questions integer NOT NULL DEFAULT 0,
  passing_score integer NOT NULL DEFAULT 70,
  passed boolean NOT NULL DEFAULT false,
  duration_seconds integer NOT NULL DEFAULT 0,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  details jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.exam_attempts TO authenticated;
GRANT ALL ON public.exam_attempts TO service_role;
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own exam attempts" ON public.exam_attempts
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all exam attempts" ON public.exam_attempts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_exam_attempts_user ON public.exam_attempts(user_id);
CREATE INDEX idx_exam_attempts_track ON public.exam_attempts(track_id);

-- ── HELPER: aluno concluiu 100% das aulas? ────────────────────────
CREATE OR REPLACE FUNCTION public.has_completed_all_lessons(_user_id uuid, _track_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (SELECT count(*) FROM public.lessons WHERE track_id = _track_id) > 0
     AND NOT EXISTS (
       SELECT 1 FROM public.lessons l
       LEFT JOIN public.lesson_progress lp
         ON lp.lesson_id = l.id AND lp.user_id = _user_id
       WHERE l.track_id = _track_id
         AND COALESCE(lp.completed, false) = false
         AND NOT (COALESCE(l.duration, 0) > 0
                  AND COALESCE(lp.watched_seconds, 0) >= COALESCE(l.duration, 0) * 0.9)
     )
$$;

-- ── START ATTEMPT: entrega questões sorteadas e embaralhadas ──────
CREATE OR REPLACE FUNCTION public.start_exam_attempt(_track_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _exam record;
  _questions jsonb;
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
    'questions', _questions
  );
END;
$$;

-- ── SUBMIT ATTEMPT: corrige, registra e aplica regras ─────────────
CREATE OR REPLACE FUNCTION public.submit_exam_attempt(_exam_id uuid, _answers jsonb, _duration_seconds integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    _gradable, _exam.passing_score, _passed, GREATEST(COALESCE(_duration_seconds, 0), 0), _answers, _details
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
    -- reprovado: reinicia o progresso das aulas do curso
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
    'details', _details
  );
END;
$$;
