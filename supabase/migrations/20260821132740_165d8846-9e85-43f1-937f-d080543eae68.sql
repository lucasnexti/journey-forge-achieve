-- Fecha execução anônima em funções sensíveis
REVOKE ALL ON FUNCTION public.is_same_company(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_user_streak(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_quiz_attempt(uuid, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_quiz_questions(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_kb_quiz_questions(uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.validate_kb_quiz_attempt(uuid, uuid[], jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_user_coins(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_user_empresa(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.exam_current_cycle(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.is_same_company(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validate_quiz_attempt(uuid, uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_quiz_questions(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_kb_quiz_questions(uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validate_kb_quiz_attempt(uuid, uuid[], jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_coins(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_empresa(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_user_streak(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.exam_current_cycle(uuid, uuid, integer) TO service_role;

-- Impede registrar tentativa/streak em nome de outro usuário
CREATE OR REPLACE FUNCTION public.validate_quiz_attempt(_user_id uuid, _quiz_id uuid, _answers jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _total integer;
  _correct integer := 0;
  _passing_score integer;
  _question record;
  _user_answer integer;
  _result jsonb;
  _details jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthenticated');
  END IF;
  _user_id := auth.uid();

  SELECT passing_score INTO _passing_score FROM public.quizzes WHERE id = _quiz_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Quiz not found');
  END IF;

  SELECT count(*) INTO _total FROM public.quiz_questions WHERE quiz_id = _quiz_id;

  FOR _question IN SELECT id, correct_answer FROM public.quiz_questions WHERE quiz_id = _quiz_id
  LOOP
    _user_answer := (_answers->>(_question.id::text))::integer;
    IF _user_answer IS NOT NULL AND _user_answer = _question.correct_answer THEN
      _correct := _correct + 1;
    END IF;
    _details := _details || jsonb_build_object(
      'question_id', _question.id,
      'correct_answer', _question.correct_answer,
      'user_answer', _user_answer,
      'is_correct', (_user_answer IS NOT NULL AND _user_answer = _question.correct_answer)
    );
  END LOOP;

  _result := jsonb_build_object(
    'score', CASE WHEN _total > 0 THEN round((_correct::numeric / _total) * 100) ELSE 0 END,
    'correct', _correct,
    'total', _total,
    'passed', CASE WHEN _total > 0 THEN round((_correct::numeric / _total) * 100) >= _passing_score ELSE false END,
    'details', _details
  );

  INSERT INTO public.quiz_attempts (user_id, quiz_id, score, passed, answers)
  VALUES (_user_id, _quiz_id, (_result->>'score')::integer, (_result->>'passed')::boolean, _answers);

  RETURN _result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_kb_quiz_attempt(_user_id uuid, _module_ids uuid[], _answers jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _total integer;
  _correct integer := 0;
  _question record;
  _user_answer integer;
  _results jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthenticated');
  END IF;
  _user_id := auth.uid();

  FOR _question IN
    SELECT id, correct_answer, explanation
    FROM public.kb_quiz_questions
    WHERE module_id = ANY(_module_ids)
  LOOP
    _user_answer := (_answers->>(_question.id::text))::integer;
    IF _user_answer IS NOT NULL AND _user_answer = _question.correct_answer THEN
      _correct := _correct + 1;
    END IF;
    _results := _results || jsonb_build_object(
      'question_id', _question.id,
      'correct_answer', _question.correct_answer,
      'user_answer', _user_answer,
      'is_correct', (_user_answer IS NOT NULL AND _user_answer = _question.correct_answer),
      'explanation', _question.explanation
    );
  END LOOP;

  _total := jsonb_array_length(_results);

  RETURN jsonb_build_object(
    'score', CASE WHEN _total > 0 THEN round((_correct::numeric / _total) * 100) ELSE 0 END,
    'correct', _correct,
    'total', _total,
    'passed', CASE WHEN _total > 0 THEN round((_correct::numeric / _total) * 100) >= 70 ELSE false END,
    'details', _results
  );
END;
$function$;

-- Streak seguro: sempre para o usuário autenticado
CREATE OR REPLACE FUNCTION public.touch_my_streak()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row record;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated'); END IF;
  PERFORM public.update_user_streak(_uid);
  SELECT current_streak, longest_streak INTO _row FROM public.user_streaks WHERE user_id = _uid;
  RETURN jsonb_build_object('ok', true, 'current_streak', COALESCE(_row.current_streak, 1), 'longest_streak', COALESCE(_row.longest_streak, 1));
END;
$$;

REVOKE ALL ON FUNCTION public.touch_my_streak() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.touch_my_streak() TO authenticated, service_role;